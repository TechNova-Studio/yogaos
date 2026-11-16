import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '@yogaos/database';
import {
  CreateBranchRequest,
  UpdateBranchRequest,
  BranchDetails,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class BranchesService {
  constructor(private readonly audit: AuditService) {}

  async getBranches(tenantId: string): Promise<BranchDetails[]> {
    const branches = await prisma.branch.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { rooms: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return branches.map((b) => ({
      id: b.id,
      tenantId: b.tenantId,
      name: b.name,
      slug: b.slug,
      streetAddress: b.streetAddress,
      city: b.city,
      state: b.state,
      stateCode: b.stateCode,
      postalCode: b.postalCode,
      phone: b.phone,
      email: b.email,
      operatingHours: b.operatingHours as any,
      isActive: b.isActive,
      roomCount: b._count.rooms,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async getBranch(tenantId: string, branchId: string): Promise<BranchDetails> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        _count: {
          select: { rooms: true },
        },
      },
    });

    if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
      throw new NotFoundException('Branch not found');
    }

    return {
      id: branch.id,
      tenantId: branch.tenantId,
      name: branch.name,
      slug: branch.slug,
      streetAddress: branch.streetAddress,
      city: branch.city,
      state: branch.state,
      stateCode: branch.stateCode,
      postalCode: branch.postalCode,
      phone: branch.phone,
      email: branch.email,
      operatingHours: branch.operatingHours as any,
      isActive: branch.isActive,
      roomCount: branch._count.rooms,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString(),
    };
  }

  async createBranch(
    tenantId: string,
    data: CreateBranchRequest,
    userId: string
  ): Promise<BranchDetails> {
    const existing = await prisma.branch.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug: data.slug.toLowerCase(),
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Branch with slug "${data.slug}" already exists in this studio`);
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId,
        name: data.name,
        slug: data.slug.toLowerCase(),
        streetAddress: data.streetAddress,
        city: data.city,
        state: data.state,
        stateCode: data.stateCode,
        postalCode: data.postalCode,
        phone: data.phone,
        email: data.email,
        operatingHours: data.operatingHours ?? undefined,
        isActive: data.isActive ?? true,
      },
      include: {
        _count: {
          select: { rooms: true },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BRANCH_CREATE',
      resourceType: 'Branch',
      resourceId: branch.id,
      details: { name: branch.name, slug: branch.slug },
    });

    return {
      id: branch.id,
      tenantId: branch.tenantId,
      name: branch.name,
      slug: branch.slug,
      streetAddress: branch.streetAddress,
      city: branch.city,
      state: branch.state,
      stateCode: branch.stateCode,
      postalCode: branch.postalCode,
      phone: branch.phone,
      email: branch.email,
      operatingHours: branch.operatingHours as any,
      isActive: branch.isActive,
      roomCount: branch._count.rooms,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString(),
    };
  }

  async updateBranch(
    tenantId: string,
    branchId: string,
    data: UpdateBranchRequest,
    userId: string
  ): Promise<BranchDetails> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
      throw new NotFoundException('Branch not found');
    }

    if (data.slug && data.slug.toLowerCase() !== branch.slug) {
      const existing = await prisma.branch.findUnique({
        where: {
          tenantId_slug: {
            tenantId,
            slug: data.slug.toLowerCase(),
          },
        },
      });
      if (existing && existing.id !== branchId && !existing.deletedAt) {
        throw new ConflictException(`Branch with slug "${data.slug}" already exists`);
      }
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        name: data.name ?? undefined,
        slug: data.slug ? data.slug.toLowerCase() : undefined,
        streetAddress: data.streetAddress ?? undefined,
        city: data.city ?? undefined,
        state: data.state ?? undefined,
        stateCode: data.stateCode ?? undefined,
        postalCode: data.postalCode ?? undefined,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        operatingHours: data.operatingHours !== undefined ? (data.operatingHours as any) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
      include: {
        _count: {
          select: { rooms: true },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BRANCH_UPDATE',
      resourceType: 'Branch',
      resourceId: branchId,
      details: data,
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      slug: updated.slug,
      streetAddress: updated.streetAddress,
      city: updated.city,
      state: updated.state,
      stateCode: updated.stateCode,
      postalCode: updated.postalCode,
      phone: updated.phone,
      email: updated.email,
      operatingHours: updated.operatingHours as any,
      isActive: updated.isActive,
      roomCount: updated._count.rooms,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteBranch(tenantId: string, branchId: string, userId: string): Promise<void> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        _count: {
          select: { students: true },
        },
      },
    });

    if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
      throw new NotFoundException('Branch not found');
    }

    if (branch._count.students > 0) {
      throw new BadRequestException('Cannot delete branch with assigned students. Please reassign students first.');
    }

    await prisma.branch.update({
      where: { id: branchId },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BRANCH_DELETE',
      resourceType: 'Branch',
      resourceId: branchId,
    });
  }
}
