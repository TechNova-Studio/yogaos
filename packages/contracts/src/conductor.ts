import { z } from 'zod';

export const ConductorSessionStatusEnum = z.enum([
  'READY',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'INTERRUPTED',
  'INTERRUPTED_ABANDONED',
]);
export type ConductorSessionStatus = z.infer<typeof ConductorSessionStatusEnum>;

export const ConductorStepPhaseEnum = z.enum([
  'POSTURE_HOLD',
  'BILATERAL_SIDE_A',
  'BILATERAL_SIDE_B',
  'REST_INTERVAL',
  'TRANSITION',
]);
export type ConductorStepPhase = z.infer<typeof ConductorStepPhaseEnum>;

export const ConductorEventTypeEnum = z.enum([
  'SESSION_INITIALIZED',
  'SESSION_STARTED',
  'STEP_STARTED',
  'STEP_COMPLETED',
  'STEP_SKIPPED',
  'STEP_PREVIOUS',
  'TIME_ADJUSTED',
  'SESSION_PAUSED',
  'SESSION_RESUMED',
  'SESSION_COMPLETED',
  'SESSION_INTERRUPTED',
  'SESSION_ABANDONED',
]);
export type ConductorEventType = z.infer<typeof ConductorEventTypeEnum>;

export const ConductorActionTypeEnum = z.enum([
  'START',
  'PAUSE',
  'RESUME',
  'NEXT_STEP',
  'PREVIOUS_STEP',
  'SKIP_STEP',
  'ADJUST_TIME',
  'END_SESSION',
  'HEARTBEAT',
]);
export type ConductorActionType = z.infer<typeof ConductorActionTypeEnum>;

export const InitConductorSessionSchema = z.object({
  sessionInstanceId: z.string().uuid(),
  sequenceVersionId: z.string().uuid().optional(),
  clientSessionUuid: z.string().uuid().optional(),
});
export type InitConductorSessionInput = z.infer<typeof InitConductorSessionSchema>;

export const ConductorActionSchema = z.object({
  action: ConductorActionTypeEnum,
  clientEventUuid: z.string().uuid(),
  clientTimestamp: z.string().datetime().optional(),
  currentStepIndex: z.number().int().min(0).optional(),
  deltaSeconds: z.number().int().optional(),
  payload: z.record(z.unknown()).optional(),
});
export type ConductorActionInput = z.infer<typeof ConductorActionSchema>;

export interface ConductorStepView {
  id: string;
  stepOrder: number;
  asanaId: string;
  asanaName: string;
  sanskritName: string;
  executionMode: 'TIME_HOLD' | 'BREATH_COUNT' | 'REPETITION';
  durationSeconds: number;
  repetitionCount: number | null;
  isBilateral: boolean;
  side: 'NONE' | 'RIGHT' | 'LEFT';
  restIntervalSeconds: number;
  teacherNotes: string | null;
  cues: string | null;
  transitionNotes: string | null;
  referenceImageMediaId: string | null;
  voiceAudioMediaId: string | null;
  demoVideoMediaId: string | null;
}

export interface ConductorSessionState {
  id: string;
  tenantId: string;
  sessionInstanceId: string;
  sequenceVersionId: string;
  sequenceTitle: string;
  conductorInstructorId: string;
  status: ConductorSessionStatus;
  currentStepIndex: number;
  currentPhase: ConductorStepPhase;
  totalSteps: number;
  totalElapsedSeconds: number;
  completedStepsCount: number;
  skippedStepsCount: number;
  addedTimeSeconds: number;
  actualStartedAt: string | null;
  actualConcludedAt: string | null;
  lastHeartbeatAt: string | null;
  currentStep: ConductorStepView | null;
  nextStep: ConductorStepView | null;
  steps: ConductorStepView[];
}
