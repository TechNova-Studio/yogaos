'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import {
  ConductorSessionState,
  ConductorActionType,
  ConductorSessionMediaManifest,
  ConductorContentMode,
} from '@yogaos/contracts';
import { Badge, Button } from '@yogaos/ui';
import {
  prepareSessionMediaOffline,
  revalidateSessionReadiness,
  getLocalMediaBlobUrl,
  getStorageQuotaEstimate,
  StorageQuotaInfo,
  SessionPreparationProgress,
} from '../../../lib/offline-media-storage';
import {
  enqueueConductorEvent,
  getEventsBySession,
  synchronizePendingEvents,
  updateEventsSyncStatus,
} from '../../../lib/conductor-event-queue';

function actionToEventType(action: ConductorActionType): any {
  switch (action) {
    case 'START':
      return 'SESSION_STARTED';
    case 'PAUSE':
      return 'SESSION_PAUSED';
    case 'RESUME':
      return 'SESSION_RESUMED';
    case 'NEXT_STEP':
      return 'STEP_COMPLETED';
    case 'PREVIOUS_STEP':
      return 'STEP_PREVIOUS';
    case 'SKIP_STEP':
      return 'STEP_SKIPPED';
    case 'ADJUST_TIME':
      return 'TIME_ADJUSTED';
    case 'END_SESSION':
      return 'SESSION_INTERRUPTED';
    default:
      return 'STEP_STARTED';
  }
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ConductorWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user, activeTenantId } = useAuth();
  const client = getApiClient();

  const [session, setSession] = useState<ConductorSessionState | null>(null);
  const [manifest, setManifest] = useState<ConductorSessionMediaManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showPrepModal, setShowPrepModal] = useState(false);

  // Network Online / Offline State
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Storage Quota State
  const [storageInfo, setStorageInfo] = useState<StorageQuotaInfo | null>(null);

  // Offline Preparation Progress
  const [prepProgress, setPrepProgress] = useState<SessionPreparationProgress | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  // P18: Durable Queue, Recovery & Sync State
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState<boolean>(false);

  // Local Media Blobs for Active Step
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [mediaPlaybackError, setMediaPlaybackError] = useState<string | null>(null);

  // High precision wall-clock countdown state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [phaseTargetDuration, setPhaseTargetDuration] = useState<number>(0);

  // Wall clock anchoring refs
  const phaseStartTimeRef = useRef<number>(Date.now());
  const targetDurationRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const sessionRef = useRef<ConductorSessionState | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);

  sessionRef.current = session;
  isRunningRef.current = session?.status === 'RUNNING';

  // Monitor Browser Connectivity
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor Storage Estimate
  useEffect(() => {
    getStorageQuotaEstimate().then(setStorageInfo);
  }, [showPrepModal]);

  // 1. Initial Load / Init Session & Media Manifest
  const initOrLoadSession = useCallback(async () => {
    if (!sessionId || !activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      let sessionData: ConductorSessionState;

      try {
        sessionData = await client.getConductorSession(sessionId);
      } catch (err: any) {
        sessionData = await client.initConductorSession({
          sessionInstanceId: sessionId,
          clientSessionUuid: generateUuid(),
        });
      }

      setSession(sessionData);

      // Check for unfinished / interrupted session requiring recovery prompt
      if (sessionData.status === 'PAUSED' || sessionData.status === 'INTERRUPTED') {
        setShowRecoveryBanner(true);
      }

      // Check durable queue for unsynced events
      try {
        const queued = await getEventsBySession(sessionId, ['QUEUED', 'FAILED']);
        setUnsyncedCount(queued.length);
        if (queued.length > 0 && (sessionData.status === 'PAUSED' || sessionData.status === 'INTERRUPTED')) {
          setShowRecoveryBanner(true);
        }
      } catch {}

      // Load session media manifest
      try {
        const manifestData = await client.getConductorMediaManifest(sessionId);
        setManifest(manifestData);

        // If session not OFFLINE_READY, prompt prep modal if assets exist
        if (!sessionData.isOfflineReady && manifestData.assets.length > 0 && sessionData.status === 'READY') {
          setShowPrepModal(true);
        }
      } catch (manifestErr: any) {
        console.warn('Could not load media manifest:', manifestErr.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize conductor session');
    } finally {
      setLoading(false);
    }
  }, [sessionId, activeTenantId]);

  useEffect(() => {
    initOrLoadSession();
  }, [initOrLoadSession]);

  // 2. Audio Context Unlocker for Sound Guidance
  const handleUnlockAudio = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        setAudioUnlocked(true);
      }
    } catch {
      setAudioUnlocked(true);
    }
  };

  // 3. Offline Media Preparation Workflow
  const handleStartPreparation = async () => {
    if (!manifest || !sessionId) return;
    try {
      setIsPreparing(true);
      setError(null);

      // Submit preparation started
      await client.submitConductorPreparation(sessionId, {
        clientEventUuid: generateUuid(),
        status: 'PREPARING',
        clientTimestamp: new Date().toISOString(),
      });

      // Execute local downloads & SHA-256 verification
      const prepResult = await prepareSessionMediaOffline(manifest, (progress) => {
        setPrepProgress(progress);
      });

      const quota = await getStorageQuotaEstimate();
      setStorageInfo(quota);

      if (prepResult.success) {
        // Persist OFFLINE_READY state on backend
        const updatedSession = await client.submitConductorPreparation(sessionId, {
          clientEventUuid: generateUuid(),
          status: 'OFFLINE_READY',
          verifiedAssetsCount: manifest.assets.length,
          totalBytesVerified: manifest.totalBytes,
          storageAvailableBytes: quota.availableBytes,
          clientTimestamp: new Date().toISOString(),
        });
        setSession(updatedSession);
        setShowPrepModal(false);
      } else {
        // Report verification failure
        await client.submitConductorPreparation(sessionId, {
          clientEventUuid: generateUuid(),
          status: 'VERIFICATION_FAILED',
          verificationErrors: prepResult.errors,
          clientTimestamp: new Date().toISOString(),
        });
        setError('Media verification failed. Please review corrupted or incomplete assets.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during offline preparation');
    } finally {
      setIsPreparing(false);
    }
  };

  // 4. Dispatch Conductor Action with Idempotency Key & Durable Local Queue
  const handleAction = async (action: ConductorActionType, deltaSeconds?: number) => {
    if (!sessionId || !session) return;
    try {
      setError(null);
      // Pre-flight check: if starting class, verify offline readiness or assets
      if (action === 'START' && manifest && manifest.assets.length > 0) {
        const check = await revalidateSessionReadiness(manifest);
        if (!check.isReady) {
          setError(
            `Session media is incomplete. Missing ${check.missingAssetIds.length} asset(s). Please prepare offline media first.`
          );
          setShowPrepModal(true);
          return;
        }
      }

      const eventUuid = generateUuid();
      const nowIso = new Date().toISOString();

      // 1. Enqueue to durable local queue (IndexedDB)
      try {
        await enqueueConductorEvent(sessionId, session.sequenceVersionId, {
          clientEventUuid: eventUuid,
          eventType: actionToEventType(action),
          stepOrder: session.currentStepIndex,
          clientTimestamp: nowIso,
          payload: { deltaSeconds, action },
        });
        const queued = await getEventsBySession(sessionId, ['QUEUED', 'FAILED']);
        setUnsyncedCount(queued.length);
      } catch (queueErr) {
        console.warn('Local enqueue error:', queueErr);
      }

      // 2. Dispatch action live if online
      if (isOnline) {
        try {
          const updated = await client.sendConductorAction(sessionId, {
            action,
            clientEventUuid: eventUuid,
            clientTimestamp: nowIso,
            currentStepIndex: session.currentStepIndex,
            deltaSeconds,
          });
          setSession(updated);

          // Mark event as synced in IndexedDB
          try {
            await updateEventsSyncStatus([eventUuid], 'SYNCED');
            const remaining = await getEventsBySession(sessionId, ['QUEUED', 'FAILED']);
            setUnsyncedCount(remaining.length);
          } catch {}
          return;
        } catch (serverErr: any) {
          console.warn('Action server sync deferred to offline queue:', serverErr.message);
        }
      }
    } catch (err: any) {
      setError(err.message || `Failed to execute action ${action}`);
    }
  };

  // Manual & Reconnect Synchronization
  const handleManualSync = useCallback(async () => {
    if (!sessionId || !session || isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await synchronizePendingEvents(
        sessionId,
        (batch) => client.syncConductorEvents(sessionId, batch),
        {
          currentStepIndex: session.currentStepIndex,
          currentPhase: session.currentPhase,
          completedStepsCount: session.completedStepsCount,
          skippedStepsCount: session.skippedStepsCount,
          totalElapsedSeconds: session.totalElapsedSeconds,
          status: session.status,
        }
      );
      if (result.serverState) {
        setSession(result.serverState);
      }
      const remaining = await getEventsBySession(sessionId, ['QUEUED', 'FAILED']);
      setUnsyncedCount(remaining.length);
      if (result.error) {
        setSyncError(result.error);
      }
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [sessionId, session, isSyncing, client]);

  // Explicit Session Recovery (Resume / Abandon)
  const handleRecoverSession = async (action: 'RESUME' | 'ABANDON') => {
    if (!sessionId) return;
    try {
      setError(null);
      const eventUuid = generateUuid();
      const updated = await client.recoverConductorSession(sessionId, {
        action,
        clientEventUuid: eventUuid,
      });
      setSession(updated);
      setShowRecoveryBanner(false);
    } catch (err: any) {
      setError(err.message || `Failed to ${action.toLowerCase()} session`);
    }
  };

  // Auto-sync when reconnecting online
  useEffect(() => {
    if (isOnline && unsyncedCount > 0) {
      handleManualSync();
    }
  }, [isOnline, unsyncedCount, handleManualSync]);

  // 5. Load Local Offline Media Blobs for Active Step
  useEffect(() => {
    const step = session?.currentStep;
    if (!step) {
      setLocalVideoUrl(null);
      setLocalImageUrl(null);
      setLocalAudioUrl(null);
      return;
    }

    setMediaPlaybackError(null);
    let isCancelled = false;

    async function loadStepMedia() {
      // 1. Video
      if (step?.demoVideoMediaId) {
        const localBlob = await getLocalMediaBlobUrl(step.demoVideoMediaId);
        if (!isCancelled) {
          setLocalVideoUrl(localBlob || (!isOnline ? null : step.demoVideoUrl || null));
        }
      } else {
        setLocalVideoUrl(null);
      }

      // 2. Image
      if (step?.referenceImageMediaId) {
        const localBlob = await getLocalMediaBlobUrl(step.referenceImageMediaId);
        if (!isCancelled) {
          setLocalImageUrl(localBlob || (!isOnline ? null : step.referenceImageUrl || null));
        }
      } else {
        setLocalImageUrl(null);
      }

      // 3. Audio
      if (step?.voiceAudioMediaId) {
        const localBlob = await getLocalMediaBlobUrl(step.voiceAudioMediaId);
        if (!isCancelled) {
          setLocalAudioUrl(localBlob || (!isOnline ? null : step.voiceAudioUrl || null));
        }
      } else {
        setLocalAudioUrl(null);
      }
    }

    loadStepMedia();

    return () => {
      isCancelled = true;
    };
  }, [session?.currentStepIndex, session?.currentStep?.id, isOnline]);

  // Synchronized Playback trigger on Step & Phase changes
  useEffect(() => {
    if (session?.status !== 'RUNNING') {
      if (audioElemRef.current) audioElemRef.current.pause();
      if (videoElemRef.current) videoElemRef.current.pause();
      return;
    }

    // If rest interval, pause demo video
    if (session.currentPhase === 'REST_INTERVAL') {
      if (videoElemRef.current) videoElemRef.current.pause();
      return;
    }

    // Play active video
    if (videoElemRef.current && localVideoUrl) {
      videoElemRef.current.currentTime = 0;
      videoElemRef.current.play().catch(() => {});
    }

    // Play active audio instruction
    if (audioElemRef.current && localAudioUrl && audioUnlocked) {
      audioElemRef.current.currentTime = 0;
      audioElemRef.current.play().catch((err) => {
        console.warn('Audio playback waiting for user gesture unlock:', err);
      });
    }
  }, [
    session?.currentStepIndex,
    session?.currentPhase,
    session?.status,
    localVideoUrl,
    localAudioUrl,
    audioUnlocked,
  ]);

  // 6. Sync Wall-Clock Timer with Active Step/Phase
  useEffect(() => {
    if (!session || !session.currentStep) return;

    let targetDuration = 30; // default
    if (session.currentPhase === 'REST_INTERVAL') {
      targetDuration = session.currentStep.restIntervalSeconds || 10;
    } else if (session.currentStep.executionMode === 'TIME_HOLD') {
      targetDuration = session.currentStep.durationSeconds;
    } else if (session.currentStep.executionMode === 'BREATH_COUNT') {
      targetDuration = (session.currentStep.repetitionCount || 5) * 4;
    } else {
      targetDuration = 60;
    }

    targetDuration += session.addedTimeSeconds;
    targetDurationRef.current = targetDuration;
    setPhaseTargetDuration(targetDuration);
    phaseStartTimeRef.current = Date.now();
    setSecondsRemaining(targetDuration);
  }, [
    session?.currentStepIndex,
    session?.currentPhase,
    session?.addedTimeSeconds,
    session?.id,
  ]);

  // 7. Wall-Clock requestAnimationFrame / Interval Tick Engine against Timer Drift
  useEffect(() => {
    if (session?.status !== 'RUNNING') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - phaseStartTimeRef.current) / 1000);
      const remaining = Math.max(0, targetDurationRef.current - elapsedSeconds);
      setSecondsRemaining(remaining);

      // Automatic progression on timer expiration for TIME_HOLD
      if (remaining === 0 && sessionRef.current?.status === 'RUNNING') {
        const curStep = sessionRef.current.currentStep;
        if (curStep && curStep.executionMode === 'TIME_HOLD') {
          handleAction('NEXT_STEP');
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [session?.status]);

  // 8. Anti-Drift: Re-sync on Tab Visibility Change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunningRef.current) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - phaseStartTimeRef.current) / 1000);
        const remaining = Math.max(0, targetDurationRef.current - elapsedSeconds);
        setSecondsRemaining(remaining);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 9. Session Heartbeat every 25 seconds
  useEffect(() => {
    if (!session || session.status === 'COMPLETED' || session.status === 'INTERRUPTED_ABANDONED') return;

    const heartbeatInterval = setInterval(() => {
      if (isOnline) {
        handleAction('HEARTBEAT');
      }
    }, 25000);

    return () => clearInterval(heartbeatInterval);
  }, [session?.id, session?.status, isOnline]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const currentStep = session?.currentStep;
  const nextStep = session?.nextStep;
  const progressPercent = session && session.totalSteps > 0
    ? Math.round(((session.currentStepIndex + (session.status === 'COMPLETED' ? 1 : 0)) / session.totalSteps) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 text-stone-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 font-mono text-sm tracking-widest uppercase">Initializing Conductor Engine...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 p-6 text-stone-100">
        <div className="max-w-md rounded-2xl border border-red-800 bg-stone-900 p-8 text-center shadow-2xl">
          <h2 className="text-xl font-bold text-red-400">Conductor Launch Error</h2>
          <p className="mt-3 text-sm text-stone-300">{error || 'Session not found'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => router.push('/classes/schedule')}>
              Back to Schedule
            </Button>
            <Button onClick={initOrLoadSession}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  // Terminal Completed State View
  if (session?.status === 'COMPLETED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 p-6 text-stone-100">
        <div className="w-full max-w-lg rounded-3xl border border-emerald-800 bg-stone-900 p-10 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-4xl">
            🙏
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Class Completed</h1>
          <p className="mt-2 text-stone-400">Namaste! You have successfully completed this sequence.</p>

          <div className="mt-8 grid grid-cols-3 gap-4 border-y border-stone-800 py-6">
            <div>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                {formatTime(session.totalElapsedSeconds)}
              </div>
              <div className="text-xs uppercase tracking-wider text-stone-500">Duration</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-white">{session.completedStepsCount}</div>
              <div className="text-xs uppercase tracking-wider text-stone-500">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-amber-400">{session.skippedStepsCount}</div>
              <div className="text-xs uppercase tracking-wider text-stone-500">Skipped</div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <Button onClick={() => router.push('/classes/schedule')}>Return to Schedule</Button>
          </div>
        </div>
      </div>
    );
  }

  // Terminal Interrupted Abandoned State View
  if (session?.status === 'INTERRUPTED_ABANDONED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 p-6 text-stone-100">
        <div className="w-full max-w-lg rounded-3xl border border-red-900 bg-stone-900 p-10 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 text-4xl">
            ⏹️
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">Class Concluded & Abandoned</h1>
          <p className="mt-2 text-sm text-stone-400">
            This session is in a terminal abandoned state and cannot be resumed.
          </p>
          <div className="mt-6 text-xs text-stone-500 font-mono">
            Elapsed: {formatTime(session.totalElapsedSeconds)} • Steps: {session.completedStepsCount} completed
          </div>
          <div className="mt-8 flex justify-center gap-4">
            <Button onClick={() => router.push('/classes/schedule')}>Return to Schedule</Button>
            <Button variant="outline" onClick={() => router.push('/conductor/history')}>
              View History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Interrupted State with Explicit Recovery Option
  if (session?.status === 'INTERRUPTED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 p-6 text-stone-100">
        <div className="w-full max-w-lg rounded-3xl border border-amber-800 bg-stone-900 p-10 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-4xl">
            ⚠️
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">Class Interrupted</h1>
          <p className="mt-2 text-sm text-stone-400">
            This class was interrupted. You may resume conducting from step {(session.currentStepIndex ?? 0) + 1} or permanently abandon the session.
          </p>
          <div className="mt-6 text-xs text-stone-400 font-mono">
            Elapsed: {formatTime(session.totalElapsedSeconds)} • Steps: {session.completedStepsCount} of {session.totalSteps} completed
          </div>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              onClick={() => handleRecoverSession('RESUME')}
            >
              Resume Class Now
            </Button>
            <Button
              variant="outline"
              className="border-red-700 text-red-300 hover:bg-red-950"
              onClick={() => handleRecoverSession('ABANDON')}
            >
              Abandon Session
            </Button>
            <Button variant="ghost" onClick={() => router.push('/classes/schedule')}>
              Exit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 text-stone-100 select-none">
      {/* Top Header Bar */}
      <header className="flex h-16 items-center justify-between border-b border-stone-800 px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/classes/schedule')}
            className="rounded-lg border border-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-400 hover:bg-stone-900 hover:text-white"
          >
            ← Exit
          </button>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">{session?.sequenceTitle}</h1>
            <div className="text-xs text-stone-400">
              Step {(session?.currentStepIndex ?? 0) + 1} of {session?.totalSteps}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Online / Offline Connectivity Pill */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs border ${
              isOnline
                ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
                : 'border-amber-700 bg-amber-950/80 text-amber-200'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
          </div>

          {/* Durable Queue Sync Pill */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs border transition ${
              isSyncing
                ? 'border-sky-700 bg-sky-950/80 text-sky-300 animate-pulse'
                : unsyncedCount > 0
                ? 'border-amber-600 bg-amber-950 text-amber-200 hover:bg-amber-900 cursor-pointer'
                : 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
            }`}
          >
            {isSyncing ? (
              <span>🔄 SYNCING...</span>
            ) : unsyncedCount > 0 ? (
              <span>⚠️ {unsyncedCount} UNSYNCED (SYNC)</span>
            ) : (
              <span>✓ SYNCED</span>
            )}
          </button>

          {/* Session History Shortcut */}
          <button
            onClick={() => router.push('/conductor/history')}
            className="hidden lg:inline-flex rounded-full border border-stone-800 px-3 py-1 text-xs text-stone-400 hover:bg-stone-900 hover:text-white"
          >
            📋 History
          </button>

          {/* Offline Readiness Pill */}
          <button
            onClick={() => setShowPrepModal(true)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition ${
              session?.isOfflineReady
                ? 'border-emerald-700 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/50'
                : 'border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900/50'
            }`}
          >
            {session?.isOfflineReady ? '✓ OFFLINE READY' : '📥 PREPARE MEDIA'}
          </button>

          {!audioUnlocked && (
            <button
              onClick={handleUnlockAudio}
              className="rounded-full bg-amber-600/30 border border-amber-500/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-600/50"
            >
              🔔 Enable Chimes
            </button>
          )}

          <div className="hidden sm:block rounded-full bg-stone-900 px-3 py-1 font-mono text-xs text-stone-300 border border-stone-800">
            Total Elapsed: {formatTime(session?.totalElapsedSeconds || 0)}
          </div>

          <Badge
            variant={
              session?.status === 'RUNNING'
                ? 'success'
                : session?.status === 'PAUSED'
                ? 'warning'
                : session?.status === 'OFFLINE_READY'
                ? 'default'
                : 'outline'
            }
          >
            {session?.status}
          </Badge>
        </div>
      </header>

      {/* Recovery Banner for Paused / Unfinished State */}
      {showRecoveryBanner && session && session.status === 'PAUSED' && (
        <div className="bg-amber-950/90 border-b border-amber-700 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>
              <strong>Unfinished Class Session:</strong> Session is paused at step {(session.currentStepIndex ?? 0) + 1} of {session.totalSteps}.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 px-3"
              onClick={() => handleAction('RESUME')}
            >
              Resume Class
            </Button>
            <Button
              variant="outline"
              className="border-red-700 text-red-300 hover:bg-red-950 text-xs h-7 px-3"
              onClick={() => handleRecoverSession('ABANDON')}
            >
              Abandon Session
            </Button>
            <button
              onClick={() => setShowRecoveryBanner(false)}
              className="text-amber-400 hover:text-white px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar Across Screen */}
      <div className="h-1.5 w-full bg-stone-900">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Non-intrusive Media Playback Error Banner */}
      {mediaPlaybackError && (
        <div className="bg-amber-950/80 border-b border-amber-800 px-6 py-2 text-xs text-amber-200 flex items-center justify-between">
          <span>⚠️ {mediaPlaybackError}</span>
          <button onClick={() => setMediaPlaybackError(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Main High-Contrast Conductor Layout */}
      <main className="flex-1 p-6 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Left / Center: Primary Focus Hero Card */}
        <section className="flex-1 flex flex-col justify-between rounded-3xl border border-stone-800 bg-stone-900/80 p-8 shadow-2xl backdrop-blur-md">
          {session?.currentPhase === 'REST_INTERVAL' ? (
            /* Rest Interval Display */
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <span className="rounded-full bg-sky-950 border border-sky-600 px-4 py-1 text-xs font-bold tracking-widest uppercase text-sky-300">
                Rest & Transition
              </span>
              <div className="mt-8 font-mono text-7xl md:text-8xl font-black text-sky-400">
                {formatTime(secondsRemaining)}
              </div>
              <p className="mt-6 text-lg text-stone-300">Deep conscious breaths. Prepare for next posture.</p>
              {currentStep?.transitionNotes && (
                <div className="mt-4 max-w-md rounded-xl bg-stone-950 p-4 text-sm text-stone-400 border border-stone-800">
                  <span className="font-semibold text-stone-300">Transition Cue: </span>
                  {currentStep.transitionNotes}
                </div>
              )}
            </div>
          ) : (
            /* Active Asana Display with 4 Content Modes */
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-stone-800 px-2.5 py-1 font-mono text-xs text-stone-300 font-semibold">
                      #{(session?.currentStepIndex ?? 0) + 1}
                    </span>
                    {currentStep?.isBilateral && (
                      <span
                        className={`rounded px-3 py-1 text-xs font-black tracking-wider uppercase ${
                          session?.currentPhase === 'BILATERAL_SIDE_A'
                            ? 'bg-amber-600 text-amber-950'
                            : 'bg-indigo-600 text-indigo-100'
                        }`}
                      >
                        {session?.currentPhase === 'BILATERAL_SIDE_A' ? 'SIDE A (RIGHT)' : 'SIDE B (LEFT)'}
                      </span>
                    )}
                    <span className="rounded bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-400">
                      Mode: {currentStep?.executionMode.replace('_', ' ')}
                    </span>
                    {currentStep?.contentMode && currentStep.contentMode !== 'NONE' && (
                      <span className="rounded bg-emerald-950 border border-emerald-800 px-2.5 py-1 text-xs font-bold text-emerald-300">
                        {currentStep.contentMode.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {session?.addedTimeSeconds !== 0 && (
                    <span className="text-xs font-mono text-amber-400">
                      Adj: {(session?.addedTimeSeconds ?? 0) > 0 ? `+${session?.addedTimeSeconds}s` : `${session?.addedTimeSeconds}s`}
                    </span>
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    {currentStep?.asanaName}
                  </h2>
                  <p className="mt-1 text-xl md:text-2xl font-serif italic text-emerald-400">
                    {currentStep?.sanskritName}
                  </p>
                </div>

                {/* Content Mode 1: Video Playback */}
                {currentStep?.contentMode === 'VIDEO' && localVideoUrl && (
                  <div className="my-4 rounded-2xl overflow-hidden border border-stone-800 bg-black aspect-video max-h-72 mx-auto">
                    <video
                      ref={videoElemRef}
                      src={localVideoUrl}
                      playsInline
                      loop
                      controls
                      className="w-full h-full object-contain"
                      onError={() => setMediaPlaybackError('Offline video demonstration failed to load')}
                    />
                  </div>
                )}

                {/* Content Mode 2: Static Image Posture */}
                {currentStep?.contentMode === 'IMAGE' && localImageUrl && (
                  <div className="my-4 rounded-2xl overflow-hidden border border-stone-800 bg-stone-950 max-h-72 flex justify-center">
                    <img
                      src={localImageUrl}
                      alt={currentStep.asanaName}
                      className="h-72 object-contain"
                      onError={() => setMediaPlaybackError('Offline posture reference image failed to load')}
                    />
                  </div>
                )}

                {/* Content Mode 4: Image Synchronized with Voice Guidance */}
                {currentStep?.contentMode === 'IMAGE_WITH_VOICE' && (
                  <div className="my-4 flex flex-col md:flex-row items-center gap-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                    {localImageUrl && (
                      <img
                        src={localImageUrl}
                        alt={currentStep.asanaName}
                        className="h-44 rounded-xl object-contain border border-stone-800"
                        onError={() => setMediaPlaybackError('Offline posture image failed to load')}
                      />
                    )}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="text-xs uppercase font-bold text-emerald-400 flex items-center gap-2">
                        <span>🎙️ Voice Guidance Synchronized</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      </div>
                      <p className="text-xs text-stone-400 mt-1">
                        Alignment and breathing cues are playing in sync with posture visualization.
                      </p>
                      {localAudioUrl && (
                        <audio
                          ref={audioElemRef}
                          src={localAudioUrl}
                          controls
                          className="mt-3 w-full h-8"
                          onError={() => setMediaPlaybackError('Offline voice audio failed to load')}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Content Mode 3: Audio Only Guidance */}
                {currentStep?.contentMode === 'AUDIO_ONLY' && (
                  <div className="my-4 rounded-2xl border border-stone-800 bg-stone-950 p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-emerald-950 border border-emerald-700 flex items-center justify-center text-2xl">
                      🎧
                    </div>
                    <div className="flex-1">
                      <div className="text-xs uppercase font-bold text-emerald-400">Audio Guidance Active</div>
                      <p className="text-xs text-stone-400">Listen closely to breathing and hold instructions.</p>
                      {localAudioUrl && (
                        <audio
                          ref={audioElemRef}
                          src={localAudioUrl}
                          controls
                          className="mt-2 w-full h-8"
                          onError={() => setMediaPlaybackError('Offline voice instruction audio failed to load')}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Big Giant Wall-Clock Countdown */}
                <div className="my-6 flex justify-center">
                  <div className="rounded-3xl border border-stone-800 bg-stone-950/80 px-10 py-5 text-center shadow-inner">
                    <div className="font-mono text-7xl md:text-8xl font-black tracking-tight text-white">
                      {formatTime(secondsRemaining)}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-widest text-stone-500">
                      {currentStep?.executionMode === 'BREATH_COUNT'
                        ? `${currentStep.repetitionCount || 5} Breaths Total`
                        : 'Hold Time Remaining'}
                    </div>
                  </div>
                </div>

                {/* Teacher Alignment Cues */}
                {currentStep?.cues && (
                  <div className="mt-3 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500">Alignment Cues</h3>
                    <p className="mt-1 text-sm text-stone-200 leading-relaxed">{currentStep.cues}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Sidebar: Next Up Preview & Session Outline */}
        <aside className="w-full md:w-80 flex flex-col gap-6">
          {/* Next Up Preview Card */}
          <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6 backdrop-blur-sm">
            <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Next Posture</h4>
            {nextStep ? (
              <div className="mt-4">
                <div className="text-lg font-bold text-white">{nextStep.asanaName}</div>
                <div className="text-xs font-serif italic text-emerald-400">{nextStep.sanskritName}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-stone-400">
                  <span>⏱️ {nextStep.durationSeconds}s</span>
                  {nextStep.isBilateral && <span className="text-amber-400">• Bilateral</span>}
                </div>
                {nextStep.cues && (
                  <p className="mt-3 text-xs text-stone-400 line-clamp-2 italic">“{nextStep.cues}”</p>
                )}
              </div>
            ) : (
              <div className="mt-4 text-sm text-stone-500 italic">This is the final posture of the sequence.</div>
            )}
          </div>

          {/* Quick Metrics & Storage Card */}
          <div className="rounded-3xl border border-stone-800 bg-stone-900/40 p-6 flex-1 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Session Progress</h4>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-400">Completed Steps</span>
                  <span className="font-mono font-bold text-emerald-400">{session?.completedStepsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Skipped Steps</span>
                  <span className="font-mono font-bold text-amber-400">{session?.skippedStepsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Remaining</span>
                  <span className="font-mono text-stone-300">
                    {Math.max(0, (session?.totalSteps ?? 0) - ((session?.currentStepIndex ?? 0) + 1))}
                  </span>
                </div>
              </div>

              {manifest && (
                <div className="mt-6 border-t border-stone-800 pt-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-400">Offline Media Cache</h5>
                  <div className="mt-2 text-xs text-stone-300 space-y-1">
                    <div>Assets: {manifest.totalAssetsCount} files ({formatBytes(manifest.totalBytes)})</div>
                    <div>Status: {session?.isOfflineReady ? '✓ Verified in Local Storage' : '⚠️ Pending Verification'}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2 border-t border-stone-800 pt-4">
              <button
                onClick={() => setShowPrepModal(true)}
                className="w-full rounded-2xl border border-stone-700 bg-stone-800 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-300 hover:bg-stone-700"
              >
                Offline Preparation
              </button>
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full rounded-2xl border border-red-900/60 bg-red-950/40 py-2.5 text-xs font-bold uppercase tracking-wider text-red-300 hover:bg-red-900/60"
              >
                End Class Session
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Large Touch Transport Bar (Bottom Sticky) */}
      <footer className="sticky bottom-0 z-40 border-t border-stone-800 bg-stone-950/95 p-4 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => handleAction('PREVIOUS_STEP')}
            disabled={session?.currentStepIndex === 0}
            className="flex-1 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-200 font-bold hover:bg-stone-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-base"
          >
            ⏮️ Prev
          </button>

          <button
            onClick={() => handleAction('ADJUST_TIME', -30)}
            className="px-4 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-300 font-mono text-xs hover:bg-stone-800 active:scale-95"
            title="Subtract 30 seconds"
          >
            -30s
          </button>

          {/* Start button for READY or OFFLINE_READY */}
          {(session?.status === 'READY' || session?.status === 'OFFLINE_READY') && (
            <button
              onClick={() => handleAction('START')}
              className="flex-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg shadow-lg shadow-emerald-900/40 active:scale-95"
            >
              ▶️ START CLASS
            </button>
          )}

          {session?.status === 'RUNNING' && (
            <button
              onClick={() => handleAction('PAUSE')}
              className="flex-2 px-8 py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-lg shadow-lg shadow-amber-900/40 active:scale-95"
            >
              ⏸️ PAUSE
            </button>
          )}

          {session?.status === 'PAUSED' && (
            <button
              onClick={() => handleAction('RESUME')}
              className="flex-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg shadow-lg shadow-emerald-900/40 active:scale-95"
            >
              ▶️ RESUME
            </button>
          )}

          <button
            onClick={() => handleAction('ADJUST_TIME', 30)}
            className="px-4 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-300 font-mono text-xs hover:bg-stone-800 active:scale-95"
            title="Add 30 seconds"
          >
            +30s
          </button>

          <button
            onClick={() => handleAction('NEXT_STEP')}
            className="flex-1 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-200 font-bold hover:bg-stone-800 active:scale-95 text-base"
          >
            ⏭️ Next
          </button>

          <button
            onClick={() => handleAction('SKIP_STEP')}
            className="px-4 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-400 font-semibold text-xs hover:bg-stone-800 active:scale-95"
            title="Skip current posture completely"
          >
            ⏩ Skip
          </button>
        </div>
      </footer>

      {/* Offline Media Preparation Modal */}
      {showPrepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-3xl border border-stone-800 bg-stone-900 p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📥 Offline Media Preparation</span>
                  {session?.isOfflineReady && (
                    <span className="rounded-full bg-emerald-900/50 border border-emerald-600 px-2.5 py-0.5 text-xs text-emerald-300 font-semibold">
                      OFFLINE_READY
                    </span>
                  )}
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Download all instructional assets to browser Cache API to ensure zero network interruptions on the mat.
                </p>
              </div>
              <button
                onClick={() => setShowPrepModal(false)}
                className="text-stone-400 hover:text-white font-mono text-lg"
              >
                ✕
              </button>
            </div>

            {/* Storage Quota Overview */}
            {storageInfo && (
              <div className="mt-4 rounded-2xl bg-stone-950 p-4 border border-stone-800 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Device Storage Available:</span>
                  <span className="font-mono text-white font-bold">{formatBytes(storageInfo.availableBytes)}</span>
                </div>
                <div className="flex justify-between text-stone-400 mt-1">
                  <span>Required for this Sequence:</span>
                  <span className="font-mono text-emerald-400 font-bold">{formatBytes(manifest?.totalBytes || 0)}</span>
                </div>
              </div>
            )}

            {/* Assets List & Checksums */}
            <div className="mt-4 max-h-60 overflow-y-auto space-y-2 pr-1">
              {manifest?.assets.length === 0 ? (
                <div className="text-sm text-stone-500 italic p-4 text-center">
                  This sequence contains no media files. It is ready for offline practice!
                </div>
              ) : (
                manifest?.assets.map((a, idx) => {
                  const status = prepProgress?.assetStatuses[a.assetId]?.status || (session?.isOfflineReady ? 'READY' : 'PENDING');
                  const pct = prepProgress?.assetStatuses[a.assetId]?.progressPercent || (session?.isOfflineReady ? 100 : 0);

                  return (
                    <div
                      key={a.assetId}
                      className="rounded-xl border border-stone-800 bg-stone-950/60 p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-stone-800 px-2 py-0.5 font-mono text-[10px] text-stone-400">
                          {a.mediaType}
                        </span>
                        <div>
                          <div className="font-bold text-white truncate max-w-xs">{a.title}</div>
                          <div className="text-[10px] font-mono text-stone-500">
                            SHA-256: {a.sha256Hash.slice(0, 16)}... • {formatBytes(a.fileSize)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {status === 'READY' ? (
                          <span className="text-emerald-400 font-bold">✓ Verified</span>
                        ) : status === 'DOWNLOADING' ? (
                          <span className="text-sky-400 font-mono">{pct}%</span>
                        ) : status === 'FAILED' ? (
                          <span className="text-red-400 font-bold">⚠️ Failed</span>
                        ) : (
                          <span className="text-stone-500 font-mono">Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Preparation Actions */}
            <div className="mt-6 flex items-center justify-between border-t border-stone-800 pt-4">
              <div className="text-xs text-stone-400">
                {isOnline ? 'Online • Ready to download' : '⚠️ Offline • Connect to internet to download'}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPrepModal(false)}>
                  Close
                </Button>
                <Button
                  onClick={handleStartPreparation}
                  disabled={isPreparing || (!isOnline && !session?.isOfflineReady)}
                >
                  {isPreparing ? 'Verifying Hashes...' : session?.isOfflineReady ? 'Re-verify All Media' : 'Download & Verify Media'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Ending Session */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-stone-800 bg-stone-900 p-8 text-center shadow-2xl">
            <h3 className="text-xl font-bold text-white">End Class Session?</h3>
            <p className="mt-3 text-sm text-stone-400">
              Are you sure you want to end this class? This will conclude runtime recording and persist your final execution metrics.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button variant="outline" onClick={() => setShowEndConfirm(false)}>
                Cancel
              </Button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  handleAction('END_SESSION');
                }}
                className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-500"
              >
                Confirm End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
