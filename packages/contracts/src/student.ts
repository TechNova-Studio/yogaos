import { z } from 'zod';

export const StudentStatusEnum = z.enum(['LEAD', 'TRIAL', 'ACTIVE', 'INACTIVE', 'SUSPENDED']);
export type StudentStatusType = z.infer<typeof StudentStatusEnum>;

export const StudentHealthDisclaimerInputSchema = z.object({
  injurySummary: z.string().max(255).optional().nullable(),
  healthNotes: z.string().max(5000, 'Health notes cannot exceed 5000 characters').min(1, 'Health notes text is required'),
  hasPregnancyAlert: z.boolean().default(false),
  consentSigned: z.boolean().default(true),
});

export type StudentHealthDisclaimerInput = z.infer<typeof StudentHealthDisclaimerInputSchema>;

export const StudentConsentInputSchema = z.object({
  consentType: z.string().min(2).max(100), // LIABILITY_WAIVER, GENERAL_TERMS, etc.
  version: z.string().default('1.0'),
  isAgreed: z.boolean().default(true),
});

export type StudentConsentInput = z.infer<typeof StudentConsentInputSchema>;

export const CreateStudentSchema = z.object({
  homeBranchId: z.string().uuid('Valid home branch ID is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(150),
  mobilePhone: z.string().min(6, 'Valid mobile phone number is required').max(32),
  email: z.string().email('Invalid email address').optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z.string().max(32).optional().nullable(),
  emergencyContactName: z.string().min(2, 'Emergency contact name is required').max(150),
  emergencyContactPhone: z.string().min(6, 'Emergency contact phone is required').max(32),
  emergencyContactRelation: z.string().min(2, 'Emergency contact relation is required').max(64),
  status: StudentStatusEnum.optional().default('ACTIVE'),
  billingAddress: z.record(z.any()).optional().nullable(),
  billingStateCode: z.string().length(2).optional().nullable(),
  initialConsent: StudentConsentInputSchema.optional(),
  healthDisclaimer: StudentHealthDisclaimerInputSchema.optional(),
});

export type CreateStudentRequest = z.input<typeof CreateStudentSchema>;

export const UpdateStudentSchema = z.object({
  homeBranchId: z.string().uuid().optional(),
  fullName: z.string().min(2).max(150).optional(),
  mobilePhone: z.string().min(6).max(32).optional(),
  email: z.string().email().optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z.string().max(32).optional().nullable(),
  emergencyContactName: z.string().min(2).max(150).optional(),
  emergencyContactPhone: z.string().min(6).max(32).optional(),
  emergencyContactRelation: z.string().min(2).max(64).optional(),
  status: StudentStatusEnum.optional(),
  billingAddress: z.record(z.any()).optional().nullable(),
  billingStateCode: z.string().length(2).optional().nullable(),
});

export type UpdateStudentRequest = z.input<typeof UpdateStudentSchema>;

export const StudentHealthDisclaimerDetailsSchema = z.object({
  id: z.string().uuid(),
  injurySummary: z.string().nullable(),
  healthNotes: z.string(), // Decrypted for authorized roles
  hasPregnancyAlert: z.boolean(),
  consentSigned: z.boolean(),
  consentTimestamp: z.string(),
  updatedAt: z.string(),
});

export type StudentHealthDisclaimerDetails = z.infer<typeof StudentHealthDisclaimerDetailsSchema>;

export const StudentConsentDetailsSchema = z.object({
  id: z.string().uuid(),
  consentType: z.string(),
  version: z.string(),
  isAgreed: z.boolean(),
  agreedAt: z.string(),
  ipAddress: z.string().nullable(),
});

export type StudentConsentDetails = z.infer<typeof StudentConsentDetailsSchema>;

export const StudentActivityDetailsSchema = z.object({
  id: z.string().uuid(),
  activityType: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  performedByName: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  createdAt: z.string(),
});

export type StudentActivityDetails = z.infer<typeof StudentActivityDetailsSchema>;

export const CreateStudentNoteSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
});

export type CreateStudentNoteRequest = z.infer<typeof CreateStudentNoteSchema>;

export const StudentSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  homeBranchId: z.string().uuid(),
  homeBranchName: z.string().optional(),
  fullName: z.string(),
  mobilePhone: z.string(),
  email: z.string().nullable(),
  status: StudentStatusEnum,
  hasHealthAlert: z.boolean(),
  cautionBadge: z.string().optional(), // Non-clinical caution badge for front desk
  createdAt: z.string(),
});

export type StudentSummary = z.infer<typeof StudentSummarySchema>;

export const StudentDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  homeBranchId: z.string().uuid(),
  homeBranchName: z.string().optional(),
  fullName: z.string(),
  mobilePhone: z.string(),
  email: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string(),
  emergencyContactRelation: z.string(),
  status: StudentStatusEnum,
  billingAddress: z.record(z.any()).optional().nullable(),
  billingStateCode: z.string().nullable(),
  hasHealthAlert: z.boolean(),
  cautionBadge: z.string().optional(),
  healthDisclaimer: StudentHealthDisclaimerDetailsSchema.optional().nullable(), // Null for RECEPTIONIST
  consents: z.array(StudentConsentDetailsSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StudentDetails = z.infer<typeof StudentDetailsSchema>;

export const StudentListQuerySchema = z.object({
  search: z.string().optional(),
  branchId: z.string().uuid().optional(),
  status: StudentStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StudentListQuery = z.input<typeof StudentListQuerySchema>;
