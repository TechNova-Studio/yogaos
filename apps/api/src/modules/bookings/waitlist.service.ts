import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { prisma, WaitlistStatus, BookingStatus, BookingSource } from '@yogaos/database';
import {
  JoinWaitlistRequest,
  WaitlistEntryDetails,
  BookingDetails,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class WaitlistService {
  constructor(private readonly audit: AuditService) {}

  async joinWaitlist(
    tenantId: string,
    data: JoinWaitlistRequest,
    userId: string
  ): Promise<WaitlistEntryDetails> {
    // 1. Validate student
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, tenantId, deletedAt: null },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }
    if (student.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot waitlist inactive student (status: ${student.status})`);
    }

    // 2. Validate session
    const session = await prisma.classSessionInstance.findFirst({
      where: { id: data.sessionInstanceId, tenantId },
    });
    if (!session) {
      throw new NotFoundException(`Class session with ID ${data.sessionInstanceId} not found`);
    }
    if (session.status === 'CANCELLED' || session.status === 'COMPLETED') {
      throw new BadRequestException(`Cannot join waitlist for ${session.status.toLowerCase()} session`);
    }

    // 3. Check if already has active booking
    const existingBooking = await prisma.booking.findUnique({
      where: {
        tenantId_sessionInstanceId_studentId: {
          tenantId,
          sessionInstanceId: data.sessionInstanceId,
          studentId: data.studentId,
        },
      },
    });
    if (
      existingBooking &&
      (existingBooking.status === BookingStatus.BOOKED ||
        existingBooking.status === BookingStatus.ATTENDED)
    ) {
      throw new ConflictException('Student already holds a confirmed booking for this session');
    }

    // 4. Check if already actively on waitlist
    const existingWaitlist = await prisma.waitlistEntry.findFirst({
      where: {
        tenantId,
        sessionInstanceId: data.sessionInstanceId,
        studentId: data.studentId,
        status: WaitlistStatus.WAITING,
      },
    });
    if (existingWaitlist) {
      throw new ConflictException('Student is already on the active waitlist for this session');
    }

    // 5. Transactionally compute FIFO rank and insert
    const entry = await prisma.$transaction(async (tx) => {
      const maxRankAgg = await tx.waitlistEntry.aggregate({
        where: {
          tenantId,
          sessionInstanceId: data.sessionInstanceId,
        },
        _max: { priorityRank: true },
      });

      const nextRank = (maxRankAgg._max.priorityRank || 0) + 1;

      return tx.waitlistEntry.upsert({
        where: {
          tenantId_sessionInstanceId_studentId: {
            tenantId,
            sessionInstanceId: data.sessionInstanceId,
            studentId: data.studentId,
          },
        },
        create: {
          tenantId,
          sessionInstanceId: data.sessionInstanceId,
          studentId: data.studentId,
          priorityRank: nextRank,
          status: WaitlistStatus.WAITING,
          notes: data.notes ?? null,
        },
        update: {
          priorityRank: nextRank,
          status: WaitlistStatus.WAITING,
          notes: data.notes !== undefined ? data.notes : undefined,
          promotedToBookingId: null,
        },
        include: {
          student: {
            select: {
              fullName: true,
              mobilePhone: true,
            },
          },
        },
      });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'WAITLIST_JOINED',
      resourceType: 'WaitlistEntry',
      resourceId: entry.id,
      details: {
        studentId: entry.studentId,
        sessionInstanceId: entry.sessionInstanceId,
        priorityRank: entry.priorityRank,
      },
    });

    return {
      id: entry.id,
      tenantId: entry.tenantId,
      sessionInstanceId: entry.sessionInstanceId,
      studentId: entry.studentId,
      studentName: entry.student.fullName,
      studentPhone: entry.student.mobilePhone,
      priorityRank: entry.priorityRank,
      status: entry.status,
      promotedToBookingId: entry.promotedToBookingId,
      notes: entry.notes,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  async cancelWaitlist(tenantId: string, id: string, userId: string): Promise<void> {
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
    });
    if (!entry) {
      throw new NotFoundException(`Waitlist entry with ID ${id} not found`);
    }

    if (entry.status === WaitlistStatus.CANCELLED) {
      return;
    }

    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: WaitlistStatus.CANCELLED },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'WAITLIST_CANCELLED',
      resourceType: 'WaitlistEntry',
      resourceId: entry.id,
      details: {
        studentId: entry.studentId,
        sessionInstanceId: entry.sessionInstanceId,
      },
    });
  }

  async promoteWaitlistEntry(
    tenantId: string,
    id: string,
    userId: string
  ): Promise<BookingDetails> {
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        session: true,
        student: {
          include: {
            healthDisclaimer: {
              select: {
                injurySummary: true,
                hasPregnancyAlert: true,
              },
            },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Waitlist entry with ID ${id} not found`);
    }

    if (entry.status !== WaitlistStatus.WAITING) {
      throw new BadRequestException(`Waitlist entry is not waiting (current status: ${entry.status})`);
    }

    // Transactionally verify capacity and promote
    const booking = await prisma.$transaction(async (tx) => {
      const activeBookingsCount = await tx.booking.count({
        where: {
          tenantId,
          sessionInstanceId: entry.sessionInstanceId,
          status: { in: [BookingStatus.BOOKED, BookingStatus.ATTENDED] },
        },
      });

      if (activeBookingsCount >= entry.session.capacity) {
        throw new ConflictException(
          `Cannot promote waitlist: Session is at full capacity (${activeBookingsCount}/${entry.session.capacity}).`
        );
      }

      const createdBooking = await tx.booking.upsert({
        where: {
          tenantId_sessionInstanceId_studentId: {
            tenantId,
            sessionInstanceId: entry.sessionInstanceId,
            studentId: entry.studentId,
          },
        },
        create: {
          tenantId,
          sessionInstanceId: entry.sessionInstanceId,
          studentId: entry.studentId,
          status: BookingStatus.BOOKED,
          source: BookingSource.ADMIN_OVERRIDE,
          notes: 'Promoted from waitlist by staff',
        },
        update: {
          status: BookingStatus.BOOKED,
          source: BookingSource.ADMIN_OVERRIDE,
          cancelledAt: null,
          cancellationReason: null,
          notes: 'Promoted from waitlist by staff',
        },
        include: {
          student: {
            select: {
              fullName: true,
              mobilePhone: true,
              email: true,
              healthDisclaimer: {
                select: {
                  injurySummary: true,
                  hasPregnancyAlert: true,
                },
              },
            },
          },
          session: {
            select: {
              sessionDate: true,
              startTimestamp: true,
              endTimestamp: true,
              classType: { select: { name: true } },
              room: { select: { name: true } },
              instructor: { select: { fullName: true } },
            },
          },
          attendance: {
            include: {
              checkedInByUser: { select: { fullName: true } },
            },
          },
        },
      });

      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: WaitlistStatus.PROMOTED,
          promotedToBookingId: createdBooking.id,
        },
      });

      return createdBooking;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'WAITLIST_PROMOTED',
      resourceType: 'WaitlistEntry',
      resourceId: entry.id,
      details: {
        bookingId: booking.id,
        sessionInstanceId: entry.sessionInstanceId,
        studentId: entry.studentId,
      },
    });

    const hasCaution =
      !!booking.student.healthDisclaimer?.injurySummary ||
      !!booking.student.healthDisclaimer?.hasPregnancyAlert;

    return {
      id: booking.id,
      tenantId: booking.tenantId,
      sessionInstanceId: booking.sessionInstanceId,
      studentId: booking.studentId,
      studentName: booking.student.fullName,
      studentPhone: booking.student.mobilePhone,
      studentEmail: booking.student.email,
      hasHealthCaution: hasCaution,
      status: booking.status,
      source: booking.source,
      bookedAt: booking.bookedAt.toISOString(),
      cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
      cancellationReason: booking.cancellationReason,
      notes: booking.notes,
      checkedInAt: booking.attendance?.checkedInAt?.toISOString() || null,
      checkedInByUserName: booking.attendance?.checkedInByUser?.fullName || null,
      checkInMethod: booking.attendance?.checkInMethod || null,
      className: booking.session.classType.name,
      sessionDate: booking.session.sessionDate.toISOString().slice(0, 10),
      sessionStart: booking.session.startTimestamp.toISOString(),
      sessionEnd: booking.session.endTimestamp.toISOString(),
      roomName: booking.session.room.name,
      instructorName: booking.session.instructor.fullName,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }
}
