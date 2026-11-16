import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { prisma } from '@yogaos/database';

@Injectable()
export class ConflictValidationService {
  /**
   * Validates that the specified room is not already booked for an overlapping session.
   */
  async validateRoomAvailability(
    roomId: string,
    startTimestamp: Date,
    endTimestamp: Date,
    excludeSessionId?: string
  ): Promise<void> {
    const overlapping = await prisma.classSessionInstance.findFirst({
      where: {
        roomId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
        // Overlap condition: start < otherEnd AND end > otherStart
        startTimestamp: { lt: endTimestamp },
        endTimestamp: { gt: startTimestamp },
      },
      include: {
        classType: { select: { name: true } },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Room conflict: This room is already booked for "${overlapping.classType.name}" during the requested time slot.`
      );
    }
  }

  /**
   * Validates that an instructor does NOT have an overlapping session across ANY studio organization.
   * Privacy-safe: Returns clear conflict error without exposing external studio details.
   */
  async validateInstructorAvailability(
    instructorUserId: string,
    startTimestamp: Date,
    endTimestamp: Date,
    excludeSessionId?: string
  ): Promise<void> {
    const overlapping = await prisma.classSessionInstance.findFirst({
      where: {
        instructorId: instructorUserId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
        startTimestamp: { lt: endTimestamp },
        endTimestamp: { gt: startTimestamp },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Instructor conflict: The assigned instructor already has an active class session scheduled during this time slot.`
      );
    }
  }

  /**
   * Validates that batch or session capacity does not exceed the room's maximum mat capacity.
   */
  async validateRoomCapacity(capacity: number, roomId: string): Promise<void> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new BadRequestException('Selected room was not found.');
    }

    if (capacity > room.maxMatCapacity) {
      throw new BadRequestException(
        `Capacity validation failed: Requested capacity (${capacity}) exceeds maximum room capacity (${room.maxMatCapacity} mats) for "${room.name}".`
      );
    }
  }
}
