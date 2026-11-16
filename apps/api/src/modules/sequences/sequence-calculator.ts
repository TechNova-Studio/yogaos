import { SequenceStepInput } from '@yogaos/contracts';

export interface StepDurationResult {
  stepOrder: number;
  postureDurationSecs: number;
  restDurationSecs: number;
  stepTotalDurationSecs: number;
}

export interface SequenceValidationIssue {
  stepOrder: number;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface SequenceValidationResult {
  isValidForPublishing: boolean;
  totalDurationSecs: number;
  stepDurations: StepDurationResult[];
  issues: SequenceValidationIssue[];
}

export class SequenceCalculator {
  /**
   * Calculates the runtime for a single step.
   * If isBilateral is true, posture duration is doubled (one hold per side).
   * Rest interval is added at the conclusion of the posture step.
   */
  static calculateStepDuration(step: SequenceStepInput): StepDurationResult {
    const baseDuration = Math.max(1, step.durationSeconds || 30);
    const postureDuration = step.isBilateral ? baseDuration * 2 : baseDuration;
    const restDuration = Math.max(0, step.restIntervalSeconds || 0);
    const stepTotal = postureDuration + restDuration;

    return {
      stepOrder: step.stepOrder,
      postureDurationSecs: postureDuration,
      restDurationSecs: restDuration,
      stepTotalDurationSecs: stepTotal,
    };
  }

  /**
   * Calculates total sequence duration and validates steps against publishing criteria.
   */
  static calculateAndValidate(steps: SequenceStepInput[]): SequenceValidationResult {
    const issues: SequenceValidationIssue[] = [];
    const stepDurations: StepDurationResult[] = [];
    let totalDurationSecs = 0;

    if (!steps || steps.length === 0) {
      issues.push({
        stepOrder: 0,
        severity: 'ERROR',
        message: 'A sequence must contain at least one posture step to be published.',
      });
      return {
        isValidForPublishing: false,
        totalDurationSecs: 0,
        stepDurations: [],
        issues,
      };
    }

    steps.forEach((step, index) => {
      const order = step.stepOrder !== undefined ? step.stepOrder : index + 1;
      const stepCalc = this.calculateStepDuration(step);
      stepDurations.push(stepCalc);
      totalDurationSecs += stepCalc.stepTotalDurationSecs;

      if (!step.asanaId) {
        issues.push({
          stepOrder: order,
          severity: 'ERROR',
          message: `Step ${order} is missing an Asana posture reference.`,
        });
      }

      if (step.durationSeconds < 5) {
        issues.push({
          stepOrder: order,
          severity: 'WARNING',
          message: `Step ${order} hold duration (${step.durationSeconds}s) is unusually short.`,
        });
      }

      if (!step.cues && !step.teacherNotes) {
        issues.push({
          stepOrder: order,
          severity: 'WARNING',
          message: `Step ${order} has no verbal cues or instructor guidance notes.`,
        });
      }

      if (step.isBilateral && step.side && step.side !== 'NONE') {
        // When bilateral, side designation is handled dynamically as both sides
      }
    });

    const hasErrors = issues.some((i) => i.severity === 'ERROR');

    return {
      isValidForPublishing: !hasErrors && steps.length > 0,
      totalDurationSecs,
      stepDurations,
      issues,
    };
  }
}
