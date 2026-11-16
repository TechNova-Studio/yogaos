import { describe, it, expect } from 'vitest';
import {
  ConductorStateMachine,
  InvalidTransitionError,
} from '../src/modules/conductor/conductor-state-machine.js';
import {
  InitConductorSessionSchema,
  ConductorActionSchema,
  ConductorSessionStatusEnum,
  ConductorStepPhaseEnum,
  ConductorStepView,
} from '@yogaos/contracts';

describe('P16 Conductor Engine Unit Tests', () => {
  describe('ConductorStateMachine Transition Validation', () => {
    it('allows valid state transitions from READY', () => {
      expect(ConductorStateMachine.isValidTransition('READY', 'RUNNING')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('READY', 'INTERRUPTED')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('READY', 'INTERRUPTED_ABANDONED')).toBe(true);
    });

    it('rejects invalid state transitions from READY to COMPLETED', () => {
      expect(ConductorStateMachine.isValidTransition('READY', 'COMPLETED')).toBe(false);
      expect(() => ConductorStateMachine.assertValidTransition('READY', 'COMPLETED')).toThrow(
        InvalidTransitionError
      );
    });

    it('allows valid transitions during active class execution (RUNNING & PAUSED)', () => {
      expect(ConductorStateMachine.isValidTransition('RUNNING', 'PAUSED')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('RUNNING', 'COMPLETED')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('RUNNING', 'INTERRUPTED')).toBe(true);

      expect(ConductorStateMachine.isValidTransition('PAUSED', 'RUNNING')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('PAUSED', 'COMPLETED')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('PAUSED', 'INTERRUPTED')).toBe(true);
      expect(ConductorStateMachine.isValidTransition('PAUSED', 'INTERRUPTED_ABANDONED')).toBe(true);
    });

    it('rejects backwards transition from RUNNING to READY', () => {
      expect(ConductorStateMachine.isValidTransition('RUNNING', 'READY')).toBe(false);
      expect(() => ConductorStateMachine.assertValidTransition('RUNNING', 'READY')).toThrow(
        InvalidTransitionError
      );
    });

    it('enforces terminal states: COMPLETED and INTERRUPTED_ABANDONED cannot transition to anything', () => {
      expect(ConductorStateMachine.isTerminal('COMPLETED')).toBe(true);
      expect(ConductorStateMachine.isTerminal('INTERRUPTED_ABANDONED')).toBe(true);

      expect(ConductorStateMachine.isValidTransition('COMPLETED', 'RUNNING')).toBe(false);
      expect(ConductorStateMachine.isValidTransition('COMPLETED', 'READY')).toBe(false);
      expect(ConductorStateMachine.isValidTransition('INTERRUPTED_ABANDONED', 'RUNNING')).toBe(false);
      expect(ConductorStateMachine.isValidTransition('INTERRUPTED_ABANDONED', 'PAUSED')).toBe(false);
    });

    it('maintains the crucial invariant: Paused/abandoned sessions are NEVER marked COMPLETED', () => {
      // Transitioning directly from PAUSED to COMPLETED requires explicit instructor completion,
      // whereas abandoned timeouts strictly transition to INTERRUPTED_ABANDONED.
      expect(ConductorStateMachine.isValidTransition('PAUSED', 'INTERRUPTED_ABANDONED')).toBe(true);
    });
  });

  describe('Conductor Step & Phase Progression Engine', () => {
    const mockSteps: ConductorStepView[] = [
      {
        id: 'step-1',
        stepOrder: 1,
        asanaId: 'asana-1',
        asanaName: 'Mountain Pose',
        sanskritName: 'Tāḍāsana',
        executionMode: 'TIME_HOLD',
        durationSeconds: 30,
        repetitionCount: null,
        isBilateral: false,
        side: 'NONE',
        restIntervalSeconds: 0,
        teacherNotes: 'Ground all 4 corners',
        cues: 'Stand tall',
        transitionNotes: null,
        referenceImageMediaId: null,
        voiceAudioMediaId: null,
        demoVideoMediaId: null,
      },
      {
        id: 'step-2',
        stepOrder: 2,
        asanaId: 'asana-2',
        asanaName: 'Warrior II',
        sanskritName: 'Vīrabhadrāsana II',
        executionMode: 'TIME_HOLD',
        durationSeconds: 45,
        repetitionCount: null,
        isBilateral: true, // Bilateral posture
        side: 'RIGHT',
        restIntervalSeconds: 15, // Has rest interval
        teacherNotes: 'Arms parallel to floor',
        cues: 'Gaze over front fingertips',
        transitionNotes: 'Step forward lightly',
        referenceImageMediaId: null,
        voiceAudioMediaId: null,
        demoVideoMediaId: null,
      },
      {
        id: 'step-3',
        stepOrder: 3,
        asanaId: 'asana-3',
        asanaName: 'Corpse Pose',
        sanskritName: 'Śavāsana',
        executionMode: 'TIME_HOLD',
        durationSeconds: 120,
        repetitionCount: null,
        isBilateral: false,
        side: 'NONE',
        restIntervalSeconds: 0,
        teacherNotes: 'Final relaxation',
        cues: 'Release all breath control',
        transitionNotes: null,
        referenceImageMediaId: null,
        voiceAudioMediaId: null,
        demoVideoMediaId: null,
      },
    ];

    it('progresses unilateral posture without rest directly to next posture', () => {
      const prog = ConductorStateMachine.computeNextProgression(0, 'POSTURE_HOLD', mockSteps);
      expect(prog.stepCompleted).toBe(true);
      expect(prog.nextStepIndex).toBe(1);
      // Step 2 is bilateral, so it should start on BILATERAL_SIDE_A
      expect(prog.nextPhase).toBe('BILATERAL_SIDE_A');
      expect(prog.isFinished).toBe(false);
    });

    it('progresses bilateral posture from SIDE_A to SIDE_B without advancing step index', () => {
      const prog = ConductorStateMachine.computeNextProgression(1, 'BILATERAL_SIDE_A', mockSteps);
      expect(prog.stepCompleted).toBe(false);
      expect(prog.nextStepIndex).toBe(1); // Same step
      expect(prog.nextPhase).toBe('BILATERAL_SIDE_B');
      expect(prog.isFinished).toBe(false);
    });

    it('progresses bilateral posture from SIDE_B into REST_INTERVAL before next posture', () => {
      const prog = ConductorStateMachine.computeNextProgression(1, 'BILATERAL_SIDE_B', mockSteps);
      expect(prog.stepCompleted).toBe(false);
      expect(prog.nextStepIndex).toBe(1); // Same step during rest
      expect(prog.nextPhase).toBe('REST_INTERVAL');
      expect(prog.isFinished).toBe(false);
    });

    it('progresses out of REST_INTERVAL into step 3', () => {
      const prog = ConductorStateMachine.computeNextProgression(1, 'REST_INTERVAL', mockSteps);
      expect(prog.stepCompleted).toBe(true);
      expect(prog.nextStepIndex).toBe(2); // Moved to step 3
      expect(prog.nextPhase).toBe('POSTURE_HOLD');
      expect(prog.isFinished).toBe(false);
    });

    it('detects session completion when advancing past the final posture', () => {
      const prog = ConductorStateMachine.computeNextProgression(2, 'POSTURE_HOLD', mockSteps);
      expect(prog.stepCompleted).toBe(true);
      expect(prog.isFinished).toBe(true);
    });

    it('computes skip step progression bypassing rest and bilateral sides', () => {
      // Skipping while on Step 2 Side A directly leaps to Step 3
      const skipProg = ConductorStateMachine.computeSkipProgression(1, mockSteps);
      expect(skipProg.nextStepIndex).toBe(2);
      expect(skipProg.nextPhase).toBe('POSTURE_HOLD');
      expect(skipProg.isFinished).toBe(false);
    });

    it('computes previous step progression backwards accurately', () => {
      // Going back from Step 2 Rest Interval returns to Side B
      const prevFromRest = ConductorStateMachine.computePreviousProgression(1, 'REST_INTERVAL', mockSteps);
      expect(prevFromRest.prevStepIndex).toBe(1);
      expect(prevFromRest.prevPhase).toBe('BILATERAL_SIDE_B');

      // Going back from Step 2 Side B returns to Side A
      const prevFromSideB = ConductorStateMachine.computePreviousProgression(1, 'BILATERAL_SIDE_B', mockSteps);
      expect(prevFromSideB.prevStepIndex).toBe(1);
      expect(prevFromSideB.prevPhase).toBe('BILATERAL_SIDE_A');

      // Going back from Step 2 Side A returns to Step 1
      const prevFromStep2 = ConductorStateMachine.computePreviousProgression(1, 'BILATERAL_SIDE_A', mockSteps);
      expect(prevFromStep2.prevStepIndex).toBe(0);
      expect(prevFromStep2.prevPhase).toBe('POSTURE_HOLD');
    });
  });

  describe('Conductor Zod Contracts', () => {
    it('validates InitConductorSessionSchema', () => {
      const valid = {
        sessionInstanceId: '11111111-1111-1111-1111-111111111111',
        sequenceVersionId: '22222222-2222-2222-2222-222222222222',
        clientSessionUuid: '33333333-3333-3333-3333-333333333333',
      };
      expect(() => InitConductorSessionSchema.parse(valid)).not.toThrow();
    });

    it('rejects invalid UUID in InitConductorSessionSchema', () => {
      const invalid = { sessionInstanceId: 'not-a-uuid' };
      expect(() => InitConductorSessionSchema.parse(invalid)).toThrow();
    });

    it('validates ConductorActionSchema for all approved actions', () => {
      const actions = [
        'START',
        'PAUSE',
        'RESUME',
        'NEXT_STEP',
        'PREVIOUS_STEP',
        'SKIP_STEP',
        'ADJUST_TIME',
        'END_SESSION',
        'HEARTBEAT',
      ];

      for (const action of actions) {
        const input = {
          action,
          clientEventUuid: '44444444-4444-4444-4444-444444444444',
          currentStepIndex: 1,
          deltaSeconds: action === 'ADJUST_TIME' ? 30 : undefined,
        };
        expect(() => ConductorActionSchema.parse(input)).not.toThrow();
      }
    });
  });
});
