import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, ClassLevel } from '@yogaos/database';
import {
  CreateClassTypeRequest,
  UpdateClassTypeRequest,
  ClassTypeDetails,
  ClassTypeListQuery,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class ClassTypesService {
  constructor(private readonly audit: AuditService) {}

  async getClassTypes(
    tenantId: string,
    query: ClassTypeListQuery = { page: 1, limit: 50 }
  ): Promise<{ classTypes: ClassTypeDetails[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.level) {
      where.level = query.level as ClassLevel;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, classTypes] = await Promise.all([
      prisma.classType.count({ where }),
      prisma.classType.findMany({
        where,
        include: {
          _count: { select: { batches: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const mapped: ClassTypeDetails[] = classTypes.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      description: c.description,
      category: c.category,
      level: c.level as any,
      defaultDurationMins: c.defaultDurationMins,
      defaultCapacity: c.defaultCapacity,
      intensity: c.intensity,
      isActive: c.isActive,
      batchCount: c._count.batches,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return {
      classTypes: mapped,
      total,
      page,
      limit,
    };
  }

  async getClassType(tenantId: string, id: string): Promise<ClassTypeDetails> {
    const classType = await prisma.classType.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true } },
      },
    });

    if (!classType || classType.tenantId !== tenantId || classType.deletedAt) {
      throw new NotFoundException('Class type not found');
    }

    return {
      id: classType.id,
      tenantId: classType.tenantId,
      name: classType.name,
      description: classType.description,
      category: classType.category,
      level: classType.level as any,
      defaultDurationMins: classType.defaultDurationMins,
      defaultCapacity: classType.defaultCapacity,
      intensity: classType.intensity,
      isActive: classType.isActive,
      batchCount: classType._count.batches,
      createdAt: classType.createdAt.toISOString(),
      updatedAt: classType.updatedAt.toISOString(),
    };
  }

  async createClassType(
    tenantId: string,
    data: CreateClassTypeRequest,
    userId: string
  ): Promise<ClassTypeDetails> {
    const existing = await prisma.classType.findFirst({
      where: {
        tenantId,
        name: { equals: data.name.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Class format "${data.name}" already exists in this studio`);
    }

    const classType = await prisma.classType.create({
      data: {
        tenantId,
        name: data.name.trim(),
        description: data.description ?? null,
        category: data.category || 'Hatha',
        level: (data.level as ClassLevel) || 'ALL_LEVELS',
        defaultDurationMins: data.defaultDurationMins || 60,
        defaultCapacity: data.defaultCapacity || 20,
        intensity: data.intensity ?? null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CLASS_TYPE_CREATE',
      resourceType: 'ClassType',
      resourceId: classType.id,
      details: { name: classType.name, category: classType.category },
    });

    return {
      id: classType.id,
      tenantId: classType.tenantId,
      name: classType.name,
      description: classType.description,
      category: classType.category,
      level: classType.level as any,
      defaultDurationMins: classType.defaultDurationMins,
      defaultCapacity: classType.defaultCapacity,
      intensity: classType.intensity,
      isActive: classType.isActive,
      batchCount: 0,
      createdAt: classType.createdAt.toISOString(),
      updatedAt: classType.updatedAt.toISOString(),
    };
  }

  async updateClassType(
    tenantId: string,
    id: string,
    data: UpdateClassTypeRequest,
    userId: string
  ): Promise<ClassTypeDetails> {
    const classType = await prisma.classType.findUnique({
      where: { id },
    });

    if (!classType || classType.tenantId !== tenantId || classType.deletedAt) {
      throw new NotFoundException('Class type not found');
    }

    if (data.name && data.name.trim().toLowerCase() !== classType.name.toLowerCase()) {
      const existing = await prisma.classType.findFirst({
        where: {
          tenantId,
          name: { equals: data.name.trim(), mode: 'insensitive' },
          deletedAt: null,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException(`Class format "${data.name}" already exists`);
      }
    }

    const updated = await prisma.classType.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        description: data.description !== undefined ? data.description : undefined,
        category: data.category ?? undefined,
        level: data.level ? (data.level as ClassLevel) : undefined,
        defaultDurationMins: data.defaultDurationMins ?? undefined,
        defaultCapacity: data.defaultCapacity ?? undefined,
        intensity: data.intensity !== undefined ? data.intensity : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
      include: {
        _count: { select: { batches: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CLASS_TYPE_UPDATE',
      resourceType: 'ClassType',
      resourceId: id,
      details: data,
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      description: updated.description,
      category: updated.category,
      level: updated.level as any,
      defaultDurationMins: updated.defaultDurationMins,
      defaultCapacity: updated.defaultCapacity,
      intensity: updated.intensity,
      isActive: updated.isActive,
      batchCount: updated._count.batches,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async archiveClassType(tenantId: string, id: string, userId: string): Promise<void> {
    const classType = await prisma.classType.findUnique({
      where: { id },
    });

    if (!classType || classType.tenantId !== tenantId || classType.deletedAt) {
      throw new NotFoundException('Class type not found');
    }

    await prisma.classType.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CLASS_TYPE_ARCHIVE',
      resourceType: 'ClassType',
      resourceId: id,
    });
  }
}
