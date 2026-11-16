'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { getApiClient } from '@yogaos/api-client';
import {
  ConductorSessionState,
  ConductorActionType,
  ConductorStepPhase,
} from '@yogaos/contracts';
import { Badge, Button } from '@yogaos/ui';

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
  const { user, activeTenantId, activeRole } = useAuth();
  const client = getApiClient();

  const [session, setSession] = useState<ConductorSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // High precision wall-clock countdown state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [phaseTargetDuration, setPhaseTargetDuration] = useState<number>(0);

  // Wall clock anchoring refs
  const phaseStartTimeRef = useRef<number>(Date.now());
  const targetDurationRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const sessionRef = useRef<ConductorSessionState | null>(null);

  sessionRef.current = session;
  isRunningRef.current = session?.status === 'RUNNING';

  // 1. Initial Load / Init Session
  const initOrLoadSession = useCallback(async () => {
    if (!sessionId || !activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      // Try fetching existing session first
      try {
        const existing = await client.getConductorSession(sessionId);
        setSession(existing);
      } catch (err: any) {
        // If not found, attempt to initialize it
        const initialized = await client.initConductorSession({
          sessionInstanceId: sessionId,
          clientSessionUuid: generateUuid(),
        });
        setSession(initialized);
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

  // 2. Audio Context Unlocker for Sound Chimes
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

  // 3. Dispatch Conductor Action with Idempotency Key
  const handleAction = async (action: ConductorActionType, deltaSeconds?: number) => {
    if (!sessionId || !session) return;
    try {
      const eventUuid = generateUuid();
      const updated = await client.sendConductorAction(sessionId, {
        action,
        clientEventUuid: eventUuid,
        clientTimestamp: new Date().toISOString(),
        currentStepIndex: session.currentStepIndex,
        deltaSeconds,
      });
      setSession(updated);
    } catch (err: any) {
      setError(err.message || `Failed to execute action ${action}`);
    }
  };

  // 4. Sync Wall-Clock Timer with Active Step/Phase
  useEffect(() => {
    if (!session || !session.currentStep) return;

    let targetDuration = 30; // default
    if (session.currentPhase === 'REST_INTERVAL') {
      targetDuration = session.currentStep.restIntervalSeconds || 10;
    } else if (session.currentStep.executionMode === 'TIME_HOLD') {
      // If bilateral, hold duration is typically per side
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

  // 5. Wall-Clock requestAnimationFrame / Interval Tick Engine against Timer Drift
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

  // 6. Anti-Drift: Re-sync on Tab Visibility Change
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

  // 7. Session Heartbeat every 25 seconds
  useEffect(() => {
    if (!session || session.status === 'COMPLETED' || session.status === 'INTERRUPTED_ABANDONED') return;

    const heartbeatInterval = setInterval(() => {
      handleAction('HEARTBEAT');
    }, 25000);

    return () => clearInterval(heartbeatInterval);
  }, [session?.id, session?.status]);

  // Formatting helpers
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  if (error || !session) {
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
  if (session.status === 'COMPLETED') {
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

  // Terminal Interrupted State View
  if (session.status === 'INTERRUPTED' || session.status === 'INTERRUPTED_ABANDONED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 p-6 text-stone-100">
        <div className="w-full max-w-lg rounded-3xl border border-amber-800 bg-stone-900 p-10 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-4xl">
            ⏹️
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">Class Interrupted</h1>
          <p className="mt-2 text-sm text-stone-400">
            {session.status === 'INTERRUPTED_ABANDONED'
              ? 'This session was abandoned due to heartbeat timeout (> 30 mins).'
              : 'This session was concluded early by the instructor.'}
          </p>
          <div className="mt-6 text-xs text-stone-500 font-mono">
            Elapsed: {formatTime(session.totalElapsedSeconds)} • Steps: {session.completedStepsCount} completed
          </div>
          <div className="mt-8 flex justify-center gap-4">
            <Button onClick={() => router.push('/classes/schedule')}>Return to Schedule</Button>
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
            <h1 className="text-base font-bold text-white tracking-wide">{session.sequenceTitle}</h1>
            <div className="text-xs text-stone-400">
              Step {session.currentStepIndex + 1} of {session.totalSteps}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!audioUnlocked && (
            <button
              onClick={handleUnlockAudio}
              className="rounded-full bg-amber-600/30 border border-amber-500/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-600/50"
            >
              🔔 Enable Chimes
            </button>
          )}

          <div className="rounded-full bg-stone-900 px-3 py-1 font-mono text-xs text-stone-300 border border-stone-800">
            Total Elapsed: {formatTime(session.totalElapsedSeconds)}
          </div>

          <Badge
            variant={
              session.status === 'RUNNING'
                ? 'success'
                : session.status === 'PAUSED'
                ? 'warning'
                : 'outline'
            }
          >
            {session.status}
          </Badge>
        </div>
      </header>

      {/* Progress Bar Across Screen */}
      <div className="h-1.5 w-full bg-stone-900">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main High-Contrast Conductor Layout */}
      <main className="flex-1 p-6 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Left / Center: Primary Focus Hero Card */}
        <section className="flex-1 flex flex-col justify-between rounded-3xl border border-stone-800 bg-stone-900/80 p-8 shadow-2xl backdrop-blur-md">
          {session.currentPhase === 'REST_INTERVAL' ? (
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
            /* Active Asana Display */
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-stone-800 px-2.5 py-1 font-mono text-xs text-stone-300 font-semibold">
                      #{session.currentStepIndex + 1}
                    </span>
                    {currentStep?.isBilateral && (
                      <span
                        className={`rounded px-3 py-1 text-xs font-black tracking-wider uppercase ${
                          session.currentPhase === 'BILATERAL_SIDE_A'
                            ? 'bg-amber-600 text-amber-950'
                            : 'bg-indigo-600 text-indigo-100'
                        }`}
                      >
                        {session.currentPhase === 'BILATERAL_SIDE_A' ? 'SIDE A (RIGHT)' : 'SIDE B (LEFT)'}
                      </span>
                    )}
                    <span className="rounded bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-400">
                      Mode: {currentStep?.executionMode.replace('_', ' ')}
                    </span>
                  </div>

                  {session.addedTimeSeconds !== 0 && (
                    <span className="text-xs font-mono text-amber-400">
                      Adj: {session.addedTimeSeconds > 0 ? `+${session.addedTimeSeconds}s` : `${session.addedTimeSeconds}s`}
                    </span>
                  )}
                </div>

                <div className="mt-8">
                  <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    {currentStep?.asanaName}
                  </h2>
                  <p className="mt-1 text-xl md:text-2xl font-serif italic text-emerald-400">
                    {currentStep?.sanskritName}
                  </p>
                </div>

                {/* Big Giant Wall-Clock Countdown */}
                <div className="my-8 flex justify-center">
                  <div className="rounded-3xl border border-stone-800 bg-stone-950/80 px-10 py-6 text-center shadow-inner">
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
                  <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500">Alignment Cues</h3>
                    <p className="mt-2 text-base text-stone-200 leading-relaxed">{currentStep.cues}</p>
                  </div>
                )}

                {currentStep?.teacherNotes && (
                  <div className="mt-3 rounded-2xl border border-stone-800/60 bg-stone-950/40 p-4">
                    <span className="text-xs font-semibold text-stone-400">Teaching Note: </span>
                    <span className="text-sm text-stone-300">{currentStep.teacherNotes}</span>
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

          {/* Quick Metrics */}
          <div className="rounded-3xl border border-stone-800 bg-stone-900/40 p-6 flex-1 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Session Progress</h4>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-400">Completed Steps</span>
                  <span className="font-mono font-bold text-emerald-400">{session.completedStepsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Skipped Steps</span>
                  <span className="font-mono font-bold text-amber-400">{session.skippedStepsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Remaining</span>
                  <span className="font-mono text-stone-300">
                    {Math.max(0, session.totalSteps - (session.currentStepIndex + 1))}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-stone-800 pt-4">
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full rounded-2xl border border-red-900/60 bg-red-950/40 py-3 text-xs font-bold uppercase tracking-wider text-red-300 hover:bg-red-900/60"
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
          {/* Previous Step */}
          <button
            onClick={() => handleAction('PREVIOUS_STEP')}
            disabled={session.currentStepIndex === 0}
            className="flex-1 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-200 font-bold hover:bg-stone-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-base"
          >
            ⏮️ Prev
          </button>

          {/* Time Adjustment Controls (-30s / +30s) */}
          <button
            onClick={() => handleAction('ADJUST_TIME', -30)}
            className="px-4 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-300 font-mono text-xs hover:bg-stone-800 active:scale-95"
            title="Subtract 30 seconds"
          >
            -30s
          </button>

          {/* Primary Play / Pause / Start Button */}
          {session.status === 'READY' && (
            <button
              onClick={() => handleAction('START')}
              className="flex-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg shadow-lg shadow-emerald-900/40 active:scale-95"
            >
              ▶️ START CLASS
            </button>
          )}

          {session.status === 'RUNNING' && (
            <button
              onClick={() => handleAction('PAUSE')}
              className="flex-2 px-8 py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-lg shadow-lg shadow-amber-900/40 active:scale-95"
            >
              ⏸️ PAUSE
            </button>
          )}

          {session.status === 'PAUSED' && (
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

          {/* Next / Advance Step */}
          <button
            onClick={() => handleAction('NEXT_STEP')}
            className="flex-1 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-200 font-bold hover:bg-stone-800 active:scale-95 text-base"
          >
            ⏭️ Next
          </button>

          {/* Skip Posture */}
          <button
            onClick={() => handleAction('SKIP_STEP')}
            className="px-4 py-4 rounded-2xl border border-stone-800 bg-stone-900 text-stone-400 font-semibold text-xs hover:bg-stone-800 active:scale-95"
            title="Skip current posture completely"
          >
            ⏩ Skip
          </button>
        </div>
      </footer>

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
