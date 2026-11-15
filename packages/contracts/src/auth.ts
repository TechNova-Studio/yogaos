import { z } from 'zod';

export const UserRoleSchema = z.enum(['OWNER', 'MANAGER', 'INSTRUCTOR', 'RECEPTIONIST']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const MemberStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
  phone: z.string().optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  isEmailVerified: z.boolean(),
  isPhoneVerified: z.boolean(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const MembershipSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: UserRoleSchema,
  status: MemberStatusSchema,
});
export type MembershipSummary = z.infer<typeof MembershipSummarySchema>;

export const AuthResponseSchema = z.object({
  user: UserProfileSchema,
  token: z.string(),
  activeTenantId: z.string().uuid().nullable().optional(),
  memberships: z.array(MembershipSummarySchema),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const SwitchTenantRequestSchema = z.object({
  tenantId: z.string().uuid(),
});
export type SwitchTenantRequest = z.infer<typeof SwitchTenantRequestSchema>;
