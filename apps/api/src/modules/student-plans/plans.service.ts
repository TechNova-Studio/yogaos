import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, PlanType } from '@yogaos/database';
import {
  CreateMembershipPlanRequest,
  UpdateMembershipPlanRequest,
  MembershipPlanDetails,
  MembershipPlanListQuery,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class PlansService {
  constructor(private readonly audit: AuditService) {}

  async createPlan(
    tenantId: string,
    data: CreateMembershipPlanRequest,
    userId: string
  ): Promise<MembershipPlanDetails> {
    if (data.homeBranchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: data.homeBranchId, tenantId, deletedAt: null },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID ${data.homeBranchId} not found`);
      }
    }

    const creditCount =
      data.planType === 'TIME_UNLIMITED'
        ? null
        : data.planType === 'SINGLE_DROP_IN'
        ? data.creditCount || 1
        : data.creditCount;

    const plan = await prisma.membershipPlan.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? null,
        planType: data.planType as PlanType,
        price: data.price,
        taxRatePercent: data.taxRatePercent ?? 18.0,
        sacCode: data.sacCode ?? '9992',
        validityDays: data.validityDays,
        creditCount: creditCount ?? null,
        maxFreezesAllowed: data.maxFreezesAllowed ?? 0,
        maxFreezeDays: data.maxFreezeDays ?? 0,
        isMultiBranchValid: data.isMultiBranchValid ?? true,
        homeBranchId: data.homeBranchId ?? null,
        isActive: true,
      },
      include: {
        homeBranch: { select: { name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'MEMBERSHIP_PLAN_CREATED',
      resourceType: 'MembershipPlan',
      resourceId: plan.id,
      details: {
        name: plan.name,
        planType: plan.planType,
        price: Number(plan.price),
        validityDays: plan.validityDays,
      },
    });

    return this.mapToDto(plan);
  }

  async updatePlan(
    tenantId: string,
    id: string,
    data: UpdateMembershipPlanRequest,
    userId: string
  ): Promise<MembershipPlanDetails> {
    const existing = await prisma.membershipPlan.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Membership plan with ID ${id} not found`);
    }

    if (data.homeBranchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: data.homeBranchId, tenantId, deletedAt: null },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID ${data.homeBranchId} not found`);
      }
    }

    const updated = await prisma.membershipPlan.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        description: data.description !== undefined ? data.description : undefined,
        price: data.price !== undefined ? data.price : undefined,
        taxRatePercent: data.taxRatePercent !== undefined ? data.taxRatePercent : undefined,
        sacCode: data.sacCode !== undefined ? data.sacCode : undefined,
        validityDays: data.validityDays !== undefined ? data.validityDays : undefined,
        creditCount: data.creditCount !== undefined ? data.creditCount : undefined,
        maxFreezesAllowed: data.maxFreezesAllowed !== undefined ? data.maxFreezesAllowed : undefined,
        maxFreezeDays: data.maxFreezeDays !== undefined ? data.maxFreezeDays : undefined,
        isMultiBranchValid: data.isMultiBranchValid !== undefined ? data.isMultiBranchValid : undefined,
        homeBranchId: data.homeBranchId !== undefined ? data.homeBranchId : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
      include: {
        homeBranch: { select: { name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'MEMBERSHIP_PLAN_UPDATED',
      resourceType: 'MembershipPlan',
      resourceId: updated.id,
      details: { updatedFields: Object.keys(data) },
    });

    return this.mapToDto(updated);
  }

  async archivePlan(
    tenantId: string,
    id: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const existing = await prisma.membershipPlan.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Membership plan with ID ${id} not found`);
    }

    await prisma.membershipPlan.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'MEMBERSHIP_PLAN_ARCHIVED',
      resourceType: 'MembershipPlan',
      resourceId: id,
      details: { name: existing.name },
    });

    return {
      success: true,
      message: `Membership plan ${existing.name} has been archived`,
    };
  }

  async getPlans(tenantId: string, query: MembershipPlanListQuery = {}): Promise<MembershipPlanDetails[]> {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.planType) {
      where.planType = query.planType;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const plans = await prisma.membershipPlan.findMany({
      where,
      include: {
        homeBranch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return plans.map((p) => this.mapToDto(p));
  }

  async getPlan(tenantId: string, id: string): Promise<MembershipPlanDetails> {
    const plan = await prisma.membershipPlan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        homeBranch: { select: { name: true } },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Membership plan with ID ${id} not found`);
    }

    return this.mapToDto(plan);
  }

  private mapToDto(plan: any): MembershipPlanDetails {
    return {
      id: plan.id,
      tenantId: plan.tenantId,
      name: plan.name,
      description: plan.description,
      planType: plan.planType,
      price: Number(plan.price),
      taxRatePercent: Number(plan.taxRatePercent),
      sacCode: plan.sacCode,
      validityDays: plan.validityDays,
      creditCount: plan.creditCount,
      maxFreezesAllowed: plan.maxFreezesAllowed,
      maxFreezeDays: plan.maxFreezeDays,
      isMultiBranchValid: plan.isMultiBranchValid,
      homeBranchId: plan.homeBranchId,
      homeBranchName: plan.homeBranch?.name || null,
      isActive: plan.isActive,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
