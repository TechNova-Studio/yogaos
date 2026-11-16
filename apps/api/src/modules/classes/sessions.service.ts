import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { prisma, SessionStatus } from '@yogaos/database';
import {
  SessionCalendarQuery,
  SessionDetails,
  UpdateSessionInstanceRequest,
  CancelSessionInstanceRequest,
  InstructorSummary,
} from '@yogaos/contracts';
import { ConflictValidationService } from './conflict-validation.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { getUtcSessionDate } from './timezone.util.js';

@Injectable()
export class SessionsService {
  constructor(
    private readonly conflicts: ConflictValidationService,
    private readonly audit: AuditService
  ) {}

  async getSessions(
    tenantId: string,
    query: SessionCalendarQuery
  ): Promise<SessionDetails[]> {
    const startWindow = new Date(query.startDate);
    const endWindow = new Date(query.endDate);

    if (isNaN(startWindow.getTime()) || isNaN(endWindow.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate query parameter');
    }

    const where: any = {
      tenantId,
      startTimestamp: { lt: endWindow },
      endTimestamp: { gt: startWindow },
    };

    if (query.branchId) where.branchId = query.branchId;
    if (query.roomId) where.roomId = query.roomId;
    if (query.instructorId) where.instructorId = query.instructorId;
    if (query.classTypeId) where.classTypeId = query.classTypeId;
    if (query.status) where.status = query.status as SessionStatus;

    const sessions = await prisma.classSessionInstance.findMany({
      where,
      include: {
        batch: { select: { name: true } },
        classType: { select: { name: true } },
        branch: { select: { name: true } },
        room: { select: { name: true } },
        instructor: { select: { fullName: true } },
      },
      orderBy: { startTimestamp: 'asc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      batchId: s.batchId,
      batchName: s.batch?.name || null,
      classTypeId: s.classTypeId,
      classTypeName: s.classType.name,
      branchId: s.branchId,
      branchName: s.branch.name,
      roomId: s.roomId,
      roomName: s.room.name,
      instructorId: s.instructorId,
      instructorName: s.instructor.fullName,
      sessionDate: s.sessionDate.toISOString().slice(0, 10),
      startTimestamp: s.startTimestamp.toISOString(),
      endTimestamp: s.endTimestamp.toISOString(),
      capacity: s.capacity,
      status: s.status,
      cancellationReason: s.cancellationReason,
      notes: s.notes,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getSession(tenantId: string, id: string): Promise<SessionDetails> {
    const session = await prisma.classSessionInstance.findFirst({
      where: { id, tenantId },
      include: {
        batch: { select: { name: true } },
        classType: { select: { name: true } },
        branch: { select: { name: true } },
        room: { select: { name: true } },
        instructor: { select: { fullName: true } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session instance with ID ${id} not found`);
    }

    return {
      id: session.id,
      tenantId: session.tenantId,
      batchId: session.batchId,
      batchName: session.batch?.name || null,
      classTypeId: session.classTypeId,
      classTypeName: session.classType.name,
      branchId: session.branchId,
      branchName: session.branch.name,
      roomId: session.roomId,
      roomName: session.room.name,
      instructorId: session.instructorId,
      instructorName: session.instructor.fullName,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      startTimestamp: session.startTimestamp.toISOString(),
      endTimestamp: session.endTimestamp.toISOString(),
      capacity: session.capacity,
      status: session.status,
      cancellationReason: session.cancellationReason,
      notes: session.notes,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  async updateSession(
    tenantId: string,
    id: string,
    data: UpdateSessionInstanceRequest,
    userId: string
  ): Promise<SessionDetails> {
    const session = await prisma.classSessionInstance.findFirst({
      where: { id, tenantId },
      include: { branch: true },
    });

    if (!session) {
      throw new NotFoundException(`Session instance with ID ${id} not found`);
    }

    if (session.status === SessionStatus.CANCELLED && data.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException('Cannot modify a cancelled session unless reactivating it');
    }

    const newRoomId = data.roomId ?? session.roomId;
    const newInstructorId = data.instructorId ?? session.instructorId;
    const newStart = data.startTimestamp ? new Date(data.startTimestamp) : session.startTimestamp;
    const newEnd = data.endTimestamp ? new Date(data.endTimestamp) : session.endTimestamp;

    if (newStart >= newEnd) {
      throw new BadRequestException('Session start timestamp must be strictly before end timestamp');
    }

    const newCapacity = data.capacity ?? session.capacity;
    await this.conflicts.validateRoomCapacity(newCapacity, newRoomId);

    // Validate room conflict
    await this.conflicts.validateRoomAvailability(newRoomId, newStart, newEnd, session.id);

    // Validate instructor cross-studio conflict
    await this.conflicts.validateInstructorAvailability(newInstructorId, newStart, newEnd, session.id);

    // If start time changed, calculate sessionDate
    let sessionDate = session.sessionDate;
    if (data.startTimestamp) {
      const datePart = newStart.toISOString().slice(0, 10);
      sessionDate = getUtcSessionDate(datePart);
    }

    const updated = await prisma.classSessionInstance.update({
      where: { id: session.id },
      data: {
        roomId: newRoomId,
        instructorId: newInstructorId,
        startTimestamp: newStart,
        endTimestamp: newEnd,
        sessionDate,
        capacity: newCapacity,
        status: data.status ? (data.status as SessionStatus) : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      },
      include: {
        batch: { select: { name: true } },
        classType: { select: { name: true } },
        branch: { select: { name: true } },
        room: { select: { name: true } },
        instructor: { select: { fullName: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CLASS_SESSION_UPDATED',
      resourceType: 'ClassSessionInstance',
      resourceId: session.id,
      details: {
        previousRoomId: session.roomId,
        newRoomId,
        previousInstructorId: session.instructorId,
        newInstructorId,
        previousStart: session.startTimestamp.toISOString(),
        newStart: newStart.toISOString(),
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      batchId: updated.batchId,
      batchName: updated.batch?.name || null,
      classTypeId: updated.classTypeId,
      classTypeName: updated.classType.name,
      branchId: updated.branchId,
      branchName: updated.branch.name,
      roomId: updated.roomId,
      roomName: updated.room.name,
      instructorId: updated.instructorId,
      instructorName: updated.instructor.fullName,
      sessionDate: updated.sessionDate.toISOString().slice(0, 10),
      startTimestamp: updated.startTimestamp.toISOString(),
      endTimestamp: updated.endTimestamp.toISOString(),
      capacity: updated.capacity,
      status: updated.status,
      cancellationReason: updated.cancellationReason,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async cancelSession(
    tenantId: string,
    id: string,
    data: CancelSessionInstanceRequest,
    userId: string
  ): Promise<SessionDetails> {
    const session = await prisma.classSessionInstance.findFirst({
      where: { id, tenantId },
      include: {
        batch: { select: { name: true } },
        classType: { select: { name: true } },
        branch: { select: { name: true } },
        room: { select: { name: true } },
        instructor: { select: { fullName: true } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session instance with ID ${id} not found`);
    }

    if (session.status === SessionStatus.CANCELLED) {
      return {
        id: session.id,
        tenantId: session.tenantId,
        batchId: session.batchId,
        batchName: session.batch?.name || null,
        classTypeId: session.classTypeId,
        classTypeName: session.classType.name,
        branchId: session.branchId,
        branchName: session.branch.name,
        roomId: session.roomId,
        roomName: session.room.name,
        instructorId: session.instructorId,
        instructorName: session.instructor.fullName,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        startTimestamp: session.startTimestamp.toISOString(),
        endTimestamp: session.endTimestamp.toISOString(),
        capacity: session.capacity,
        status: session.status,
        cancellationReason: session.cancellationReason,
        notes: session.notes,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    }

    const updated = await prisma.classSessionInstance.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.CANCELLED,
        cancellationReason: data.cancellationReason,
      },
      include: {
        batch: { select: { name: true } },
        classType: { select: { name: true } },
        branch: { select: { name: true } },
        room: { select: { name: true } },
        instructor: { select: { fullName: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CLASS_SESSION_CANCELLED',
      resourceType: 'ClassSessionInstance',
      resourceId: session.id,
      details: {
        batchId: session.batchId,
        sessionDate: session.sessionDate.toISOString(),
        startTimestamp: session.startTimestamp.toISOString(),
        reason: data.cancellationReason,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      batchId: updated.batchId,
      batchName: updated.batch?.name || null,
      classTypeId: updated.classTypeId,
      classTypeName: updated.classType.name,
      branchId: updated.branchId,
      branchName: updated.branch.name,
      roomId: updated.roomId,
      roomName: updated.room.name,
      instructorId: updated.instructorId,
      instructorName: updated.instructor.fullName,
      sessionDate: updated.sessionDate.toISOString().slice(0, 10),
      startTimestamp: updated.startTimestamp.toISOString(),
      endTimestamp: updated.endTimestamp.toISOString(),
      capacity: updated.capacity,
      status: updated.status,
      cancellationReason: updated.cancellationReason,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async getInstructors(tenantId: string): Promise<InstructorSummary[]> {
    const members = await prisma.organizationMember.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        role: { in: ['INSTRUCTOR', 'MANAGER', 'OWNER'] },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    return members.map((m) => ({
      id: m.user.id,
      fullName: m.user.fullName,
      email: m.user.email,
      role: m.role,
    }));
  }
}
