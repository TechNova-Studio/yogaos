import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@yogaos/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  activeTenantId?: string | null;
  activeRole?: UserRole | null;
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  }
);
