import {
  ConductorEventType,
  ConductorSyncEvent,
  ConductorBatchSyncResponse,
  ConductorSessionState,
} from '@yogaos/contracts';

export type EventSyncStatus = 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface QueuedConductorEvent {
  clientEventUuid: string;
  sessionInstanceId: string;
  sequenceVersionId: string;
  eventType: ConductorEventType;
  stepOrder: number | null;
  clientTimestamp: string;
  payload: Record<string, unknown> | null;
  syncStatus: EventSyncStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: number;
}

const DB_NAME = 'yogaos_conductor_events_db';
const DB_VERSION = 1;
const STORE_NAME = 'event_queue';

/**
 * Open or upgrade the IndexedDB event database.
 */
function openEventDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' && typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is unavailable in this environment'));
    }

    const idb = typeof indexedDB !== 'undefined' ? indexedDB : (globalThis as any).indexedDB;
    if (!idb) {
      return reject(new Error('IndexedDB is not supported on this platform'));
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error('Failed to open conductor event queue database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'clientEventUuid' });
        store.createIndex('sessionInstanceId', 'sessionInstanceId', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('sessionSync', ['sessionInstanceId', 'syncStatus'], { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Persist an execution event to the durable local queue.
 */
export async function enqueueConductorEvent(
  sessionInstanceId: string,
  sequenceVersionId: string,
  event: {
    clientEventUuid: string;
    eventType: ConductorEventType;
    stepOrder?: number | null;
    clientTimestamp?: string;
    payload?: Record<string, unknown>;
  }
): Promise<QueuedConductorEvent> {
  const queuedEvent: QueuedConductorEvent = {
    clientEventUuid: event.clientEventUuid,
    sessionInstanceId,
    sequenceVersionId,
    eventType: event.eventType,
    stepOrder: event.stepOrder ?? null,
    clientTimestamp: event.clientTimestamp || new Date().toISOString(),
    payload: event.payload || null,
    syncStatus: 'QUEUED',
    retryCount: 0,
    lastError: null,
    createdAt: Date.now(),
  };

  const db = await openEventDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(queuedEvent);

    putReq.onsuccess = () => resolve(queuedEvent);
    putReq.onerror = () => reject(putReq.error || new Error('Failed to enqueue conductor event'));
  });
}

/**
 * Retrieve all events for a session matching given status (e.g., QUEUED or FAILED).
 */
export async function getEventsBySession(
  sessionInstanceId: string,
  statuses?: EventSyncStatus[]
): Promise<QueuedConductorEvent[]> {
  const db = await openEventDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionInstanceId');
    const req = index.getAll(IDBKeyRange.only(sessionInstanceId));

    req.onsuccess = () => {
      let results: QueuedConductorEvent[] = req.result || [];
      if (statuses && statuses.length > 0) {
        results = results.filter((e) => statuses.includes(e.syncStatus));
      }
      // Sort chronologically
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };

    req.onerror = () => reject(req.error || new Error('Failed to query conductor events'));
  });
}

/**
 * Update sync status for a batch of events.
 */
export async function updateEventsSyncStatus(
  eventUuids: string[],
  status: EventSyncStatus,
  errorMessage?: string
): Promise<void> {
  if (eventUuids.length === 0) return;

  const db = await openEventDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    let completed = 0;
    let hasError = false;

    eventUuids.forEach((uuid) => {
      const getReq = store.get(uuid);
      getReq.onsuccess = () => {
        const item: QueuedConductorEvent = getReq.result;
        if (item) {
          item.syncStatus = status;
          if (status === 'FAILED') {
            item.retryCount += 1;
            item.lastError = errorMessage || 'Sync failed';
          } else if (status === 'SYNCED') {
            item.lastError = null;
          }
          store.put(item);
        }
        completed++;
        if (completed === eventUuids.length && !hasError) {
          resolve();
        }
      };
      getReq.onerror = () => {
        hasError = true;
        reject(getReq.error);
      };
    });

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Synchronize all pending/failed events for a session with the backend.
 * Handles partial synchronization, offline state, and retries.
 */
export async function synchronizePendingEvents(
  sessionInstanceId: string,
  syncApiCall: (batch: {
    events: ConductorSyncEvent[];
    sessionStateSnapshot?: any;
  }) => Promise<ConductorBatchSyncResponse>,
  sessionStateSnapshot?: any
): Promise<{
  syncedCount: number;
  failedCount: number;
  serverState?: ConductorSessionState;
  error?: string;
}> {
  // 1. Fetch pending and failed events
  const pending = await getEventsBySession(sessionInstanceId, ['QUEUED', 'FAILED']);
  if (pending.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  const batchUuids = pending.map((e) => e.clientEventUuid);

  // 2. Mark events as SYNCING
  await updateEventsSyncStatus(batchUuids, 'SYNCING');

  try {
    // 3. Format payload
    const syncEvents: ConductorSyncEvent[] = pending.map((e) => ({
      clientEventUuid: e.clientEventUuid,
      eventType: e.eventType,
      stepOrder: e.stepOrder,
      clientTimestamp: e.clientTimestamp,
      payload: e.payload || undefined,
    }));

    // 4. Send to server
    const response = await syncApiCall({
      events: syncEvents,
      sessionStateSnapshot,
    });

    // 5. Acknowledge durably accepted events
    const acknowledged = response.acknowledgedEventUuids || [];
    await updateEventsSyncStatus(acknowledged, 'SYNCED');

    // 6. Any unacknowledged events revert to FAILED for retry
    const unacknowledged = batchUuids.filter((id) => !acknowledged.includes(id));
    if (unacknowledged.length > 0) {
      await updateEventsSyncStatus(unacknowledged, 'FAILED', 'Server did not acknowledge event');
    }

    return {
      syncedCount: acknowledged.length,
      failedCount: unacknowledged.length,
      serverState: response.currentState,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Network sync error';
    await updateEventsSyncStatus(batchUuids, 'FAILED', errorMsg);
    return {
      syncedCount: 0,
      failedCount: batchUuids.length,
      error: errorMsg,
    };
  }
}

/**
 * Clean up synced events older than retention period (e.g., 7 days).
 * Unsynced/queued events are strictly NEVER discarded.
 */
export async function pruneSyncedEvents(retentionMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openEventDatabase();
  const cutoff = Date.now() - retentionMs;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all: QueuedConductorEvent[] = req.result || [];
      let deleted = 0;
      all.forEach((item) => {
        // Only delete SYNCED events that have exceeded the retention window
        if (item.syncStatus === 'SYNCED' && item.createdAt < cutoff) {
          store.delete(item.clientEventUuid);
          deleted++;
        }
      });
      resolve(deleted);
    };

    req.onerror = () => reject(req.error);
  });
}
