import { z } from 'zod';

export const SequenceLevelEnum = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'ALL_LEVELS',
]);
export type SequenceLevel = z.infer<typeof SequenceLevelEnum>;

export const SequenceStatusEnum = z.enum([
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]);
export type SequenceStatus = z.infer<typeof SequenceStatusEnum>;

export const ExecutionModeEnum = z.enum([
  'TIME_HOLD',
  'BREATH_COUNT',
  'REPETITION',
]);
export type ExecutionMode = z.infer<typeof ExecutionModeEnum>;

export const StepSideEnum = z.enum([
  'NONE',
  'RIGHT',
  'LEFT',
]);
export type StepSide = z.infer<typeof StepSideEnum>;

export const SequenceStepInputSchema = z.object({
  id: z.string().uuid().optional(),
  stepOrder: z.number().int().min(0),
  asanaId: z.string().uuid(),
  executionMode: ExecutionModeEnum.default('TIME_HOLD').optional(),
  durationSeconds: z.number().int().min(1).max(7200).default(30),
  repetitionCount: z.number().int().min(1).max(100).optional(),
  isBilateral: z.boolean().default(false).optional(),
  side: StepSideEnum.default('NONE').optional(),
  restIntervalSeconds: z.number().int().min(0).max(600).default(0).optional(),
  voiceAudioMediaId: z.string().uuid().nullable().optional(),
  demoVideoMediaId: z.string().uuid().nullable().optional(),
  referenceImageMediaId: z.string().uuid().nullable().optional(),
  teacherNotes: z.string().max(2000).nullable().optional(),
  cues: z.string().max(2000).nullable().optional(),
  transitionNotes: z.string().max(1000).nullable().optional(),
});
export type SequenceStepInput = z.infer<typeof SequenceStepInputSchema>;

export const CreateSequenceSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  objective: z.string().trim().max(1000).optional(),
  targetLevel: SequenceLevelEnum.default('ALL_LEVELS').optional(),
  intendedAudience: z.string().trim().max(500).optional(),
  isStudioTemplate: z.boolean().default(false).optional(),
  tags: z.array(z.string().trim()).default([]).optional(),
  steps: z.array(SequenceStepInputSchema).default([]).optional(),
});
export type CreateSequenceInput = z.infer<typeof CreateSequenceSchema>;

export const UpdateSequenceSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  objective: z.string().trim().max(1000).optional(),
  targetLevel: SequenceLevelEnum.optional(),
  intendedAudience: z.string().trim().max(500).optional(),
  isStudioTemplate: z.boolean().optional(),
  tags: z.array(z.string().trim()).optional(),
  steps: z.array(SequenceStepInputSchema).optional(),
});
export type UpdateSequenceInput = z.infer<typeof UpdateSequenceSchema>;

export const SequenceListQuerySchema = z.object({
  search: z.string().optional(),
  targetLevel: SequenceLevelEnum.optional(),
  status: SequenceStatusEnum.optional(),
  isStudioTemplate: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
export type SequenceListQuery = z.infer<typeof SequenceListQuerySchema>;

export const ReorderSequenceStepsSchema = z.object({
  stepIds: z.array(z.string().uuid()).min(1),
});
export type ReorderSequenceStepsInput = z.infer<typeof ReorderSequenceStepsSchema>;

export const PublishSequenceSchema = z.object({
  notes: z.string().max(1000).optional(),
});
export type PublishSequenceInput = z.infer<typeof PublishSequenceSchema>;
