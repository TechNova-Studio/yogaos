import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, UserRole, MemberStatus } from '@yogaos/database';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { CryptoService } from '../src/common/services/crypto.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { MembershipsService } from '../src/modules/memberships/memberships.service.js';
import { OrganizationsService } from '../src/modules/organizations/organizations.service.js';
import { AuthGuard } from '../src/common/guards/auth.guard.js';
import { TenantContextService } from '../src/common/context/tenant-context.js';
import { UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('P07 Real Database Integration Tests (PostgreSQL 16)', () => {
  let cryptoService: CryptoService;
  let auditService: AuditService;
  let authService: AuthService;
  let membershipsService: MembershipsService;
  let organizationsService: OrganizationsService;

  // Track created IDs for strict test cleanup
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    cryptoService = new CryptoService();
    auditService = new AuditService();
    authService = new AuthService(cryptoService, auditService);
    membershipsService = new MembershipsService(cryptoService, auditService);
    organizationsService = new OrganizationsService(auditService);

    // Verify real PostgreSQL connection
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].version).toContain('PostgreSQL 16');
  });

  afterAll(async () => {
    // Clean up created test data
    if (createdOrgIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.invitation.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.organizationMember.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  describe('1. Global User Identity & Multi-Organization Memberships', () => {
    it('should persist 1 global user with multiple distinct studio memberships and independent roles', async () => {
      // 1. Create a global user
      const user = await prisma.user.create({
        data: {
          email: `instructor.${Date.now()}@yogaos-test.in`,
          fullName: 'Aarav Shastri',
        },
      });
      createdUserIds.push(user.id);

      // 2. Create Studio Alpha (South Delhi)
      const studioAlpha = await prisma.organization.create({
        data: {
          name: `Prana Studio Alpha ${Date.now()}`,
          slug: `prana-alpha-${Date.now()}`,
        },
      });
      createdOrgIds.push(studioAlpha.id);

      // 3. Create Studio Beta (Indiranagar BLR)
      const studioBeta = await prisma.organization.create({
        data: {
          name: `Asana Shala Beta ${Date.now()}`,
          slug: `asana-beta-${Date.now()}`,
        },
      });
      createdOrgIds.push(studioBeta.id);

      // 4. Assign INSTRUCTOR in Alpha, and MANAGER in Beta
      const memberAlpha = await prisma.organizationMember.create({
        data: {
          userId: user.id,
          tenantId: studioAlpha.id,
          role: 'INSTRUCTOR' as UserRole,
          status: 'ACTIVE' as MemberStatus,
        },
      });

      const memberBeta = await prisma.organizationMember.create({
        data: {
          userId: user.id,
          tenantId: studioBeta.id,
          role: 'MANAGER' as UserRole,
          status: 'ACTIVE' as MemberStatus,
        },
      });

      // 5. Query user memberships from real PostgreSQL
      const dbMemberships = await prisma.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: true },
        orderBy: { createdAt: 'asc' },
      });

      expect(dbMemberships).toHaveLength(2);
      expect(dbMemberships[0].tenantId).toBe(studioAlpha.id);
      expect(dbMemberships[0].role).toBe('INSTRUCTOR');
      expect(dbMemberships[1].tenantId).toBe(studioBeta.id);
      expect(dbMemberships[1].role).toBe('MANAGER');
    });

    it('should enforce unique constraint on [tenantId, userId] preventing duplicate memberships', async () => {
      const user = await prisma.user.create({
        data: {
          email: `duplicate.test.${Date.now()}@yogaos-test.in`,
          fullName: 'Duplicate Tester',
        },
      });
      createdUserIds.push(user.id);

      const org = await prisma.organization.create({
        data: {
          name: `Unique Org ${Date.now()}`,
          slug: `unique-org-${Date.now()}`,
        },
      });
      createdOrgIds.push(org.id);

      // First membership insert succeeds
      await prisma.organizationMember.create({
        data: {
          userId: user.id,
          tenantId: org.id,
          role: 'RECEPTIONIST' as UserRole,
        },
      });

      // Second membership insert for SAME user and tenant must fail with unique constraint violation (P2002)
      await expect(
        prisma.organizationMember.create({
          data: {
            userId: user.id,
            tenantId: org.id,
            role: 'INSTRUCTOR' as UserRole,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('2. Real Authentication, Password Hashing & Audit Logging', () => {
    const testEmail = `auth.real.${Date.now()}@yogaos-test.in`;
    const testPassword = 'SecurePassword#2026';
    let registeredUserId: string;
    let validSessionToken: string;

    it('should register a new user in PostgreSQL with bcrypt hash and audit log entry', async () => {
      const authResponse = await authService.register({
        email: testEmail,
        password: testPassword,
        fullName: 'Devika Pillai',
      });

      registeredUserId = authResponse.user.id;
      validSessionToken = authResponse.token;
      createdUserIds.push(registeredUserId);

      // Verify User record in DB
      const dbUser = await prisma.user.findUnique({
        where: { id: registeredUserId },
        include: { credentials: true, sessions: true },
      });

      expect(dbUser).not.toBeNull();
      expect(dbUser?.email).toBe(testEmail);
      expect(dbUser?.credentials).toHaveLength(1);

      // Verify bcrypt hash format
      const cred = dbUser?.credentials[0];
      expect(cred?.type).toBe('PASSWORD');
      expect(cred?.secretHash).not.toBe(testPassword);
      expect(cred?.secretHash.startsWith('$2')).toBe(true);

      // Verify session in DB
      expect(dbUser?.sessions).toHaveLength(1);
      const session = dbUser?.sessions[0];
      expect(session?.tokenHash).toBe(cryptoService.hashToken(validSessionToken));

      // Verify AuditLog in DB
      const auditEntry = await prisma.auditLog.findFirst({
        where: { userId: registeredUserId, action: 'AUTH_REGISTER' },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.resourceType).toBe('User');
    });

    it('should successfully log in with correct password and reject incorrect password', async () => {
      // Correct password
      const loginSuccess = await authService.login({
        email: testEmail,
        password: testPassword,
      });
      expect(loginSuccess.user.email).toBe(testEmail);
      expect(loginSuccess.token).toBeDefined();

      // Incorrect password
      await expect(
        authService.login({
          email: testEmail,
          password: 'WrongPassword123',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke session on logout and set revokedAt timestamp, invalidating future authentication', async () => {
      // Verify session exists and is unrevoked before logout
      const tokenHash = cryptoService.hashToken(validSessionToken);
      const sessionBefore = await prisma.session.findUnique({
        where: { tokenHash },
      });
      expect(sessionBefore).not.toBeNull();
      expect(sessionBefore?.revokedAt).toBeNull();

      // Perform logout
      await authService.logout(validSessionToken);

      // Verify session is marked as revoked in PostgreSQL
      const sessionAfter = await prisma.session.findUnique({
        where: { tokenHash },
      });
      expect(sessionAfter).not.toBeNull();
      expect(sessionAfter?.revokedAt).toBeInstanceOf(Date);

      // Test that AuthGuard rejects the revoked session token
      const authGuard = new AuthGuard(cryptoService, new TenantContextService());
      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${validSessionToken}` },
          }),
        }),
      };

      await expect(authGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('3. Tenant Context Switching & Membership Validation', () => {
    it('should update activeTenantId in database session when switching to an active studio membership', async () => {
      // Create user and two studios
      const user = await prisma.user.create({
        data: {
          email: `switch.test.${Date.now()}@yogaos-test.in`,
          fullName: 'Kiran Patel',
        },
      });
      createdUserIds.push(user.id);

      const studio1 = await prisma.organization.create({
        data: { name: `Studio 1 ${Date.now()}`, slug: `studio-1-${Date.now()}` },
      });
      const studio2 = await prisma.organization.create({
        data: { name: `Studio 2 ${Date.now()}`, slug: `studio-2-${Date.now()}` },
      });
      createdOrgIds.push(studio1.id, studio2.id);

      // Assign active membership in Studio 1 and Studio 2
      await prisma.organizationMember.create({
        data: { userId: user.id, tenantId: studio1.id, role: 'INSTRUCTOR', status: 'ACTIVE' },
      });
      await prisma.organizationMember.create({
        data: { userId: user.id, tenantId: studio2.id, role: 'MANAGER', status: 'ACTIVE' },
      });

      // Create session
      const rawToken = cryptoService.generateRandomToken();
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: cryptoService.hashToken(rawToken),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Switch to Studio 1
      const switch1 = await authService.switchTenant(user.id, session.id, studio1.id);
      expect(switch1.activeTenantId).toBe(studio1.id);
      expect(switch1.role).toBe('INSTRUCTOR');

      // Verify DB session updated
      let dbSession = await prisma.session.findUnique({ where: { id: session.id } });
      expect(dbSession?.activeTenantId).toBe(studio1.id);

      // Switch to Studio 2
      const switch2 = await authService.switchTenant(user.id, session.id, studio2.id);
      expect(switch2.activeTenantId).toBe(studio2.id);
      expect(switch2.role).toBe('MANAGER');

      dbSession = await prisma.session.findUnique({ where: { id: session.id } });
      expect(dbSession?.activeTenantId).toBe(studio2.id);
    });

    it('should deny tenant switch if user is NOT a member or membership is SUSPENDED', async () => {
      const user = await prisma.user.create({
        data: { email: `forbidden.switch.${Date.now()}@yogaos-test.in`, fullName: 'Unauthorized User' },
      });
      createdUserIds.push(user.id);

      const unassociatedOrg = await prisma.organization.create({
        data: { name: `Unassociated Org ${Date.now()}`, slug: `unassociated-${Date.now()}` },
      });
      const suspendedOrg = await prisma.organization.create({
        data: { name: `Suspended Org ${Date.now()}`, slug: `suspended-${Date.now()}` },
      });
      createdOrgIds.push(unassociatedOrg.id, suspendedOrg.id);

      // Suspended membership in suspendedOrg
      await prisma.organizationMember.create({
        data: { userId: user.id, tenantId: suspendedOrg.id, role: 'INSTRUCTOR', status: 'SUSPENDED' },
      });

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: cryptoService.hashToken(cryptoService.generateRandomToken()),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Switch to unassociated org -> Forbidden
      await expect(
        authService.switchTenant(user.id, session.id, unassociatedOrg.id)
      ).rejects.toThrow(ForbiddenException);

      // Switch to suspended org -> Forbidden
      await expect(
        authService.switchTenant(user.id, session.id, suspendedOrg.id)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Cross-Tenant Read & Write Denial (Tenant Isolation)', () => {
    it('should strictly isolate member reads between distinct studio tenants', async () => {
      const orgA = await prisma.organization.create({
        data: { name: `Tenant A ${Date.now()}`, slug: `tenant-a-${Date.now()}` },
      });
      const orgB = await prisma.organization.create({
        data: { name: `Tenant B ${Date.now()}`, slug: `tenant-b-${Date.now()}` },
      });
      createdOrgIds.push(orgA.id, orgB.id);

      const userA = await prisma.user.create({
        data: { email: `usera.${Date.now()}@yogaos-test.in`, fullName: 'User A' },
      });
      const userB = await prisma.user.create({
        data: { email: `userb.${Date.now()}@yogaos-test.in`, fullName: 'User B' },
      });
      createdUserIds.push(userA.id, userB.id);

      await prisma.organizationMember.create({
        data: { userId: userA.id, tenantId: orgA.id, role: 'INSTRUCTOR' },
      });
      await prisma.organizationMember.create({
        data: { userId: userB.id, tenantId: orgB.id, role: 'INSTRUCTOR' },
      });

      // Query members for Tenant A
      const membersA = await membershipsService.getMembers(orgA.id);
      expect(membersA.some((m) => m.userId === userA.id)).toBe(true);
      expect(membersA.some((m) => m.userId === userB.id)).toBe(false);

      // Query members for Tenant B
      const membersB = await membershipsService.getMembers(orgB.id);
      expect(membersB.some((m) => m.userId === userB.id)).toBe(true);
      expect(membersB.some((m) => m.userId === userA.id)).toBe(false);
    });

    it('should deny updating a member belonging to a different tenant (Cross-tenant write denial)', async () => {
      const orgA = await prisma.organization.create({
        data: { name: `Org A ${Date.now()}`, slug: `orga-${Date.now()}` },
      });
      const orgB = await prisma.organization.create({
        data: { name: `Org B ${Date.now()}`, slug: `orgb-${Date.now()}` },
      });
      createdOrgIds.push(orgA.id, orgB.id);

      const userB = await prisma.user.create({
        data: { email: `userb.write.${Date.now()}@yogaos-test.in`, fullName: 'User B Write' },
      });
      createdUserIds.push(userB.id);

      const memberInOrgB = await prisma.organizationMember.create({
        data: { userId: userB.id, tenantId: orgB.id, role: 'INSTRUCTOR', status: 'ACTIVE' },
      });

      // Attempt to update memberInOrgB using orgA tenant context -> Must fail with NotFoundException
      await expect(
        membershipsService.updateMemberStatus(orgA.id, memberInOrgB.id, 'some-caller-id', {
          status: 'SUSPENDED',
        })
      ).rejects.toThrow(NotFoundException);

      // Verify status in DB remained ACTIVE
      const memberAfter = await prisma.organizationMember.findUnique({
        where: { id: memberInOrgB.id },
      });
      expect(memberAfter?.status).toBe('ACTIVE');
    });
  });
});
