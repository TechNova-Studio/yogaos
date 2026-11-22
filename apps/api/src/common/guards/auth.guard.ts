import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { prisma } from '@yogaos/database';
import { CryptoService } from '../services/crypto.service.js';
import { TenantContextService } from '../context/tenant-context.js';
import { AuthenticatedUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly crypto: CryptoService;
  private readonly tenantContext: TenantContextService;

  constructor(
    crypto?: CryptoService,
    tenantContext?: TenantContextService
  ) {
    this.crypto = crypto || new CryptoService();
    this.tenantContext = tenantContext || new TenantContextService();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();

    // 1. Extract session token from Authorization Header or Cookie
    const authHeader = request.headers['authorization'];
    let sessionToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    } else if (request.cookies?.['yogaos_session']) {
      sessionToken = request.cookies['yogaos_session'];
    }

    if (!sessionToken) {
      throw new UnauthorizedException('Authentication token is required');
    }

    // 2. Validate Session against database
    const tokenHash = this.crypto.hashToken(sessionToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }

    if (session.user.deletedAt) {
      throw new UnauthorizedException('User account has been deactivated');
    }

    // 3. Resolve & Validate Active Tenant Context
    // Check if client provided X-Tenant-ID header
    const requestedTenantId = request.headers['x-tenant-id'] as string | undefined;
    let activeTenantId = requestedTenantId || session.activeTenantId;

    let activeMembership = activeTenantId
      ? session.user.memberships.find((m) => m.tenantId === activeTenantId)
      : undefined;

    // If activeTenantId was requested by client but user is NOT an active member, reject immediately
    if (requestedTenantId && !activeMembership) {
      throw new ForbiddenException('User is not an active member of the requested organization');
    }

    // If no tenant requested and no session tenant, default to user's first active membership if available
    if (!activeTenantId && session.user.memberships.length > 0) {
      activeMembership = session.user.memberships[0];
      activeTenantId = activeMembership.tenantId;
    }

    const authenticatedUser: AuthenticatedUser = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      phone: session.user.phone,
      activeTenantId: activeMembership?.tenantId || null,
      activeRole: activeMembership?.role || null,
      sessionId: session.id,
    };

    request.user = authenticatedUser;

    // 4. Propagate Context via AsyncLocalStorage
    this.tenantContext.run(
      {
        userId: session.user.id,
        tenantId: activeMembership?.tenantId,
        userRole: activeMembership?.role,
        sessionId: session.id,
      },
      () => {}
    );

    return true;
  }
}
