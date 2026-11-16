import { z } from 'zod';

export const CreateBranchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters').max(150),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be URL-safe (lowercase letters, numbers, hyphens)'),
  streetAddress: z.string().min(3, 'Street address is required'),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  stateCode: z.string().length(2, 'State code must be 2 digits (Indian GST state code)'),
  postalCode: z.string().min(3).max(16),
  phone: z.string().min(6).max(32),
  email: z.string().email('Invalid email address'),
  operatingHours: z.record(z.any()).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateBranchRequest = z.input<typeof CreateBranchSchema>;

export const UpdateBranchSchema = CreateBranchSchema.partial();
export type UpdateBranchRequest = z.input<typeof UpdateBranchSchema>;

export const BranchDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  streetAddress: z.string(),
  city: z.string(),
  state: z.string(),
  stateCode: z.string(),
  postalCode: z.string(),
  phone: z.string(),
  email: z.string(),
  operatingHours: z.record(z.any()).optional().nullable(),
  isActive: z.boolean(),
  roomCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BranchDetails = z.infer<typeof BranchDetailsSchema>;

export const CreateRoomSchema = z.object({
  branchId: z.string().uuid('Valid branch ID is required'),
  name: z.string().min(1, 'Room name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  maxMatCapacity: z.number().int().min(1, 'Capacity must be at least 1 mat'),
  isActive: z.boolean().default(true),
});

export type CreateRoomRequest = z.input<typeof CreateRoomSchema>;

export const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  maxMatCapacity: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRoomRequest = z.input<typeof UpdateRoomSchema>;

export const RoomDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  maxMatCapacity: z.number(),
  isActive: z.boolean(),
  branchName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RoomDetails = z.infer<typeof RoomDetailsSchema>;

export const UpdateOrganizationSettingsSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  legalEntityName: z.string().max(255).optional().nullable(),
  currency: z.string().length(3).optional(),
  timezone: z.string().min(2).max(64).optional(),
  isGstRegistered: z.boolean().optional(),
  gstin: z.string().max(15).optional().nullable(),
  panNumber: z.string().max(10).optional().nullable(),
  billingAddress: z.record(z.any()).optional().nullable(),
  settings: z.record(z.any()).optional().nullable(),
});

export type UpdateOrganizationSettingsRequest = z.infer<typeof UpdateOrganizationSettingsSchema>;
