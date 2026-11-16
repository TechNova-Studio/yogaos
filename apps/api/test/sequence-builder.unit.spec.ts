import { describe, it, expect } from 'vitest';
import { SequenceCalculator } from '../src/modules/sequences/sequence-calculator.js';
import {
  CreateSequenceSchema,
  SequenceStepInputSchema,
  SequenceLevelEnum,
  ExecutionModeEnum,
} from '@yogaos/contracts';

describe('P15 Sequence Builder Unit Tests', () => {
  describe('SequenceCalculator Duration Calculations', () => {
    it('calculates duration for a standard non-bilateral hold with rest', () => {
      const step = {
        stepOrder: 1,
        asanaId: '11111111-1111-1111-1111-111111111111',
        durationSeconds: 60,
        isBilateral: false,
        restIntervalSeconds: 15,
      };

      const result = SequenceCalculator.calculateStepDuration(step as any);
      expect(result.postureDurationSecs).toBe(60);
      expect(result.restDurationSecs).toBe(15);
      expect(result.stepTotalDurationSecs).toBe(75);
    });

    it('doubles posture hold duration for bilateral postures', () => {
      const bilateralStep = {
        stepOrder: 2,
        asanaId: '11111111-1111-1111-1111-111111111111',
        durationSeconds: 45,
        isBilateral: true, // Symmetrical Right and Left holds (45s x 2)
        restIntervalSeconds: 10,
      };

      const result = SequenceCalculator.calculateStepDuration(bilateralStep as any);
      expect(result.postureDurationSecs).toBe(90); // 45 * 2
      expect(result.restDurationSecs).toBe(10);
      expect(result.stepTotalDurationSecs).toBe(100); // 90 + 10
    });

    it('sums multi-step sequence durations accurately', () => {
      const steps = [
        {
          stepOrder: 1,
          asanaId: '11111111-1111-1111-1111-111111111111',
          durationSeconds: 60,
          isBilateral: false,
          restIntervalSeconds: 10,
        }, // 70s
        {
          stepOrder: 2,
          asanaId: '22222222-2222-2222-2222-222222222222',
          durationSeconds: 30,
          isBilateral: true,
          restIntervalSeconds: 10,
        }, // 60s + 10s = 70s
        {
          stepOrder: 3,
          asanaId: '33333333-3333-3333-3333-333333333333',
          durationSeconds: 180,
          isBilateral: false,
          restIntervalSeconds: 0,
        }, // 180s (e.g. Savasana)
      ];

      const validation = SequenceCalculator.calculateAndValidate(steps as any);
      expect(validation.totalDurationSecs).toBe(320); // 70 + 70 + 180 = 320s (5m 20s)
      expect(validation.stepDurations.length).toBe(3);
    });
  });

  describe('Sequence Validation Rules', () => {
    it('rejects publishing when sequence contains 0 steps', () => {
      const validation = SequenceCalculator.calculateAndValidate([]);
      expect(validation.isValidForPublishing).toBe(false);
      expect(validation.issues.some((i) => i.severity === 'ERROR')).toBe(true);
      expect(validation.issues[0].message).toContain('at least one posture step');
    });

    it('flags warning when step has no cues or notes', () => {
      const stepWithoutCues = [
        {
          stepOrder: 1,
          asanaId: '11111111-1111-1111-1111-111111111111',
          durationSeconds: 30,
          cues: '',
          teacherNotes: '',
        },
      ];

      const validation = SequenceCalculator.calculateAndValidate(stepWithoutCues as any);
      // Warnings do NOT prevent publishing, but are flagged
      expect(validation.isValidForPublishing).toBe(true);
      expect(validation.issues.some((i) => i.severity === 'WARNING')).toBe(true);
      expect(validation.issues[0].message).toContain('no verbal cues');
    });

    it('flags warning for unusually short hold durations (< 5s)', () => {
      const fastStep = [
        {
          stepOrder: 1,
          asanaId: '11111111-1111-1111-1111-111111111111',
          durationSeconds: 3,
          cues: 'Quick transition breath',
        },
      ];

      const validation = SequenceCalculator.calculateAndValidate(fastStep as any);
      expect(validation.issues.some((i) => i.message.includes('unusually short'))).toBe(true);
    });
  });

  describe('Contract Schema Validations', () => {
    it('validates a complete, valid Sequence creation payload', () => {
      const payload = {
        title: 'Morning Vinyasa Peak Flow',
        description: 'Dynamic solar practice targeting hip mobility',
        objective: 'Develop steady breathing and open hips',
        targetLevel: 'INTERMEDIATE',
        intendedAudience: 'Regular morning practitioners',
        isStudioTemplate: true,
        tags: ['morning', 'vinyasa', 'hips'],
        steps: [
          {
            stepOrder: 1,
            asanaId: '11111111-1111-1111-1111-111111111111',
            durationSeconds: 60,
            isBilateral: true,
            restIntervalSeconds: 10,
            cues: 'Inhale reach overhead, exhale ground outer edge',
          },
        ],
      };

      const parsed = CreateSequenceSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.targetLevel).toBe('INTERMEDIATE');
        expect(parsed.data.steps?.[0].isBilateral).toBe(true);
      }
    });

    it('rejects sequence step with invalid execution mode or negative rest', () => {
      const invalidStep = {
        stepOrder: 1,
        asanaId: '11111111-1111-1111-1111-111111111111',
        durationSeconds: 30,
        restIntervalSeconds: -5, // Negative rest invalid
      };

      const parsed = SequenceStepInputSchema.safeParse(invalidStep);
      expect(parsed.success).toBe(false);
    });

    it('verifies all valid SequenceLevel and ExecutionMode enums', () => {
      expect(SequenceLevelEnum.options).toEqual(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']);
      expect(ExecutionModeEnum.options).toEqual(['TIME_HOLD', 'BREATH_COUNT', 'REPETITION']);
    });
  });
});
