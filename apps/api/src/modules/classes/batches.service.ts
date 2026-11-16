import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { prisma, BatchScheduleType, BatchStatus, SessionStatus } from '@yogaos/database';
import {
  CreateBatchRequest,
  UpdateBatchRequest,
  BatchDetails,
  BatchListQuery,
} from '@yogaos/contracts';
import { ConflictValidationService } from './conflict-validation.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { parseLocalTimeToUtc, getUtcSessionDate } from './timezone.util.js';

@Injectable()
export class BatchesService {
  constructor(
    private readonly conflicts: ConflictValidationService,
    private readonly audit: AuditService
  ) {}

  async getBatches(
    tenantId: string,
    query: BatchListQuery = { page: 1, limit: 50 }
  ): Promise<{ batches: BatchDetails[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.branchId) where.branchId = query.branchId;
    if (query.classTypeId) where.classTypeId = query.classTypeId;
    if (query.instructorId) where.instructorId = query.instructorId;
    if (query.status) where.status = query.status as BatchStatus;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { classType: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, batches] = await Promise.all([
      prisma.classBatch.count({ where }),
      prisma.classBatch.findMany({
        where,
        include: {
          classType: { select: { name: true } },
          branch: { select: { name: true } },
          room: { select: { name: true, maxMatCapacity: true } },
          instructor: { select: { fullName: true } },
          _count: { select: { sessions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const mapped: BatchDetails[] = batches.map((b) => ({
      id: b.id,
      tenantId: b.tenantId,
      classTypeId: b.classTypeId,
      classTypeName: b.classType.name,
      branchId: b.branchId,
      branchName: b.branch.name,
      roomId: b.roomId,
      roomName: b.room.name,
      roomMaxCapacity: b.room.maxMatCapacity,
      instructorId: b.instructorId,
      instructorName: b.instructor.fullName,
      name: b.name,
      description: b.description,
      scheduleType: b.scheduleType as any,
      status: b.status as any,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate ? b.endDate.toISOString() : null,
      capacity: b.capacity,
      sessionDurationMins: b.sessionDurationMins,
      daysOfWeek: b.daysOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
      sessionCount: b._count.sessions,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));

    return {
      batches: mapped,
      total,
      page,
      limit,
    };
  }

  async getBatch(tenantId: string, id: string): Promise<BatchDetails> {
    const b = await prisma.classBatch.findUnique({
      where: { id },
      include: {
        classType: { select: { name: true } },
        branch: { select: { name: true } },
        room: { select: { name: true, maxMatCapacity: true } },
        instructor: { select: { fullName: true } },
        _count: { select: { sessions: true } },
      },
    });

    if (!b || b.tenantId !== tenantId || b.deletedAt) {
      throw new NotFoundException('Batch not found');
    }

    return {
      id: b.id,
      tenantId: b.tenantId,
      classTypeId: b.classTypeId,
      classTypeName: b.classType.name,
      branchId: b.branchId,
      branchName: b.branch.name,
      roomId: b.roomId,
      roomName: b.room.name,
      roomMaxCapacity: b.room.maxMatCapacity,
      instructorId: b.instructorId,
      instructorName: b.instructor.fullName,
      name: b.name,
      description: b.description,
      scheduleType: b.scheduleType as any,
      status: b.status as any,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate ? b.endDate.toISOString() : null,
      capacity: b.capacity,
      sessionDurationMins: b.sessionDurationMins,
      daysOfWeek: b.daysOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
      sessionCount: b._count.sessions,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  async createBatch(
    tenantId: string,
    data: CreateBatchRequest,
    userId: string
  ): Promise<BatchDetails> {
    // 1. Validate start and end times
    if (data.startTime >= data.endTime) {
      throw new BadRequestException('Start time must be strictly before end time.');
    }

    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;
    if (endDate && startDate > endDate) {
      throw new BadRequestException('Start date cannot be after end date.');
    }

    // 2. Validate ClassType belongs to tenant
    const classType = await prisma.classType.findUnique({
      where: { id: data.classTypeId },
    });
    if (!classType || classType.tenantId !== tenantId || classType.deletedAt) {
      throw new BadRequestException('Selected class type does not exist in this organization.');
    }

    // 3. Validate Branch belongs to tenant
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
    });
    if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
      throw new BadRequestException('Selected branch does not exist in this organization.');
    }

    // 4. Validate Room belongs to Branch and Tenant
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });
    if (!room || room.tenantId !== tenantId || room.branchId !== data.branchId) {
      throw new ForbiddenException('Invalid room: Room does not belong to the selected branch and organization.');
    }

    // 5. Validate Room Capacity
    await this.conflicts.validateRoomCapacity(data.capacity, data.roomId);

    // 6. Validate Instructor has active membership in this tenant
    const membership = await prisma.organizationMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: data.instructorId,
        },
      },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new BadRequestException('Assigned instructor is not an active member of this organization.');
    }

    // 7. Create Batch in Transaction
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.classBatch.create({
        data: {
          tenantId,
          classTypeId: data.classTypeId,
          branchId: data.branchId,
          roomId: data.roomId,
          instructorId: data.instructorId,
          name: data.name,
          description: data.description ?? null,
          scheduleType: (data.scheduleType as BatchScheduleType) || 'RECURRING_WEEKLY',
          status: (data.status as BatchStatus) || 'ACTIVE',
          startDate,
          endDate,
          capacity: data.capacity,
          sessionDurationMins: data.sessionDurationMins || 60,
          daysOfWeek: data.daysOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
        },
      });

      return created;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BATCH_CREATE',
      resourceType: 'ClassBatch',
      resourceId: batch.id,
      details: { name: batch.name, capacity: batch.capacity, daysOfWeek: batch.daysOfWeek },
    });

    // 8. If ACTIVE, automatically generate the first 30 days of sessions
    if (batch.status === 'ACTIVE') {
      const horizonDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const targetUpToDate = endDate && endDate < horizonDate ? endDate : horizonDate;
      await this.generateBatchSessionsInternal(tenantId, batch.id, targetUpToDate);
    }

    return this.getBatch(tenantId, batch.id);
  }

  async updateBatch(
    tenantId: string,
    id: string,
    data: UpdateBatchRequest,
    userId: string
  ): Promise<BatchDetails> {
    const batch = await prisma.classBatch.findUnique({
      where: { id },
    });

    if (!batch || batch.tenantId !== tenantId || batch.deletedAt) {
      throw new NotFoundException('Batch not found');
    }

    const targetRoomId = data.roomId || batch.roomId;
    const targetCapacity = data.capacity || batch.capacity;

    if (data.roomId || data.capacity) {
      await this.conflicts.validateRoomCapacity(targetCapacity, targetRoomId);
    }

    if (data.branchId && data.branchId !== batch.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
      if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
        throw new ForbiddenException('Invalid branch');
      }
    }

    if (data.instructorId && data.instructorId !== batch.instructorId) {
      const membership = await prisma.organizationMember.findUnique({
        where: { tenantId_userId: { tenantId, userId: data.instructorId } },
      });
      if (!membership || membership.status !== 'ACTIVE') {
        throw new BadRequestException('Assigned instructor is not an active member of this organization.');
      }
    }

    const updated = await prisma.classBatch.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        description: data.description !== undefined ? data.description : undefined,
        classTypeId: data.classTypeId ?? undefined,
        branchId: data.branchId ?? undefined,
        roomId: data.roomId ?? undefined,
        instructorId: data.instructorId ?? undefined,
        status: data.status ? (data.status as BatchStatus) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
        capacity: data.capacity ?? undefined,
        sessionDurationMins: data.sessionDurationMins ?? undefined,
        daysOfWeek: data.daysOfWeek ?? undefined,
        startTime: data.startTime ?? undefined,
        endTime: data.endTime ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BATCH_UPDATE',
      resourceType: 'ClassBatch',
      resourceId: id,
      details: data,
    });

    return this.getBatch(tenantId, id);
  }

  async archiveBatch(tenantId: string, id: string, userId: string): Promise<void> {
    const batch = await prisma.classBatch.findUnique({
      where: { id },
    });

    if (!batch || batch.tenantId !== tenantId || batch.deletedAt) {
      throw new NotFoundException('Batch not found');
    }

    // Set batch status to ARCHIVED and cancel future SCHEDULED sessions
    await prisma.$transaction(async (tx) => {
      await tx.classBatch.update({
        where: { id },
        data: { status: 'ARCHIVED', deletedAt: new Date() },
      });

      await tx.classSessionInstance.updateMany({
        where: {
          batchId: id,
          status: 'SCHEDULED',
          startTimestamp: { gt: new Date() },
        },
        data: {
          status: 'CANCELLED',
          cancellationReason: 'Batch archived by management',
        },
      });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BATCH_ARCHIVED',
      resourceType: 'ClassBatch',
      resourceId: id,
    });
  }

  /**
   * Deterministic generation of session instances for a recurring batch up to target date.
   * Avoids duplicate generation and checks room & instructor conflicts.
   */
  async generateBatchSessionsInternal(
    tenantId: string,
    batchId: string,
    upToDate: Date
  ): Promise<{ generatedCount: number }> {
    const batch = await prisma.classBatch.findUnique({
      where: { id: batchId },
      include: {
        organization: { select: { timezone: true } },
      },
    });

    if (!batch || batch.tenantId !== tenantId || batch.deletedAt) {
      throw new NotFoundException('Batch not found');
    }

    const timezone = batch.organization.timezone || 'Asia/Kolkata';
    const effectiveStart = new Date(Math.max(batch.startDate.getTime(), Date.now() - 24 * 60 * 60 * 1000));
    const effectiveEnd = batch.endDate && batch.endDate < upToDate ? batch.endDate : upToDate;

    let generatedCount = 0;
    const current = new Date(effectiveStart);

    while (current <= effectiveEnd) {
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth() + 1;
      const day = current.getUTCDate();
      const dayOfWeek = current.getUTCDay(); // 0=Sun .. 6=Sat

      if (batch.daysOfWeek.includes(dayOfWeek)) {
        const sessionDate = getUtcSessionDate(year, month, day);

        // Check if session instance already generated for this batch on this date
        const existing = await prisma.classSessionInstance.findFirst({
          where: {
            batchId,
            sessionDate,
          },
        });

        if (!existing) {
          const startTimestamp = parseLocalTimeToUtc(year, month, day, batch.startTime, timezone);
          const endTimestamp = parseLocalTimeToUtc(year, month, day, batch.endTime, timezone);

          // Verify room availability
          let roomAvailable = true;
          try {
            await this.conflicts.validateRoomAvailability(batch.roomId, startTimestamp, endTimestamp);
          } catch {
            roomAvailable = false;
          }

          // Verify instructor availability
          let instructorAvailable = true;
          try {
            await this.conflicts.validateInstructorAvailability(batch.instructorId, startTimestamp, endTimestamp);
          } catch {
            instructorAvailable = false;
          }

          if (roomAvailable && instructorAvailable) {
            await prisma.classSessionInstance.create({
              data: {
                tenantId,
                batchId,
                classTypeId: batch.classTypeId,
                branchId: batch.branchId,
                roomId: batch.roomId,
                instructorId: batch.instructorId,
                sessionDate,
                startTimestamp,
                endTimestamp,
                capacity: batch.capacity,
                status: 'SCHEDULED',
              },
            });
            generatedCount++;
          }
        }
      }

      // Increment by 1 calendar day
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { generatedCount };
  }

  async generateSessions(
    tenantId: string,
    batchId: string,
    upToDateStr: string,
    userId: string
  ): Promise<{ generatedCount: number; message: string }> {
    const upToDate = new Date(upToDateStr);
    const result = await this.generateBatchSessionsInternal(tenantId, batchId, upToDate);

    await this.audit.log({
      tenantId,
      userId,
      action: 'SESSIONS_GENERATED',
      resourceType: 'ClassBatch',
      resourceId: batchId,
      details: { generatedCount: result.generatedCount, upToDate: upToDateStr },
    });

    return {
      generatedCount: result.generatedCount,
      message: `Successfully generated ${result.generatedCount} new session instances.`,
    };
  }
}
