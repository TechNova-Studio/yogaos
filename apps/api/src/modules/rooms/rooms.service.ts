import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '@yogaos/database';
import {
  CreateRoomRequest,
  UpdateRoomRequest,
  RoomDetails,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class RoomsService {
  constructor(private readonly audit: AuditService) {}

  async getRooms(tenantId: string, branchId?: string): Promise<RoomDetails[]> {
    const whereClause: any = {
      tenantId,
    };
    if (branchId) {
      whereClause.branchId = branchId;
    }

    const rooms = await prisma.room.findMany({
      where: whereClause,
      include: {
        branch: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rooms.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      name: r.name,
      description: r.description,
      maxMatCapacity: r.maxMatCapacity,
      isActive: r.isActive,
      branchName: r.branch.name,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getRoom(tenantId: string, roomId: string): Promise<RoomDetails> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });

    if (!room || room.tenantId !== tenantId) {
      throw new NotFoundException('Room not found');
    }

    return {
      id: room.id,
      tenantId: room.tenantId,
      branchId: room.branchId,
      name: room.name,
      description: room.description,
      maxMatCapacity: room.maxMatCapacity,
      isActive: room.isActive,
      branchName: room.branch.name,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };
  }

  async createRoom(
    tenantId: string,
    data: CreateRoomRequest,
    userId: string
  ): Promise<RoomDetails> {
    // 1. Validate branch exists and belongs to THIS tenant (Cross-tenant branch prevention)
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
    });

    if (!branch || branch.tenantId !== tenantId || branch.deletedAt) {
      throw new ForbiddenException('Invalid branch: Target branch does not belong to active organization');
    }

    // 2. Validate capacity
    if (data.maxMatCapacity < 1) {
      throw new BadRequestException('Room capacity must be at least 1 mat');
    }

    const room = await prisma.room.create({
      data: {
        tenantId,
        branchId: data.branchId,
        name: data.name,
        description: data.description ?? null,
        maxMatCapacity: data.maxMatCapacity,
        isActive: data.isActive ?? true,
      },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ROOM_CREATE',
      resourceType: 'Room',
      resourceId: room.id,
      details: { name: room.name, branchId: room.branchId, maxMatCapacity: room.maxMatCapacity },
    });

    return {
      id: room.id,
      tenantId: room.tenantId,
      branchId: room.branchId,
      name: room.name,
      description: room.description,
      maxMatCapacity: room.maxMatCapacity,
      isActive: room.isActive,
      branchName: room.branch.name,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };
  }

  async updateRoom(
    tenantId: string,
    roomId: string,
    data: UpdateRoomRequest,
    userId: string
  ): Promise<RoomDetails> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.tenantId !== tenantId) {
      throw new NotFoundException('Room not found');
    }

    if (data.maxMatCapacity !== undefined && data.maxMatCapacity < 1) {
      throw new BadRequestException('Room capacity must be at least 1 mat');
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        name: data.name ?? undefined,
        description: data.description !== undefined ? data.description : undefined,
        maxMatCapacity: data.maxMatCapacity ?? undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ROOM_UPDATE',
      resourceType: 'Room',
      resourceId: roomId,
      details: data,
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      name: updated.name,
      description: updated.description,
      maxMatCapacity: updated.maxMatCapacity,
      isActive: updated.isActive,
      branchName: updated.branch.name,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteRoom(tenantId: string, roomId: string, userId: string): Promise<void> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.tenantId !== tenantId) {
      throw new NotFoundException('Room not found');
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ROOM_DELETE',
      resourceType: 'Room',
      resourceId: roomId,
    });
  }
}
