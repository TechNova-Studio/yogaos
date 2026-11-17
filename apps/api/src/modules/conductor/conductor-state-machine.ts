import {
  ConductorSessionStatus,
  ConductorStepPhase,
  ConductorActionType,
  ConductorStepView,
} from '@yogaos/contracts';

export class InvalidTransitionError extends Error {
  constructor(from: ConductorSessionStatus, to: ConductorSessionStatus) {
    super(`Invalid state transition from '${from}' to '${to}'`);
    this.name = 'InvalidTransitionError';
  }
}

export class TerminalStateError extends Error {
  constructor(status: ConductorSessionStatus) {
    super(`Cannot execute action on session in terminal state '${status}'`);
    this.name = 'TerminalStateError';
  }
}

export interface ConductorRuntimeSnapshot {
  status: ConductorSessionStatus;
  currentStepIndex: number;
  currentPhase: ConductorStepPhase;
  totalElapsedSeconds: number;
  completedStepsCount: number;
  skippedStepsCount: number;
  addedTimeSeconds: number;
}

export class ConductorStateMachine {
  private static readonly VALID_TRANSITIONS: Record<ConductorSessionStatus, ConductorSessionStatus[]> = {
    READY: ['OFFLINE_READY', 'RUNNING', 'INTERRUPTED', 'INTERRUPTED_ABANDONED'],
    OFFLINE_READY: ['RUNNING', 'READY', 'INTERRUPTED', 'INTERRUPTED_ABANDONED'],
    RUNNING: ['PAUSED', 'COMPLETED', 'INTERRUPTED', 'INTERRUPTED_ABANDONED'],
    PAUSED: ['RUNNING', 'COMPLETED', 'INTERRUPTED', 'INTERRUPTED_ABANDONED'],
    INTERRUPTED: ['RUNNING', 'PAUSED', 'INTERRUPTED_ABANDONED'],
    COMPLETED: [], // Terminal
    INTERRUPTED_ABANDONED: [], // Terminal
  };

  /**
   * Reconcile local state with server state.
   * Asserts valid transition invariants and prevents illegal automatic completions.
   */
  public static reconcileProgress(
    serverSnapshot: ConductorRuntimeSnapshot,
    localSnapshot?: Partial<ConductorRuntimeSnapshot>
  ): ConductorRuntimeSnapshot {
    if (!localSnapshot) {
      return serverSnapshot;
    }

    // Invariant: Terminal server states cannot be revived by client snapshots
    if (this.isTerminal(serverSnapshot.status)) {
      return serverSnapshot;
    }

    // Invariant: Never allow client to silently mark paused, interrupted, or abandoned sessions as COMPLETED
    let resolvedStatus = serverSnapshot.status;
    if (localSnapshot.status && localSnapshot.status !== serverSnapshot.status) {
      if (
        (serverSnapshot.status === 'PAUSED' ||
          serverSnapshot.status === 'INTERRUPTED' ||
          serverSnapshot.status === 'INTERRUPTED_ABANDONED') &&
        localSnapshot.status === 'COMPLETED'
      ) {
        // Disallow automatic transition to COMPLETED
        resolvedStatus = serverSnapshot.status;
      } else if (this.isValidTransition(serverSnapshot.status, localSnapshot.status)) {
        resolvedStatus = localSnapshot.status;
      }
    }

    // Advance forward monotonically
    const currentStepIndex = Math.max(
      serverSnapshot.currentStepIndex,
      localSnapshot.currentStepIndex ?? serverSnapshot.currentStepIndex
    );
    const completedStepsCount = Math.max(
      serverSnapshot.completedStepsCount,
      localSnapshot.completedStepsCount ?? serverSnapshot.completedStepsCount
    );
    const skippedStepsCount = Math.max(
      serverSnapshot.skippedStepsCount,
      localSnapshot.skippedStepsCount ?? serverSnapshot.skippedStepsCount
    );
    const totalElapsedSeconds = Math.max(
      serverSnapshot.totalElapsedSeconds,
      localSnapshot.totalElapsedSeconds ?? serverSnapshot.totalElapsedSeconds
    );
    const addedTimeSeconds = Math.max(
      serverSnapshot.addedTimeSeconds,
      localSnapshot.addedTimeSeconds ?? serverSnapshot.addedTimeSeconds
    );
    const currentPhase = localSnapshot.currentPhase ?? serverSnapshot.currentPhase;

    return {
      status: resolvedStatus,
      currentStepIndex,
      currentPhase,
      totalElapsedSeconds,
      completedStepsCount,
      skippedStepsCount,
      addedTimeSeconds,
    };
  }

  /**
   * Validates if transition from `from` to `to` is allowed.
   */
  public static isValidTransition(from: ConductorSessionStatus, to: ConductorSessionStatus): boolean {
    if (from === to) return true;
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Asserts transition is valid or throws InvalidTransitionError.
   */
  public static assertValidTransition(from: ConductorSessionStatus, to: ConductorSessionStatus): void {
    if (!this.isValidTransition(from, to)) {
      throw new InvalidTransitionError(from, to);
    }
  }

  /**
   * Check if state is terminal.
   */
  public static isTerminal(status: ConductorSessionStatus): boolean {
    return status === 'COMPLETED' || status === 'INTERRUPTED_ABANDONED';
  }

  /**
   * Computes the next step & phase when advancing forward.
   */
  public static computeNextProgression(
    currentStepIndex: number,
    currentPhase: ConductorStepPhase,
    steps: ConductorStepView[]
  ): {
    nextStepIndex: number;
    nextPhase: ConductorStepPhase;
    isFinished: boolean;
    stepCompleted: boolean;
  } {
    if (steps.length === 0 || currentStepIndex >= steps.length) {
      return {
        nextStepIndex: currentStepIndex,
        nextPhase: currentPhase,
        isFinished: true,
        stepCompleted: false,
      };
    }

    const currentStep = steps[currentStepIndex];

    // Case 1: Bilateral Side A -> Side B
    if (currentStep.isBilateral && currentPhase === 'BILATERAL_SIDE_A') {
      return {
        nextStepIndex: currentStepIndex,
        nextPhase: 'BILATERAL_SIDE_B',
        isFinished: false,
        stepCompleted: false,
      };
    }

    // Case 2: Posture hold or Bilateral Side B -> Rest Interval (if rest > 0)
    const isInPostureHold = currentPhase === 'POSTURE_HOLD' || currentPhase === 'BILATERAL_SIDE_B';
    if (isInPostureHold && currentStep.restIntervalSeconds > 0) {
      return {
        nextStepIndex: currentStepIndex,
        nextPhase: 'REST_INTERVAL',
        isFinished: false,
        stepCompleted: false,
      };
    }

    // Case 3: Transition to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) {
      return {
        nextStepIndex: currentStepIndex,
        nextPhase: currentPhase,
        isFinished: true,
        stepCompleted: true,
      };
    }

    const nextStep = steps[nextIndex];
    return {
      nextStepIndex: nextIndex,
      nextPhase: nextStep.isBilateral ? 'BILATERAL_SIDE_A' : 'POSTURE_HOLD',
      isFinished: false,
      stepCompleted: true,
    };
  }

  /**
   * Computes previous step progression.
   */
  public static computePreviousProgression(
    currentStepIndex: number,
    currentPhase: ConductorStepPhase,
    steps: ConductorStepView[]
  ): {
    prevStepIndex: number;
    prevPhase: ConductorStepPhase;
  } {
    if (steps.length === 0) {
      return { prevStepIndex: 0, prevPhase: 'POSTURE_HOLD' };
    }

    const currentStep = steps[currentStepIndex];

    // If in REST_INTERVAL, go back to posture hold
    if (currentPhase === 'REST_INTERVAL') {
      return {
        prevStepIndex: currentStepIndex,
        prevPhase: currentStep.isBilateral ? 'BILATERAL_SIDE_B' : 'POSTURE_HOLD',
      };
    }

    // If in BILATERAL_SIDE_B, go back to SIDE_A
    if (currentStep.isBilateral && currentPhase === 'BILATERAL_SIDE_B') {
      return {
        prevStepIndex: currentStepIndex,
        prevPhase: 'BILATERAL_SIDE_A',
      };
    }

    // Go back to previous step if available
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      const prevStep = steps[prevIndex];
      return {
        prevStepIndex: prevIndex,
        prevPhase: prevStep.isBilateral ? 'BILATERAL_SIDE_A' : 'POSTURE_HOLD',
      };
    }

    // Already at start
    return {
      prevStepIndex: 0,
      prevPhase: currentStep.isBilateral ? 'BILATERAL_SIDE_A' : 'POSTURE_HOLD',
    };
  }

  /**
   * Computes skip step progression: directly advances to next posture, skipping rest or bilateral sides.
   */
  public static computeSkipProgression(
    currentStepIndex: number,
    steps: ConductorStepView[]
  ): {
    nextStepIndex: number;
    nextPhase: ConductorStepPhase;
    isFinished: boolean;
  } {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) {
      return {
        nextStepIndex: currentStepIndex,
        nextPhase: 'POSTURE_HOLD',
        isFinished: true,
      };
    }

    const nextStep = steps[nextIndex];
    return {
      nextStepIndex: nextIndex,
      nextPhase: nextStep.isBilateral ? 'BILATERAL_SIDE_A' : 'POSTURE_HOLD',
      isFinished: false,
    };
  }
}
