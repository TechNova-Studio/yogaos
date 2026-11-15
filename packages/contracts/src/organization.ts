import { z } from 'zod';
import { UserRoleSchema, MemberStatusSchema, UserProfileSchema } from './auth.js';

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters long'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  legalEntityName: z.string().optional(),
  currency: z.string().optional().default('INR'),
  timezone: z.string().optional().default('Asia/Kolkata'),
});
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;

export const OrganizationDetailsSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  legalEntityName: z.string().nullable().optional(),
  currency: z.string(),
  timezone: z.string(),
  isGstRegistered: z.boolean(),
  gstin: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type OrganizationDetails = z.infer<typeof OrganizationDetailsSchema>;

export const InviteMemberRequestSchema = z.object({
  email: z.string().email(),
  role: UserRoleSchema,
  branchScope: z.array(z.string()).optional(),
});
export type InviteMemberRequest = z.infer<typeof InviteMemberRequestSchema>;

export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(16),
});
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;

export const OrganizationMemberDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: UserRoleSchema,
  status: MemberStatusSchema,
  branchScope: z.any().optional(),
  user: UserProfileSchema,
  createdAt: z.string(),
});
export type OrganizationMemberDetails = z.infer<typeof OrganizationMemberDetailsSchema>;

export const UpdateMemberStatusRequestSchema = z.object({
  status: MemberStatusSchema,
  role: UserRoleSchema.optional(),
});
export type UpdateMemberStatusRequest = z.infer<typeof UpdateMemberStatusRequestSchema>;
