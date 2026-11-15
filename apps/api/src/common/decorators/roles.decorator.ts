import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@yogaos/database';
import { PermissionType } from '@yogaos/permissions';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: PermissionType) =>
  SetMetadata(PERMISSION_KEY, permission);
