import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueConductorEvent,
  getEventsBySession,
  updateEventsSyncStatus,
  synchronizePendingEvents,
  pruneSyncedEvents,
  QueuedConductorEvent,
} from '../../web/src/lib/conductor-event-queue';
import { ConductorStateMachine } from '../src/modules/conductor/conductor-state-machine';

/**
 * In-memory IndexedDB mock simulating browser storage behavior across restarts.
 */
class InMemoryIDBDatabase {
  public store = new Map<string, QueuedConductorEvent>();

  reset() {
    this.store.clear();
  }

  createMockDB(): any {
    const self = this;
    return {
      transaction: (_storeName: string, _mode: string) => ({
        objectStore: (_name: string) => ({
          put: (item: QueuedConductorEvent) => {
            self.store.set(item.clientEventUuid, { ...item });
            const req: any = { onsuccess: null, onerror: null };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: item } }), 0);
            return req;
          },
          get: (key: string) => {
            const item = self.store.get(key);
            const req: any = { onsuccess: null, onerror: null, result: item ? { ...item } : undefined };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: req.result } }), 0);
            return req;
          },
          getAll: () => {
            const list = Array.from(self.store.values()).map((v) => ({ ...v }));
            const req: any = { onsuccess: null, onerror: null, result: list };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: req.result } }), 0);
            return req;
          },
          delete: (key: string) => {
            self.store.delete(key);
            const req: any = { onsuccess: null, onerror: null };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: true } }), 0);
            return req;
          },
          index: (_indexName: string) => ({
            getAll: (keyRange?: any) => {
              let list = Array.from(self.store.values());
              if (keyRange) {
                // simple filtering by sessionInstanceId
                list = list.filter((e) => !keyRange.upper || e.sessionInstanceId === keyRange.upper);
              }
              const req: any = { onsuccess: null, onerror: null, result: list.map((v) => ({ ...v })) };
              setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: req.result } }), 0);
              return req;
            },
          }),
        }),
      }),
    };
  }
}

describe('Conductor Event Sync & Recovery Unit Tests', () => {
  const mockDb = new InMemoryIDBDatabase();
  const sessionId = '11111111-2222-3333-4444-555555555555';
  const sequenceVersionId = '99999999-8888-7777-6666-555555555555';

  beforeEach(() => {
    mockDb.reset();
    (globalThis as any).IDBKeyRange = {
      only: (val: any) => ({ upper: val, lower: val }),
    };

    (globalThis as any).indexedDB = {
      open: () => {
        const req: any = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: mockDb.createMockDB(),
        };
        setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
        return req;
      },
    };
  });

  describe('1. Durable Local Queue Persistence & Crash Resilience', () => {
    it('persists execution events to local IndexedDB queue with QUEUED state', async () => {
      const event1 = await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-001',
        eventType: 'SESSION_STARTED',
        stepOrder: 0,
        payload: { deltaSeconds: 0 },
      });

      expect(event1.clientEventUuid).toBe('evt-001');
      expect(event1.syncStatus).toBe('QUEUED');
      expect(event1.retryCount).toBe(0);

      const items = await getEventsBySession(sessionId);
      expect(items).toHaveLength(1);
      expect(items[0].eventType).toBe('SESSION_STARTED');
    });

    it('simulates browser termination / refresh: events survive and preserve sequence order', async () => {
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-001',
        eventType: 'STEP_STARTED',
        stepOrder: 0,
      });
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-002',
        eventType: 'STEP_COMPLETED',
        stepOrder: 0,
      });

      // Simulate browser refresh by re-querying from persisted storage
      const queuedEvents = await getEventsBySession(sessionId, ['QUEUED']);
      expect(queuedEvents).toHaveLength(2);
      expect(queuedEvents[0].clientEventUuid).toBe('evt-001');
      expect(queuedEvents[1].clientEventUuid).toBe('evt-002');
    });

    it('never silently discards unsynced events during prune operations', async () => {
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-synced-old',
        eventType: 'STEP_STARTED',
      });
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-unsynced-pending',
        eventType: 'STEP_COMPLETED',
      });

      // Mark the first event as SYNCED with old creation timestamp
      await updateEventsSyncStatus(['evt-synced-old'], 'SYNCED');
      const item = mockDb.store.get('evt-synced-old')!;
      item.createdAt = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days old
      mockDb.store.set('evt-synced-old', item);

      // Run prune with 7-day retention
      const deletedCount = await pruneSyncedEvents(7 * 24 * 60 * 60 * 1000);
      expect(deletedCount).toBe(1);

      // Unsynced event must still exist
      const remaining = await getEventsBySession(sessionId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].clientEventUuid).toBe('evt-unsynced-pending');
      expect(remaining[0].syncStatus).toBe('QUEUED');
    });
  });

  describe('2. Idempotent Synchronization & Partial Failure Handling', () => {
    it('synchronizes batch and marks acknowledged events SYNCED', async () => {
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-sync-1',
        eventType: 'STEP_STARTED',
        stepOrder: 1,
      });
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-sync-2',
        eventType: 'STEP_COMPLETED',
        stepOrder: 1,
      });

      const mockApi = vi.fn().mockResolvedValue({
        acknowledgedEventUuids: ['evt-sync-1', 'evt-sync-2'],
        alreadyProcessedEventUuids: [],
        failedEventUuids: [],
        currentState: { status: 'RUNNING' },
        syncedAt: new Date().toISOString(),
      });

      const result = await synchronizePendingEvents(sessionId, mockApi);
      expect(result.syncedCount).toBe(2);
      expect(result.failedCount).toBe(0);

      // Verify in store
      const all = await getEventsBySession(sessionId);
      expect(all.every((e) => e.syncStatus === 'SYNCED')).toBe(true);
    });

    it('handles partial synchronization where server acknowledges a subset of events', async () => {
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-ack',
        eventType: 'STEP_STARTED',
      });
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-unack',
        eventType: 'STEP_COMPLETED',
      });

      // Server only acknowledges 'evt-ack'
      const mockApi = vi.fn().mockResolvedValue({
        acknowledgedEventUuids: ['evt-ack'],
        alreadyProcessedEventUuids: [],
        failedEventUuids: [],
        currentState: { status: 'RUNNING' },
        syncedAt: new Date().toISOString(),
      });

      const result = await synchronizePendingEvents(sessionId, mockApi);
      expect(result.syncedCount).toBe(1);
      expect(result.failedCount).toBe(1);

      const ackItem = mockDb.store.get('evt-ack');
      const unackItem = mockDb.store.get('evt-unack');

      expect(ackItem?.syncStatus).toBe('SYNCED');
      expect(unackItem?.syncStatus).toBe('FAILED');
      expect(unackItem?.retryCount).toBe(1);
    });

    it('handles total network disconnect and retries on subsequent reconnect', async () => {
      await enqueueConductorEvent(sessionId, sequenceVersionId, {
        clientEventUuid: 'evt-offline-retry',
        eventType: 'STEP_STARTED',
      });

      // 1. First sync attempt fails with Network Error
      const failingApi = vi.fn().mockRejectedValue(new Error('Network offline: Connection refused'));
      const failureResult = await synchronizePendingEvents(sessionId, failingApi);
      expect(failureResult.syncedCount).toBe(0);
      expect(failureResult.failedCount).toBe(1);
      expect(failureResult.error).toContain('Network offline');

      const failedItem = mockDb.store.get('evt-offline-retry');
      expect(failedItem?.syncStatus).toBe('FAILED');
      expect(failedItem?.retryCount).toBe(1);

      // 2. Reconnect triggered: second sync attempt succeeds
      const successApi = vi.fn().mockResolvedValue({
        acknowledgedEventUuids: ['evt-offline-retry'],
        alreadyProcessedEventUuids: [],
        failedEventUuids: [],
        currentState: { status: 'RUNNING' },
        syncedAt: new Date().toISOString(),
      });

      const retryResult = await synchronizePendingEvents(sessionId, successApi);
      expect(retryResult.syncedCount).toBe(1);
      expect(retryResult.failedCount).toBe(0);

      const recoveredItem = mockDb.store.get('evt-offline-retry');
      expect(recoveredItem?.syncStatus).toBe('SYNCED');
      expect(recoveredItem?.lastError).toBeNull();
    });
  });

  describe('3. Conductor State Machine Reconciliation & Recovery Invariants', () => {
    it('reconciles progress monotonically and prevents step regression', () => {
      const serverSnapshot = {
        status: 'RUNNING' as const,
        currentStepIndex: 2,
        currentPhase: 'POSTURE_HOLD' as const,
        totalElapsedSeconds: 150,
        completedStepsCount: 2,
        skippedStepsCount: 0,
        addedTimeSeconds: 0,
      };

      const regressiveClient = {
        status: 'RUNNING' as const,
        currentStepIndex: 1, // Regressive
        completedStepsCount: 1, // Regressive
        totalElapsedSeconds: 90, // Regressive
      };

      const reconciled = ConductorStateMachine.reconcileProgress(serverSnapshot, regressiveClient);
      expect(reconciled.currentStepIndex).toBe(2);
      expect(reconciled.completedStepsCount).toBe(2);
      expect(reconciled.totalElapsedSeconds).toBe(150);
    });

    it('enforces invariant: client cannot automatically mark PAUSED session as COMPLETED', () => {
      const serverSnapshot = {
        status: 'PAUSED' as const,
        currentStepIndex: 3,
        currentPhase: 'POSTURE_HOLD' as const,
        totalElapsedSeconds: 300,
        completedStepsCount: 3,
        skippedStepsCount: 0,
        addedTimeSeconds: 0,
      };

      const clientClaim = {
        status: 'COMPLETED' as const, // Illegal completion without explicit resume
      };

      const reconciled = ConductorStateMachine.reconcileProgress(serverSnapshot, clientClaim);
      expect(reconciled.status).toBe('PAUSED');
    });

    it('enforces terminal invariant: terminal states cannot be resurrected', () => {
      const completedServer = {
        status: 'COMPLETED' as const,
        currentStepIndex: 5,
        currentPhase: 'POSTURE_HOLD' as const,
        totalElapsedSeconds: 600,
        completedStepsCount: 5,
        skippedStepsCount: 0,
        addedTimeSeconds: 0,
      };

      const clientRevival = {
        status: 'RUNNING' as const,
      };

      const reconciled = ConductorStateMachine.reconcileProgress(completedServer, clientRevival);
      expect(reconciled.status).toBe('COMPLETED');
    });

    it('allows valid recovery transitions from INTERRUPTED to RUNNING or INTERRUPTED_ABANDONED', () => {
      expect(ConductorStateMachine.isValidTransition('INTERRUPTED', 'RUNNING')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('INTERRUPTED', 'INTERRUPTED_ABANDONED')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('INTERRUPTED', 'COMPLETED')).toBe(false);
    });
  });
});
