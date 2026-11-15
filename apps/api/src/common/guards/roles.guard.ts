import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@yogaos/database';
import { hasPermission, PermissionType } from '@yogaos/permissions';
import { ROLES_KEY, PERMISSION_KEY } from '../decorators/roles.decorator.js';
import { AuthenticatedUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermission = this.reflector.getAllAndOverride<PermissionType>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles && !requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !user.activeRole) {
      throw new ForbiddenException('Tenant organization context and active role required');
    }

    // Role check
    if (requiredRoles && !requiredRoles.includes(user.activeRole)) {
      throw new ForbiddenException(
        `Insufficient role: requires one of [${requiredRoles.join(', ')}], active role is ${user.activeRole}`
      );
    }

    // Permission check
    if (requiredPermission && !hasPermission(user.activeRole, requiredPermission)) {
      throw new ForbiddenException(
        `Insufficient permission: requires ${requiredPermission} for role ${user.activeRole}`
      );
    }

    return true;
  }
}
