import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@yogaos/database';
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  UserProfile,
  MembershipSummary,
} from '@yogaos/contracts';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  async register(
    data: RegisterRequest,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const secretHash = await this.crypto.hashPassword(data.password);
    const sessionToken = this.crypto.generateRandomToken();
    const tokenHash = this.crypto.hashToken(sessionToken);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          fullName: data.fullName,
          phone: data.phone || null,
        },
      });

      await tx.userCredential.create({
        data: {
          userId: newUser.id,
          type: 'PASSWORD',
          secretHash,
        },
      });

      await tx.session.create({
        data: {
          userId: newUser.id,
          tokenHash,
          userAgent: meta.userAgent || null,
          ipAddress: meta.ip || null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return newUser;
    });

    await this.audit.log({
      userId: user.id,
      action: 'AUTH_REGISTER',
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: this.mapUserProfile(user),
      token: sessionToken,
      activeTenantId: null,
      memberships: [],
    };
  }

  async login(
    data: LoginRequest,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        credentials: {
          where: { type: 'PASSWORD' },
        },
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user || user.credentials.length === 0) {
      await this.audit.log({
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'User',
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        details: { email: data.email },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const credential = user.credentials[0];
    const passwordMatch = await this.crypto.comparePassword(data.password, credential.secretHash);

    if (!passwordMatch) {
      await this.audit.log({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    const sessionToken = this.crypto.generateRandomToken();
    const tokenHash = this.crypto.hashToken(sessionToken);
    const activeTenantId = user.memberships.length > 0 ? user.memberships[0].tenantId : null;

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        activeTenantId,
        userAgent: meta.userAgent || null,
        ipAddress: meta.ip || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    await this.audit.log({
      userId: user.id,
      tenantId: activeTenantId,
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: this.mapUserProfile(user),
      token: sessionToken,
      activeTenantId,
      memberships: user.memberships.map((m) => this.mapMembershipSummary(m)),
    };
  }

  async logout(sessionToken: string): Promise<void> {
    const tokenHash = this.crypto.hashToken(sessionToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
    });

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await this.audit.log({
        userId: session.userId,
        tenantId: session.activeTenantId,
        action: 'AUTH_LOGOUT',
        resourceType: 'Session',
        resourceId: session.id,
      });
    }
  }

  async getProfile(userId: string): Promise<UserProfile & { memberships: MembershipSummary[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      ...this.mapUserProfile(user),
      memberships: user.memberships.map((m) => this.mapMembershipSummary(m)),
    };
  }

  async switchTenant(
    userId: string,
    sessionId: string,
    targetTenantId: string,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<{ activeTenantId: string; role: string }> {
    // 1. Validate that the user is an ACTIVE member of target organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: targetTenantId,
          userId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      await this.audit.log({
        userId,
        tenantId: targetTenantId,
        action: 'TENANT_SWITCH_DENIED',
        resourceType: 'Organization',
        resourceId: targetTenantId,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException('User is not an active member of this organization');
    }

    // 2. Update session active tenant
    await prisma.session.update({
      where: { id: sessionId },
      data: { activeTenantId: targetTenantId },
    });

    await this.audit.log({
      userId,
      tenantId: targetTenantId,
      action: 'TENANT_SWITCH_SUCCESS',
      resourceType: 'Organization',
      resourceId: targetTenantId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      activeTenantId: membership.tenantId,
      role: membership.role,
    };
  }

  private mapUserProfile(user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone || null,
      avatarUrl: user.avatarUrl || null,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    };
  }

  private mapMembershipSummary(membership: {
    id: string;
    tenantId: string;
    role: string;
    status: string;
    organization: { name: string; slug: string };
  }): MembershipSummary {
    return {
      id: membership.id,
      tenantId: membership.tenantId,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      role: membership.role as any,
      status: membership.status as any,
    };
  }
}
