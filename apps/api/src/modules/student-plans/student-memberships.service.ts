import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, MembershipStatus } from '@yogaos/database';
import {
  AssignStudentMembershipRequest,
  FreezeMembershipRequest,
  CancelMembershipRequest,
  StudentMembershipDetails,
  StudentMembershipListQuery,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class StudentMembershipsService {
  constructor(private readonly audit: AuditService) {}

  async assignMembership(
    tenantId: string,
    data: AssignStudentMembershipRequest,
    userId: string
  ): Promise<StudentMembershipDetails> {
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, tenantId, deletedAt: null },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    const plan = await prisma.membershipPlan.findFirst({
      where: { id: data.membershipPlanId, tenantId, deletedAt: null, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException(`Active membership plan with ID ${data.membershipPlanId} not found`);
    }

    if (data.homeBranchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: data.homeBranchId, tenantId, deletedAt: null },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID ${data.homeBranchId} not found`);
      }
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const expiryDate = new Date(startDate.getTime() + plan.validityDays * 24 * 60 * 60 * 1000);

    const totalCredits =
      plan.planType === 'TIME_UNLIMITED'
        ? null
        : plan.planType === 'SINGLE_DROP_IN'
        ? plan.creditCount || 1
        : plan.creditCount;

    const remainingCredits = totalCredits;

    const membership = await prisma.$transaction(async (tx) => {
      const created = await tx.studentMembership.create({
        data: {
          tenantId,
          studentId: data.studentId,
          membershipPlanId: plan.id,
          homeBranchId: data.homeBranchId ?? plan.homeBranchId ?? null,
          planNameSnapshot: plan.name,
          planTypeSnapshot: plan.planType,
          priceSnapshot: plan.price,
          isMultiBranchSnapshot: plan.isMultiBranchValid,
          status: MembershipStatus.ACTIVE,
          startDate,
          expiryDate,
          totalCredits,
          remainingCredits,
          freezesUsed: 0,
          totalFrozenDays: 0,
          notes: data.notes ?? null,
        },
        include: {
          student: { select: { fullName: true, mobilePhone: true } },
          homeBranch: { select: { name: true } },
        },
      });

      if (totalCredits !== null && totalCredits > 0) {
        await tx.membershipCreditLedger.create({
          data: {
            tenantId,
            studentMembershipId: created.id,
            studentId: data.studentId,
            entryType: 'INITIAL_ALLOCATION',
            creditsDelta: totalCredits,
            balanceAfter: totalCredits,
            reason: `Initial allocation for ${plan.name}`,
            performedByUserId: userId,
          },
        });
      }

      return created;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STUDENT_MEMBERSHIP_ASSIGNED',
      resourceType: 'StudentMembership',
      resourceId: membership.id,
      details: {
        studentId: data.studentId,
        planName: plan.name,
        planType: plan.planType,
        totalCredits,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
      },
    });

    return this.mapToDto(membership);
  }

  async freezeMembership(
    tenantId: string,
    id: string,
    data: FreezeMembershipRequest,
    userId: string
  ): Promise<StudentMembershipDetails> {
    const membership = await prisma.studentMembership.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        plan: true,
        student: { select: { fullName: true, mobilePhone: true } },
        homeBranch: { select: { name: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException(`Student membership with ID ${id} not found`);
    }

    if (membership.status === MembershipStatus.FROZEN) {
      throw new BadRequestException('Membership is already frozen');
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException(`Cannot freeze membership with status ${membership.status}`);
    }

    if (new Date() > membership.expiryDate) {
      throw new BadRequestException('Cannot freeze an expired membership');
    }

    if (
      membership.plan.maxFreezesAllowed > 0 &&
      membership.freezesUsed >= membership.plan.maxFreezesAllowed
    ) {
      throw new BadRequestException(
        `Maximum freezes allowed (${membership.plan.maxFreezesAllowed}) reached for this plan`
      );
    }

    const updated = await prisma.studentMembership.update({
      where: { id },
      data: {
        status: MembershipStatus.FROZEN,
        frozenAt: new Date(),
        freezeReason: data.freezeReason,
      },
      include: {
        student: { select: { fullName: true, mobilePhone: true } },
        homeBranch: { select: { name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STUDENT_MEMBERSHIP_FROZEN',
      resourceType: 'StudentMembership',
      resourceId: updated.id,
      details: {
        studentId: updated.studentId,
        reason: data.freezeReason,
        frozenAt: updated.frozenAt?.toISOString(),
      },
    });

    return this.mapToDto(updated);
  }

  async unfreezeMembership(
    tenantId: string,
    id: string,
    userId: string
  ): Promise<StudentMembershipDetails> {
    const membership = await prisma.studentMembership.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        plan: true,
        student: { select: { fullName: true, mobilePhone: true } },
        homeBranch: { select: { name: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException(`Student membership with ID ${id} not found`);
    }

    if (membership.status !== MembershipStatus.FROZEN || !membership.frozenAt) {
      throw new BadRequestException('Membership is not currently frozen');
    }

    const now = new Date();
    const msFrozen = Math.max(0, now.getTime() - membership.frozenAt.getTime());
    const daysFrozen = Math.max(1, Math.ceil(msFrozen / (1000 * 60 * 60 * 24)));

    if (
      membership.plan.maxFreezeDays > 0 &&
      membership.totalFrozenDays + daysFrozen > membership.plan.maxFreezeDays
    ) {
      // Still allow unfreeze, but log or notify
    }

    const newExpiry = new Date(membership.expiryDate.getTime() + daysFrozen * 24 * 60 * 60 * 1000);

    const updated = await prisma.studentMembership.update({
      where: { id },
      data: {
        status: MembershipStatus.ACTIVE,
        frozenAt: null,
        freezeReason: null,
        freezesUsed: membership.freezesUsed + 1,
        totalFrozenDays: membership.totalFrozenDays + daysFrozen,
        expiryDate: newExpiry,
      },
      include: {
        student: { select: { fullName: true, mobilePhone: true } },
        homeBranch: { select: { name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STUDENT_MEMBERSHIP_UNFROZEN',
      resourceType: 'StudentMembership',
      resourceId: updated.id,
      details: {
        studentId: updated.studentId,
        daysFrozen,
        previousExpiry: membership.expiryDate.toISOString(),
        extendedExpiry: newExpiry.toISOString(),
      },
    });

    return this.mapToDto(updated);
  }

  async cancelMembership(
    tenantId: string,
    id: string,
    data: CancelMembershipRequest,
    userId: string
  ): Promise<StudentMembershipDetails> {
    const membership = await prisma.studentMembership.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!membership) {
      throw new NotFoundException(`Student membership with ID ${id} not found`);
    }

    const updated = await prisma.studentMembership.update({
      where: { id },
      data: {
        status: MembershipStatus.CANCELLED,
        notes: membership.notes
          ? `${membership.notes}\n[Cancelled]: ${data.reason}`
          : `[Cancelled]: ${data.reason}`,
      },
      include: {
        student: { select: { fullName: true, mobilePhone: true } },
        homeBranch: { select: { name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STUDENT_MEMBERSHIP_CANCELLED',
      resourceType: 'StudentMembership',
      resourceId: updated.id,
      details: {
        studentId: updated.studentId,
        reason: data.reason,
      },
    });

    return this.mapToDto(updated);
  }

  async getMemberships(
    tenantId: string,
    query: StudentMembershipListQuery = {}
  ): Promise<StudentMembershipDetails[]> {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const items = await prisma.studentMembership.findMany({
      where,
      include: {
        student: { select: { fullName: true, mobilePhone: true } },
        homeBranch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return items.map((m) => this.mapToDto(m));
  }

  async getMembership(tenantId: string, id: string): Promise<StudentMembershipDetails> {
    const membership = await prisma.studentMembership.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        student: { select: { fullName: true, mobilePhone: true } },
        homeBranch: { select: { name: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException(`Student membership with ID ${id} not found`);
    }

    return this.mapToDto(membership);
  }

  private mapToDto(m: any): StudentMembershipDetails {
    return {
      id: m.id,
      tenantId: m.tenantId,
      studentId: m.studentId,
      studentName: m.student?.fullName,
      studentPhone: m.student?.mobilePhone,
      membershipPlanId: m.membershipPlanId,
      homeBranchId: m.homeBranchId,
      homeBranchName: m.homeBranch?.name || null,
      planNameSnapshot: m.planNameSnapshot,
      planTypeSnapshot: m.planTypeSnapshot,
      priceSnapshot: Number(m.priceSnapshot),
      isMultiBranchSnapshot: m.isMultiBranchSnapshot,
      status: m.status,
      startDate: m.startDate.toISOString(),
      expiryDate: m.expiryDate.toISOString(),
      totalCredits: m.totalCredits,
      remainingCredits: m.remainingCredits,
      freezesUsed: m.freezesUsed,
      frozenAt: m.frozenAt ? m.frozenAt.toISOString() : null,
      freezeReason: m.freezeReason,
      totalFrozenDays: m.totalFrozenDays,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}
