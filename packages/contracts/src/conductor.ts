import { z } from 'zod';

export const ConductorSessionStatusEnum = z.enum([
  'READY',
  'OFFLINE_READY',
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
  'OFFLINE_PREPARATION_STARTED',
  'OFFLINE_READY',
  'OFFLINE_VERIFICATION_FAILED',
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
  'SESSION_RECOVERED',
  'OFFLINE_SYNC_COMPLETED',
  'MEDIA_PLAYBACK_STARTED',
  'MEDIA_PLAYBACK_ERROR',
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
  'RECOVER',
]);
export type ConductorActionType = z.infer<typeof ConductorActionTypeEnum>;

export const ConductorContentModeEnum = z.enum([
  'NONE',
  'VIDEO',
  'IMAGE',
  'AUDIO_ONLY',
  'IMAGE_WITH_VOICE',
]);
export type ConductorContentMode = z.infer<typeof ConductorContentModeEnum>;

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

export const ConductorManifestAssetSchema = z.object({
  assetId: z.string().uuid(),
  title: z.string(),
  fileName: z.string(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
  mimeType: z.string(),
  fileSize: z.number().int().min(0),
  sha256Hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  url: z.string(),
  thumbnailUrl: z.string().nullable().optional(),
  durationSeconds: z.number().int().nullable().optional(),
  stepOrders: z.array(z.number().int()),
  contentMode: ConductorContentModeEnum,
});
export type ConductorManifestAsset = z.infer<typeof ConductorManifestAssetSchema>;

export const ConductorSessionMediaManifestSchema = z.object({
  sessionInstanceId: z.string().uuid(),
  sequenceVersionId: z.string().uuid(),
  sequenceTitle: z.string(),
  totalAssetsCount: z.number().int().min(0),
  totalBytes: z.number().int().min(0),
  assets: z.array(ConductorManifestAssetSchema),
});
export type ConductorSessionMediaManifest = z.infer<typeof ConductorSessionMediaManifestSchema>;

export const PrepareConductorSessionSchema = z.object({
  clientEventUuid: z.string().uuid(),
  status: z.enum(['PREPARING', 'OFFLINE_READY', 'VERIFICATION_FAILED']),
  verifiedAssetsCount: z.number().int().min(0).optional(),
  totalBytesVerified: z.number().int().min(0).optional(),
  verificationErrors: z.array(z.string()).optional(),
  clientTimestamp: z.string().datetime().optional(),
  storageAvailableBytes: z.number().optional(),
});
export type PrepareConductorSessionInput = z.infer<typeof PrepareConductorSessionSchema>;

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
  contentMode: ConductorContentMode;
  referenceImageMediaId: string | null;
  voiceAudioMediaId: string | null;
  demoVideoMediaId: string | null;
  referenceImageUrl?: string | null;
  voiceAudioUrl?: string | null;
  demoVideoUrl?: string | null;
  referenceImageHash?: string | null;
  voiceAudioHash?: string | null;
  demoVideoHash?: string | null;
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
  isOfflineReady: boolean;
  offlinePreparedAt: string | null;
  preparationMetadata: Record<string, unknown> | null;
  actualStartedAt: string | null;
  actualConcludedAt: string | null;
  lastHeartbeatAt: string | null;
  lastSyncAt: string | null;
  currentStep: ConductorStepView | null;
  nextStep: ConductorStepView | null;
  steps: ConductorStepView[];
  mediaManifest?: ConductorSessionMediaManifest | null;
}

// ----------------------------------------------------------------------------
// P18: Recovery, Event Sync & Session History
// ----------------------------------------------------------------------------

export const ConductorSyncEventSchema = z.object({
  clientEventUuid: z.string().uuid(),
  eventType: ConductorEventTypeEnum,
  stepOrder: z.number().int().min(0).nullable().optional(),
  clientTimestamp: z.string().datetime(),
  payload: z.record(z.unknown()).optional(),
});
export type ConductorSyncEvent = z.infer<typeof ConductorSyncEventSchema>;

export const ConductorBatchSyncSchema = z.object({
  events: z.array(ConductorSyncEventSchema).min(1),
  clientSessionUuid: z.string().uuid().optional(),
  sessionStateSnapshot: z
    .object({
      currentStepIndex: z.number().int().min(0),
      currentPhase: ConductorStepPhaseEnum,
      completedStepsCount: z.number().int().min(0),
      skippedStepsCount: z.number().int().min(0),
      totalElapsedSeconds: z.number().int().min(0),
      status: ConductorSessionStatusEnum.optional(),
    })
    .optional(),
});
export type ConductorBatchSyncInput = z.infer<typeof ConductorBatchSyncSchema>;

export interface ConductorBatchSyncResponse {
  acknowledgedEventUuids: string[];
  alreadyProcessedEventUuids: string[];
  failedEventUuids: string[];
  currentState: ConductorSessionState;
  syncedAt: string;
}

export const ConductorRecoverSessionSchema = z.object({
  action: z.enum(['RESUME', 'ABANDON']),
  reason: z.string().max(500).optional(),
  clientEventUuid: z.string().uuid(),
  clientTimestamp: z.string().datetime().optional(),
});
export type ConductorRecoverSessionInput = z.infer<typeof ConductorRecoverSessionSchema>;

export interface ConductorRecoveryResponse {
  session: ConductorSessionState;
  isUnfinished: boolean;
  isInterrupted: boolean;
  isAbandoned: boolean;
  canResume: boolean;
  serverLastEventAt: string | null;
  lastSyncAt: string | null;
}

export const ConductorSessionHistoryFilterSchema = z.object({
  status: ConductorSessionStatusEnum.optional(),
  instructorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ConductorSessionHistoryFilter = z.infer<typeof ConductorSessionHistoryFilterSchema>;

export interface ConductorSessionHistoryItem {
  id: string;
  sessionInstanceId: string;
  sequenceTitle: string;
  sequenceVersionId: string;
  instructorId: string;
  instructorName: string;
  sessionDate: string;
  branchName?: string;
  roomName?: string;
  status: ConductorSessionStatus;
  totalSteps: number;
  completedStepsCount: number;
  skippedStepsCount: number;
  totalElapsedSeconds: number;
  actualStartedAt: string | null;
  actualConcludedAt: string | null;
  lastSyncAt: string | null;
  eventsCount: number;
  createdAt: string;
}

export interface ConductorExecutionEventDetail {
  id: string;
  clientEventUuid: string;
  eventType: ConductorEventType;
  stepOrder: number | null;
  clientTimestamp: string;
  serverReceivedAt: string;
  payload: Record<string, unknown> | null;
  isOfflineSync: boolean;
}

export interface ConductorSessionHistoryResponse {
  items: ConductorSessionHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}
