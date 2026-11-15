import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, UserRole, MemberStatus, InvitationStatus } from '@yogaos/database';
import {
  InviteMemberRequest,
  UpdateMemberStatusRequest,
  OrganizationMemberDetails,
} from '@yogaos/contracts';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  async getMembers(tenantId: string): Promise<OrganizationMemberDetails[]> {
    const members = await prisma.organizationMember.findMany({
      where: { tenantId },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      userId: m.userId,
      role: m.role as any,
      status: m.status as any,
      branchScope: m.branchScope,
      user: {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
        phone: m.user.phone,
        avatarUrl: m.user.avatarUrl,
        isEmailVerified: m.user.isEmailVerified,
        isPhoneVerified: m.user.isPhoneVerified,
      },
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async inviteMember(
    tenantId: string,
    invitedByUserId: string,
    data: InviteMemberRequest,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<{ invitationId: string; inviteToken: string; status: string }> {
    const email = data.email.toLowerCase();

    // 1. Check if user already exists and is already an active member of this studio
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenantId },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      throw new ConflictException('User is already a member of this organization');
    }

    const inviteToken = this.crypto.generateRandomToken();
    const tokenHash = this.crypto.hashToken(inviteToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // 2. Create Invitation record
    const invitation = await prisma.invitation.create({
      data: {
        tenantId,
        email,
        role: data.role as UserRole,
        tokenHash,
        invitedByUserId,
        expiresAt,
      },
    });

    await this.audit.log({
      tenantId,
      userId: invitedByUserId,
      action: 'MEMBER_INVITED',
      resourceType: 'Invitation',
      resourceId: invitation.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: { email, role: data.role },
    });

    return {
      invitationId: invitation.id,
      inviteToken,
      status: invitation.status,
    };
  }

  async acceptInvitation(
    userId: string,
    inviteToken: string,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<{ tenantId: string; role: string }> {
    const tokenHash = this.crypto.hashToken(inviteToken);
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new NotFoundException('Invitation token is invalid or has already been used');
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' as InvitationStatus },
      });
      throw new BadRequestException('Invitation has expired');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found');
    }

    // Connect user as active member of this organization
    const member = await prisma.$transaction(async (tx) => {
      const newMember = await tx.organizationMember.create({
        data: {
          tenantId: invitation.tenantId,
          userId,
          role: invitation.role,
          status: 'ACTIVE' as MemberStatus,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED' as InvitationStatus,
          acceptedAt: new Date(),
        },
      });

      return newMember;
    });

    await this.audit.log({
      tenantId: invitation.tenantId,
      userId,
      action: 'MEMBER_JOINED',
      resourceType: 'OrganizationMember',
      resourceId: member.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: { role: member.role },
    });

    return {
      tenantId: member.tenantId,
      role: member.role,
    };
  }

  async updateMemberStatus(
    tenantId: string,
    memberId: string,
    currentUserId: string,
    data: UpdateMemberStatusRequest,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.tenantId !== tenantId) {
      throw new NotFoundException('Member record not found in this organization');
    }

    // Safety check: Cannot suspend yourself if you are an OWNER
    if (member.userId === currentUserId && member.role === 'OWNER' && data.status === 'SUSPENDED') {
      throw new BadRequestException('Studio owners cannot suspend their own membership');
    }

    await prisma.organizationMember.update({
      where: { id: memberId },
      data: {
        status: data.status as MemberStatus,
        role: data.role ? (data.role as UserRole) : undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: currentUserId,
      action: 'MEMBER_STATUS_UPDATED',
      resourceType: 'OrganizationMember',
      resourceId: memberId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: { targetUserId: member.userId, newStatus: data.status, newRole: data.role },
    });
  }

  async removeMember(
    tenantId: string,
    memberId: string,
    currentUserId: string,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.tenantId !== tenantId) {
      throw new NotFoundException('Member record not found in this organization');
    }

    // Cannot remove yourself if owner
    if (member.userId === currentUserId && member.role === 'OWNER') {
      throw new BadRequestException('Studio owner cannot remove own membership from organization');
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    await this.audit.log({
      tenantId,
      userId: currentUserId,
      action: 'MEMBER_REMOVED',
      resourceType: 'OrganizationMember',
      resourceId: memberId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: { targetUserId: member.userId, removedRole: member.role },
    });
  }
}
