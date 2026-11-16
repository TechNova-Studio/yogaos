import { z } from 'zod';

export const LeadStatusEnum = z.enum(['NEW', 'CONTACTED', 'TRIAL_BOOKED', 'CONVERTED', 'LOST']);
export type LeadStatusType = z.infer<typeof LeadStatusEnum>;

export const LeadSourceEnum = z.enum(['WALK_IN', 'WEBSITE', 'INSTAGRAM', 'REFERRAL', 'OTHER']);
export type LeadSourceType = z.infer<typeof LeadSourceEnum>;

export const CreateLeadSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(150),
  phone: z.string().min(6, 'Valid phone number is required').max(32),
  email: z.string().email('Invalid email address').optional().nullable(),
  source: LeadSourceEnum.optional().default('WALK_IN'),
  interestedProgram: z.string().max(100).optional().nullable(),
  status: LeadStatusEnum.optional().default('NEW'),
  followUpDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateLeadRequest = z.input<typeof CreateLeadSchema>;

export const UpdateLeadSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(2).max(150).optional(),
  phone: z.string().min(6).max(32).optional(),
  email: z.string().email().optional().nullable(),
  source: LeadSourceEnum.optional(),
  interestedProgram: z.string().max(100).optional().nullable(),
  status: LeadStatusEnum.optional(),
  followUpDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type UpdateLeadRequest = z.input<typeof UpdateLeadSchema>;

export const ConvertLeadSchema = z.object({
  homeBranchId: z.string().uuid('Home branch ID is required for converted student'),
  emergencyContactName: z.string().min(2, 'Emergency contact name is required').max(150),
  emergencyContactPhone: z.string().min(6, 'Emergency contact phone is required').max(32),
  emergencyContactRelation: z.string().min(2, 'Emergency contact relation is required').max(64),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z.string().max(32).optional().nullable(),
});

export type ConvertLeadRequest = z.input<typeof ConvertLeadSchema>;

export const LeadDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  branchName: z.string().optional().nullable(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  source: LeadSourceEnum,
  interestedProgram: z.string().nullable(),
  status: LeadStatusEnum,
  followUpDate: z.string().nullable(),
  notes: z.string().nullable(),
  convertedStudentId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LeadDetails = z.infer<typeof LeadDetailsSchema>;

export const LeadListQuerySchema = z.object({
  search: z.string().optional(),
  branchId: z.string().uuid().optional(),
  status: LeadStatusEnum.optional(),
  source: LeadSourceEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;
