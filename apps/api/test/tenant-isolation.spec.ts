import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { CryptoService } from '../src/common/services/crypto.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { MembershipsService } from '../src/modules/memberships/memberships.service.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { AuthGuard } from '../src/common/guards/auth.guard.js';
import { TenantContextService } from '../src/common/context/tenant-context.js';
import { ForbiddenException, UnauthorizedException, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, UserRole, MemberStatus } from '@yogaos/database';
import { Permissions } from '@yogaos/permissions';

describe('Multi-Tenancy, Tenant Isolation & Authorization', () => {
  let cryptoService: CryptoService;
  let auditService: AuditService;
  let authService: AuthService;
  let membershipsService: MembershipsService;
  let tenantContextService: TenantContextService;

  beforeEach(() => {
    cryptoService = new CryptoService();
    auditService = new AuditService();
    tenantContextService = new TenantContextService();
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);
    authService = new AuthService(cryptoService, auditService);
    membershipsService = new MembershipsService(cryptoService, auditService);
  });

  describe('Multi-Studio Identity & Tenant Context Switching', () => {
    it('should permit an instructor to switch to an organization they actively belong to', async () => {
      const instructorUserId = 'user-instructor-global';
      const sessionId = 'session-123';
      const targetTenantId = 'tenant-studio-north';

      vi.spyOn(prisma.organizationMember, 'findUnique').mockResolvedValue({
        id: 'member-north',
        tenantId: targetTenantId,
        userId: instructorUserId,
        role: 'INSTRUCTOR' as UserRole,
        status: 'ACTIVE' as MemberStatus,
        organization: { id: targetTenantId, name: 'North Studio', slug: 'north-studio' },
      } as any);

      const updateSessionSpy = vi.spyOn(prisma.session, 'update').mockResolvedValue({} as any);

      const result = await authService.switchTenant(instructorUserId, sessionId, targetTenantId);

      expect(result.activeTenantId).toBe(targetTenantId);
      expect(result.role).toBe('INSTRUCTOR');
      expect(updateSessionSpy).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { activeTenantId: targetTenantId },
      });
    });

    it('should strictly BLOCK switching to an organization the user does NOT belong to (ForbiddenException)', async () => {
      const instructorUserId = 'user-instructor-global';
      const sessionId = 'session-123';
      const rogueTenantId = 'tenant-rogue-studio';

      // User does not have a membership in rogueTenantId
      vi.spyOn(prisma.organizationMember, 'findUnique').mockResolvedValue(null);

      await expect(
        authService.switchTenant(instructorUserId, sessionId, rogueTenantId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should strictly BLOCK switching to an organization where user membership is SUSPENDED', async () => {
      const instructorUserId = 'user-instructor-global';
      const sessionId = 'session-123';
      const suspendedTenantId = 'tenant-studio-suspended';

      vi.spyOn(prisma.organizationMember, 'findUnique').mockResolvedValue({
        id: 'member-suspended',
        tenantId: suspendedTenantId,
        userId: instructorUserId,
        role: 'INSTRUCTOR' as UserRole,
        status: 'SUSPENDED' as MemberStatus,
        organization: { id: suspendedTenantId, name: 'Suspended Studio' },
      } as any);

      await expect(
        authService.switchTenant(instructorUserId, sessionId, suspendedTenantId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Cross-Tenant Read & Write Prevention', () => {
    it('should prevent updating or deleting a member that belongs to another tenant', async () => {
      const tenantAlpha = 'tenant-alpha-uuid';
      const tenantBeta = 'tenant-beta-uuid';
      const memberInBeta = 'member-in-beta-uuid';

      vi.spyOn(prisma.organizationMember, 'findUnique').mockResolvedValue({
        id: memberInBeta,
        tenantId: tenantBeta, // Belongs to Tenant Beta!
        userId: 'some-user',
        role: 'INSTRUCTOR' as UserRole,
      } as any);

      // Caller is in Tenant Alpha attempting to update Member in Tenant Beta
      await expect(
        membershipsService.updateMemberStatus(tenantAlpha, memberInBeta, 'caller-user-id', {
          status: 'SUSPENDED',
        })
      ).rejects.toThrow(NotFoundException);

      // Caller is in Tenant Alpha attempting to delete Member in Tenant Beta
      await expect(
        membershipsService.removeMember(tenantAlpha, memberInBeta, 'caller-user-id')
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject inviting a user who is already a member of the tenant', async () => {
      const tenantId = 'tenant-alpha-uuid';
      const email = 'existing.teacher@studio.in';

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-existing',
        email,
        memberships: [{ id: 'mem-1', tenantId }],
      } as any);

      await expect(
        membershipsService.inviteMember(tenantId, 'owner-id', {
          email,
          role: 'INSTRUCTOR',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Role-Based Authorization (RolesGuard)', () => {
    it('should ALLOW access when user active role matches required roles', () => {
      const reflectorMock = {
        getAllAndOverride: vi.fn().mockImplementation((key: string) => {
          if (key === 'roles') return ['OWNER', 'MANAGER'];
          return null;
        }),
      } as any;

      const rolesGuard = new RolesGuard(reflectorMock);
      const executionContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user-1',
              activeTenantId: 'tenant-1',
              activeRole: 'OWNER',
            },
          }),
        }),
      } as any;

      const allowed = rolesGuard.canActivate(executionContext);
      expect(allowed).toBe(true);
    });

    it('should FORBID access when user active role does not match required roles', () => {
      const reflectorMock = {
        getAllAndOverride: vi.fn().mockImplementation((key: string) => {
          if (key === 'roles') return ['OWNER', 'MANAGER'];
          return null;
        }),
      } as any;

      const rolesGuard = new RolesGuard(reflectorMock);
      const executionContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user-2',
              activeTenantId: 'tenant-1',
              activeRole: 'RECEPTIONIST', // RECEPTIONIST is not in [OWNER, MANAGER]
            },
          }),
        }),
      } as any;

      expect(() => rolesGuard.canActivate(executionContext)).toThrow(ForbiddenException);
    });

    it('should evaluate permission checks against the canonical @yogaos/permissions matrix', () => {
      const reflectorMock = {
        getAllAndOverride: vi.fn().mockImplementation((key: string) => {
          if (key === 'permission') return Permissions.ORG_MANAGE;
          return null;
        }),
      } as any;

      const rolesGuard = new RolesGuard(reflectorMock);

      // INSTRUCTOR attempting to perform ORG_MANAGE
      const instructorContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user-3',
              activeTenantId: 'tenant-1',
              activeRole: 'INSTRUCTOR',
            },
          }),
        }),
      } as any;

      expect(() => rolesGuard.canActivate(instructorContext)).toThrow(ForbiddenException);

      // OWNER attempting to perform ORG_MANAGE
      const ownerContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user-4',
              activeTenantId: 'tenant-1',
              activeRole: 'OWNER',
            },
          }),
        }),
      } as any;

      expect(rolesGuard.canActivate(ownerContext)).toBe(true);
    });
  });

  describe('Tenant Context Propagation & AuthGuard', () => {
    it('should reject requests without authorization token (UnauthorizedException)', async () => {
      const authGuard = new AuthGuard(cryptoService, tenantContextService);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
            cookies: {},
          }),
        }),
      } as any;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject requests with expired or revoked session tokens', async () => {
      const authGuard = new AuthGuard(cryptoService, tenantContextService);
      const token = 'revoked-session-token-xyz';

      vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
        id: 'session-id',
        tokenHash: cryptoService.hashToken(token),
        revokedAt: new Date(Date.now() - 10000), // Revoked!
        expiresAt: new Date(Date.now() + 10000),
      } as any);

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${token}` },
            cookies: {},
          }),
        }),
      } as any;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject arbitrary client-supplied X-Tenant-ID headers if the user is not a member of that tenant', async () => {
      const authGuard = new AuthGuard(cryptoService, tenantContextService);
      const token = 'valid-token';

      vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
        id: 'session-id',
        tokenHash: cryptoService.hashToken(token),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        activeTenantId: 'tenant-alpha',
        user: {
          id: 'user-id',
          email: 'user@yoga.in',
          fullName: 'Yoga Teacher',
          memberships: [
            { tenantId: 'tenant-alpha', role: 'INSTRUCTOR', status: 'ACTIVE' },
          ], // Only member of tenant-alpha!
        },
      } as any);

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${token}`,
              'x-tenant-id': 'tenant-rogue-victim', // Client supplying victim's tenant ID!
            },
            cookies: {},
          }),
        }),
      } as any;

      await expect(authGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
