import { z } from 'zod';

export const AsanaCategoryEnum = z.enum([
  'STANDING',
  'SEATED',
  'PRONE',
  'SUPINE',
  'INVERSION',
  'BACKBEND',
  'FORWARD_BEND',
  'TWIST',
  'ARM_BALANCE',
  'RESTORATIVE',
  'PRANAYAMA',
  'MEDITATION',
]);
export type AsanaCategory = z.infer<typeof AsanaCategoryEnum>;

export const AsanaDifficultyEnum = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
]);
export type AsanaDifficulty = z.infer<typeof AsanaDifficultyEnum>;

export const AsanaStatusEnum = z.enum([
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]);
export type AsanaStatus = z.infer<typeof AsanaStatusEnum>;

export const MediaTypeEnum = z.enum([
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
]);
export type MediaType = z.infer<typeof MediaTypeEnum>;

export const MediaStatusEnum = z.enum([
  'PENDING_UPLOAD',
  'PROCESSING',
  'READY',
  'FAILED',
  'ARCHIVED',
]);
export type MediaStatus = z.infer<typeof MediaStatusEnum>;

// Asana Schemas
export const CreateAsanaSchema = z.object({
  sanskritName: z.string().trim().min(2).max(150),
  sanskritNameIast: z.string().trim().max(150).optional(),
  englishName: z.string().trim().min(2).max(150),
  commonName: z.string().trim().max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  instructions: z.string().trim().max(5000).optional(),
  alignmentCues: z.string().trim().max(3000).optional(),
  category: AsanaCategoryEnum,
  difficulty: AsanaDifficultyEnum.default('BEGINNER').optional(),
  status: AsanaStatusEnum.default('PUBLISHED').optional(),
  anatomicalFocus: z.array(z.string().trim()).default([]).optional(),
  benefits: z.array(z.string().trim()).default([]).optional(),
  contraindications: z.array(z.string().trim()).default([]).optional(),
  cautions: z.string().trim().max(2000).optional(),
  prepPoses: z.array(z.string().trim()).default([]).optional(),
  followUpPoses: z.array(z.string().trim()).default([]).optional(),
  variations: z.array(z.string().trim()).default([]).optional(),
  tags: z.array(z.string().trim()).default([]).optional(),
  primaryMediaId: z.string().uuid().optional(),
});
export type CreateAsanaInput = z.infer<typeof CreateAsanaSchema>;

export const UpdateAsanaSchema = CreateAsanaSchema.partial();
export type UpdateAsanaInput = z.infer<typeof UpdateAsanaSchema>;

export const AsanaListQuerySchema = z.object({
  search: z.string().optional(),
  category: AsanaCategoryEnum.optional(),
  difficulty: AsanaDifficultyEnum.optional(),
  status: AsanaStatusEnum.optional(),
  includeShared: z.coerce.boolean().default(true).optional(),
  onlyCustom: z.coerce.boolean().default(false).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
export type AsanaListQuery = z.infer<typeof AsanaListQuerySchema>;

export const AssociateAsanaMediaSchema = z.object({
  mediaAssetId: z.string().uuid(),
  caption: z.string().trim().max(255).optional(),
  isFeatured: z.boolean().default(false).optional(),
  sortOrder: z.number().int().default(0).optional(),
});
export type AssociateAsanaMediaInput = z.infer<typeof AssociateAsanaMediaSchema>;

// Media Asset Schemas
export const CreateMediaAssetSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  mediaType: MediaTypeEnum,
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().trim().min(3).max(100),
  url: z.string().min(1),
  thumbnailUrl: z.string().min(1).optional(),
  storageKey: z.string().min(1).max(512),
  durationSeconds: z.number().int().min(0).optional(),
  sha256Hash: z.string().max(64).optional(),
  metadata: z.record(z.any()).optional(),
  isSharedReference: z.boolean().default(false).optional(),
});
export type CreateMediaAssetInput = z.infer<typeof CreateMediaAssetSchema>;

export const UpdateMediaAssetSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateMediaAssetInput = z.infer<typeof UpdateMediaAssetSchema>;

export const ReplaceMediaAssetSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().trim().min(3).max(100),
  url: z.string().min(1),
  storageKey: z.string().min(1).max(512),
  sha256Hash: z.string().max(64).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});
export type ReplaceMediaAssetInput = z.infer<typeof ReplaceMediaAssetSchema>;

export const MediaListQuerySchema = z.object({
  search: z.string().optional(),
  mediaType: MediaTypeEnum.optional(),
  mediaStatus: MediaStatusEnum.optional(),
  includeArchived: z.coerce.boolean().default(false).optional(),
  includeShared: z.coerce.boolean().default(true).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
export type MediaListQuery = z.infer<typeof MediaListQuerySchema>;
