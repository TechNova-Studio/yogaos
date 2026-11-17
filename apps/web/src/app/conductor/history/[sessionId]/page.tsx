'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import {
  ConductorSessionState,
  ConductorExecutionEventDetail,
  ConductorRecoveryResponse,
} from '@yogaos/contracts';
import { Badge, Button } from '@yogaos/ui';
import {
  getEventsBySession,
  QueuedConductorEvent,
} from '../../../../lib/conductor-event-queue';

export default function ConductorSessionEventHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user, activeTenantId } = useAuth();
  const client = getApiClient();

  const [session, setSession] = useState<ConductorSessionState | null>(null);
  const [serverEvents, setServerEvents] = useState<ConductorExecutionEventDetail[]>([]);
  const [localEvents, setLocalEvents] = useState<QueuedConductorEvent[]>([]);
  const [recoveryInfo, setRecoveryInfo] = useState<ConductorRecoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [sessData, eventsData, recoveryData] = await Promise.all([
          client.getConductorSession(sessionId),
          client.getConductorSessionEvents(sessionId),
          client.getConductorRecoveryState(sessionId),
        ]);
        setSession(sessData);
        setServerEvents(eventsData);
        setRecoveryInfo(recoveryData);

        // Fetch local IndexedDB events
        try {
          const local = await getEventsBySession(sessionId);
          setLocalEvents(local);
        } catch {
          // If IndexedDB not supported or empty, leave empty
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load session execution logs');
      } finally {
        setLoading(false);
      }
    }

    if (activeTenantId && sessionId) {
      loadData();
    }
  }, [activeTenantId, sessionId]);

  const serverEventUuids = new Set(serverEvents.map((e) => e.clientEventUuid));
  const unsyncedLocalEvents = localEvents.filter(
    (e) => !serverEventUuids.has(e.clientEventUuid) && e.syncStatus !== 'SYNCED'
  );

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
    } catch {
      return iso;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/conductor/history')}
            className="text-amber-500 hover:text-amber-400 text-xs font-semibold mb-2 inline-flex items-center gap-1"
          >
            ← Back to All Sessions
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Execution Event Audit Log</h1>
          <p className="text-slate-400 text-xs mt-1">
            Session Instance: <code className="text-slate-300">{sessionId}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session && (session.status === 'RUNNING' || session.status === 'PAUSED' || session.status === 'INTERRUPTED') && (
            <Button
              variant="primary"
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs"
              onClick={() => router.push(`/conductor/${sessionId}`)}
            >
              Resume in Conductor →
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto mb-6 bg-red-950/80 border border-red-700 rounded-lg p-4 text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading execution audit log...</div>
      ) : !session ? (
        <div className="text-center py-20 text-slate-400">Session not found.</div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Sequence</span>
              <span className="font-semibold text-slate-200 text-sm">{session.sequenceTitle}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Final Status</span>
              <span className="font-semibold text-slate-200 text-sm">
                <Badge variant={session.status === 'COMPLETED' ? 'default' : 'outline'}>
                  {session.status}
                </Badge>
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Total Duration</span>
              <span className="font-semibold text-slate-200 text-sm">
                {formatDuration(session.totalElapsedSeconds)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Steps Completion</span>
              <span className="font-semibold text-slate-200 text-sm">
                {session.completedStepsCount} / {session.totalSteps} (Skipped: {session.skippedStepsCount})
              </span>
            </div>
          </div>

          {/* Unsynced Local Events Alert Banner */}
          {unsyncedLocalEvents.length > 0 && (
            <div className="bg-amber-950/60 border border-amber-600/80 rounded-xl p-4 text-amber-200 text-xs">
              <div className="font-semibold text-sm mb-1">
                ⚠ {unsyncedLocalEvents.length} Unsynced Local Event(s) Found in Browser Cache
              </div>
              <p>
                These events were executed locally during offline or interrupted playback and have not yet been confirmed by the server.
                Reopen the Conductor while online to synchronize them.
              </p>
            </div>
          )}

          {/* Chronological Event Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400 mb-4">
              Chronological Execution Stream ({serverEvents.length + unsyncedLocalEvents.length} Events)
            </h2>

            <div className="space-y-3">
              {/* Render Server Events */}
              {serverEvents.map((event, idx) => (
                <div
                  key={event.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono w-6">#{idx + 1}</span>
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-900 text-slate-200 font-mono text-[11px]"
                    >
                      {event.eventType}
                    </Badge>
                    {event.stepOrder !== null && (
                      <span className="text-slate-400">Step {event.stepOrder + 1}</span>
                    )}
                    {event.isOfflineSync ? (
                      <Badge variant="outline" className="border-indigo-500/70 text-indigo-400 text-[10px]">
                        Offline Synced
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/70 text-emerald-400 text-[10px]">
                        Server Confirmed
                      </Badge>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] sm:text-right">
                    <span>{formatTimestamp(event.clientTimestamp)}</span>
                  </div>
                </div>
              ))}

              {/* Render Unsynced Local Events */}
              {unsyncedLocalEvents.map((event, idx) => (
                <div
                  key={event.clientEventUuid}
                  className="bg-amber-950/40 border border-amber-800/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-amber-500 font-mono w-6">#{serverEvents.length + idx + 1}</span>
                    <Badge variant="outline" className="border-amber-600 bg-amber-950 text-amber-200 font-mono text-[11px]">
                      {event.eventType}
                    </Badge>
                    {event.stepOrder !== null && (
                      <span className="text-amber-300">Step {event.stepOrder + 1}</span>
                    )}
                    <Badge variant="outline" className="border-amber-500 text-amber-400 text-[10px]">
                      Local Queue ({event.syncStatus})
                    </Badge>
                  </div>
                  <div className="text-amber-400 font-mono text-[11px] sm:text-right">
                    <span>{formatTimestamp(event.clientTimestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
