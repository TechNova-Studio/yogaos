import { z } from 'zod';

// ----------------------------------------------------------------------------
// Class Types / Programs
// ----------------------------------------------------------------------------
export const ClassLevelEnum = z.enum(['ALL_LEVELS', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export type ClassLevelType = z.infer<typeof ClassLevelEnum>;

export const CreateClassTypeSchema = z.object({
  name: z.string().min(2, 'Class name must be at least 2 characters').max(150),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().min(2).max(64).default('Hatha'),
  level: ClassLevelEnum.default('ALL_LEVELS'),
  defaultDurationMins: z.number().int().min(15).max(360).default(60),
  defaultCapacity: z.number().int().min(1).max(500).default(20),
  intensity: z.string().max(64).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateClassTypeRequest = z.input<typeof CreateClassTypeSchema>;

export const UpdateClassTypeSchema = CreateClassTypeSchema.partial();
export type UpdateClassTypeRequest = z.input<typeof UpdateClassTypeSchema>;

export const ClassTypeDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  level: ClassLevelEnum,
  defaultDurationMins: z.number(),
  defaultCapacity: z.number(),
  intensity: z.string().nullable(),
  isActive: z.boolean(),
  batchCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ClassTypeDetails = z.infer<typeof ClassTypeDetailsSchema>;

export const ClassTypeListQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  level: ClassLevelEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ClassTypeListQuery = z.input<typeof ClassTypeListQuerySchema>;

// ----------------------------------------------------------------------------
// Batches & Class Groups
// ----------------------------------------------------------------------------
export const BatchScheduleTypeEnum = z.enum(['RECURRING_WEEKLY', 'FIXED_WORKSHOP']);
export type BatchScheduleType = z.infer<typeof BatchScheduleTypeEnum>;

export const BatchStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);
export type BatchStatusType = z.infer<typeof BatchStatusEnum>;

export const CreateBatchSchema = z.object({
  classTypeId: z.string().uuid('Valid Class Type ID is required'),
  branchId: z.string().uuid('Valid Branch ID is required'),
  roomId: z.string().uuid('Valid Room ID is required'),
  instructorId: z.string().uuid('Valid Instructor ID is required'),
  name: z.string().min(2, 'Batch name must be at least 2 characters').max(150),
  description: z.string().max(2000).optional().nullable(),
  scheduleType: BatchScheduleTypeEnum.default('RECURRING_WEEKLY'),
  status: BatchStatusEnum.default('ACTIVE'),
  startDate: z.string().datetime(), // ISO string
  endDate: z.string().datetime().optional().nullable(),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  sessionDurationMins: z.number().int().min(15).max(360).default(60),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day of the week must be selected'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm (24-hour format)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be HH:mm (24-hour format)'),
});

export type CreateBatchRequest = z.input<typeof CreateBatchSchema>;

export const UpdateBatchSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(2000).optional().nullable(),
  classTypeId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  status: BatchStatusEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  capacity: z.number().int().min(1).optional(),
  sessionDurationMins: z.number().int().min(15).max(360).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

export type UpdateBatchRequest = z.input<typeof UpdateBatchSchema>;

export const BatchDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  classTypeId: z.string().uuid(),
  classTypeName: z.string().optional(),
  branchId: z.string().uuid(),
  branchName: z.string().optional(),
  roomId: z.string().uuid(),
  roomName: z.string().optional(),
  roomMaxCapacity: z.number().optional(),
  instructorId: z.string().uuid(),
  instructorName: z.string().optional(),
  name: z.string(),
  description: z.string().nullable(),
  scheduleType: BatchScheduleTypeEnum,
  status: BatchStatusEnum,
  startDate: z.string(),
  endDate: z.string().nullable(),
  capacity: z.number(),
  sessionDurationMins: z.number(),
  daysOfWeek: z.array(z.number()),
  startTime: z.string(),
  endTime: z.string(),
  sessionCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BatchDetails = z.infer<typeof BatchDetailsSchema>;

export const BatchListQuerySchema = z.object({
  search: z.string().optional(),
  branchId: z.string().uuid().optional(),
  classTypeId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  status: BatchStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type BatchListQuery = z.input<typeof BatchListQuerySchema>;

// ----------------------------------------------------------------------------
// Sessions & Calendar Scheduling
// ----------------------------------------------------------------------------
export const SessionStatusEnum = z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export type SessionStatusType = z.infer<typeof SessionStatusEnum>;

export const SessionDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  batchName: z.string().optional().nullable(),
  classTypeId: z.string().uuid(),
  classTypeName: z.string(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  roomId: z.string().uuid(),
  roomName: z.string(),
  instructorId: z.string().uuid(),
  instructorName: z.string(),
  sessionDate: z.string(), // ISO string YYYY-MM-DD
  startTimestamp: z.string(), // ISO UTC
  endTimestamp: z.string(), // ISO UTC
  capacity: z.number(),
  status: SessionStatusEnum,
  cancellationReason: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SessionDetails = z.infer<typeof SessionDetailsSchema>;

export const UpdateSessionInstanceSchema = z.object({
  roomId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  startTimestamp: z.string().datetime().optional(),
  endTimestamp: z.string().datetime().optional(),
  capacity: z.number().int().min(1).optional(),
  status: SessionStatusEnum.optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export type UpdateSessionInstanceRequest = z.input<typeof UpdateSessionInstanceSchema>;

export const CancelSessionInstanceSchema = z.object({
  cancellationReason: z.string().min(2, 'Cancellation reason is required').max(255),
});

export type CancelSessionInstanceRequest = z.input<typeof CancelSessionInstanceSchema>;

export const SessionCalendarQuerySchema = z.object({
  startDate: z.string().datetime('Valid start date UTC is required'),
  endDate: z.string().datetime('Valid end date UTC is required'),
  branchId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  classTypeId: z.string().uuid().optional(),
  status: SessionStatusEnum.optional(),
});

export type SessionCalendarQuery = z.infer<typeof SessionCalendarQuerySchema>;

export const GenerateSessionsSchema = z.object({
  batchId: z.string().uuid(),
  upToDate: z.string().datetime(), // generate up to this date
});

export type GenerateSessionsRequest = z.input<typeof GenerateSessionsSchema>;

// Instructor Summary for Dropdowns
export const InstructorSummarySchema = z.object({
  id: z.string().uuid(), // user.id
  fullName: z.string(),
  email: z.string(),
  role: z.string(),
});

export type InstructorSummary = z.infer<typeof InstructorSummarySchema>;
