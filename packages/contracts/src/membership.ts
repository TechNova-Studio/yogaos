import { z } from 'zod';

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------
export const PlanTypeEnum = z.enum([
  'TIME_UNLIMITED',
  'CLASS_PACK',
  'SINGLE_DROP_IN',
]);
export type PlanType = z.infer<typeof PlanTypeEnum>;

export const MembershipStatusEnum = z.enum([
  'ACTIVE',
  'FROZEN',
  'EXPIRED',
  'CANCELLED',
]);
export type MembershipStatus = z.infer<typeof MembershipStatusEnum>;

export const CreditLedgerEntryTypeEnum = z.enum([
  'INITIAL_ALLOCATION',
  'REDEMPTION',
  'REFUND_RESTORE',
  'MANUAL_ADJUSTMENT',
  'EXPIRATION',
]);
export type CreditLedgerEntryType = z.infer<typeof CreditLedgerEntryTypeEnum>;

// ----------------------------------------------------------------------------
// Membership Plan Schemas
// ----------------------------------------------------------------------------
export const CreateMembershipPlanSchema = z
  .object({
    name: z.string().trim().min(2, 'Plan name must be at least 2 characters').max(100),
    description: z.string().trim().max(1000).optional().nullable(),
    planType: PlanTypeEnum,
    price: z.coerce.number().min(0, 'Price cannot be negative'),
    taxRatePercent: z.coerce.number().min(0).max(100).default(18.00),
    sacCode: z.string().trim().default('9992'),
    validityDays: z.coerce.number().int().min(1, 'Validity must be at least 1 day'),
    creditCount: z.coerce.number().int().min(1).optional().nullable(),
    maxFreezesAllowed: z.coerce.number().int().min(0).default(0),
    maxFreezeDays: z.coerce.number().int().min(0).default(0),
    isMultiBranchValid: z.boolean().default(true),
    homeBranchId: z.string().uuid().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.planType === 'CLASS_PACK' && (!data.creditCount || data.creditCount <= 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Class pack plans require a positive credit count',
      path: ['creditCount'],
    },
  );

export type CreateMembershipPlanRequest = z.input<typeof CreateMembershipPlanSchema>;

export const UpdateMembershipPlanSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).optional(),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
  sacCode: z.string().trim().optional(),
  validityDays: z.coerce.number().int().min(1).optional(),
  creditCount: z.coerce.number().int().min(1).optional().nullable(),
  maxFreezesAllowed: z.coerce.number().int().min(0).optional(),
  maxFreezeDays: z.coerce.number().int().min(0).optional(),
  isMultiBranchValid: z.boolean().optional(),
  homeBranchId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateMembershipPlanRequest = z.input<typeof UpdateMembershipPlanSchema>;

export const MembershipPlanDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  planType: PlanTypeEnum,
  price: z.number(),
  taxRatePercent: z.number(),
  sacCode: z.string(),
  validityDays: z.number(),
  creditCount: z.number().nullable(),
  maxFreezesAllowed: z.number(),
  maxFreezeDays: z.number(),
  isMultiBranchValid: z.boolean(),
  homeBranchId: z.string().nullable(),
  homeBranchName: z.string().optional().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MembershipPlanDetails = z.infer<typeof MembershipPlanDetailsSchema>;

export const MembershipPlanListQuerySchema = z.object({
  planType: PlanTypeEnum.optional(),
  isActive: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return val;
  }, z.boolean().optional()),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type MembershipPlanListQuery = z.input<typeof MembershipPlanListQuerySchema>;

// ----------------------------------------------------------------------------
// Student Membership Schemas
// ----------------------------------------------------------------------------
export const AssignStudentMembershipSchema = z.object({
  studentId: z.string().uuid('Valid student ID is required'),
  membershipPlanId: z.string().uuid('Valid membership plan ID is required'),
  startDate: z.string().optional(),
  homeBranchId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type AssignStudentMembershipRequest = z.input<typeof AssignStudentMembershipSchema>;

export const FreezeMembershipSchema = z.object({
  freezeReason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(255),
});

export type FreezeMembershipRequest = z.input<typeof FreezeMembershipSchema>;

export const CancelMembershipSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(255),
});

export type CancelMembershipRequest = z.input<typeof CancelMembershipSchema>;

export const StudentMembershipDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  studentPhone: z.string().optional(),
  membershipPlanId: z.string().uuid(),
  homeBranchId: z.string().nullable(),
  homeBranchName: z.string().optional().nullable(),
  planNameSnapshot: z.string(),
  planTypeSnapshot: PlanTypeEnum,
  priceSnapshot: z.number(),
  isMultiBranchSnapshot: z.boolean(),
  status: MembershipStatusEnum,
  startDate: z.string(),
  expiryDate: z.string(),
  totalCredits: z.number().nullable(),
  remainingCredits: z.number().nullable(),
  freezesUsed: z.number(),
  frozenAt: z.string().nullable(),
  freezeReason: z.string().nullable(),
  totalFrozenDays: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StudentMembershipDetails = z.infer<typeof StudentMembershipDetailsSchema>;

export const StudentMembershipListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  status: MembershipStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type StudentMembershipListQuery = z.input<typeof StudentMembershipListQuerySchema>;

// ----------------------------------------------------------------------------
// Credit Ledger Schemas
// ----------------------------------------------------------------------------
export const CreditLedgerEntryDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  studentMembershipId: z.string().uuid(),
  studentId: z.string().uuid(),
  bookingId: z.string().nullable(),
  entryType: CreditLedgerEntryTypeEnum,
  creditsDelta: z.number(),
  balanceAfter: z.number(),
  reason: z.string().nullable(),
  performedByUserId: z.string().nullable(),
  performedByUserName: z.string().optional().nullable(),
  createdAt: z.string(),
});

export type CreditLedgerEntryDetails = z.infer<typeof CreditLedgerEntryDetailsSchema>;

export const ManualCreditAdjustmentSchema = z.object({
  creditsDelta: z.coerce.number().int().refine((val) => val !== 0, 'Adjustment delta cannot be 0'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(255),
});

export type ManualCreditAdjustmentRequest = z.input<typeof ManualCreditAdjustmentSchema>;

export const CreditLedgerListQuerySchema = z.object({
  studentMembershipId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreditLedgerListQuery = z.input<typeof CreditLedgerListQuerySchema>;

// ----------------------------------------------------------------------------
// Eligibility Schemas
// ----------------------------------------------------------------------------
export const CheckBookingEligibilityQuerySchema = z.object({
  studentId: z.string().uuid(),
  sessionInstanceId: z.string().uuid(),
});

export type CheckBookingEligibilityQuery = z.input<typeof CheckBookingEligibilityQuerySchema>;

export const MembershipEligibilityResultSchema = z.object({
  eligible: z.boolean(),
  studentMembershipId: z.string().nullable().optional(),
  planType: PlanTypeEnum.nullable().optional(),
  planName: z.string().nullable().optional(),
  remainingCredits: z.number().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  reason: z.string(),
});

export type MembershipEligibilityResult = z.infer<typeof MembershipEligibilityResultSchema>;
