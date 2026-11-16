import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { prisma, BookingStatus, BookingSource, WaitlistStatus } from '@yogaos/database';
import {
  CreateBookingRequest,
  CancelBookingRequest,
  BookingDetails,
  BookingListQuery,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';
import { EligibilityService } from '../student-plans/eligibility.service.js';
import { CreditLedgerService } from '../student-plans/credit-ledger.service.js';

@Injectable()
export class BookingsService {
  private readonly eligibility: EligibilityService;
  private readonly creditLedger: CreditLedgerService;

  constructor(
    private readonly audit: AuditService,
    eligibilityService?: EligibilityService,
    creditLedgerService?: CreditLedgerService
  ) {
    this.eligibility = eligibilityService ?? new EligibilityService();
    this.creditLedger = creditLedgerService ?? new CreditLedgerService(audit);
  }

  async createBooking(
    tenantId: string,
    data: CreateBookingRequest,
    userId: string
  ): Promise<BookingDetails> {
    // 1. Validate student exists in tenant and is ACTIVE
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, tenantId, deletedAt: null },
      include: { healthDisclaimer: true },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }
    if (student.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot book class for inactive student (status: ${student.status})`);
    }

    // 2. Validate session exists in tenant and is SCHEDULED
    const session = await prisma.classSessionInstance.findFirst({
      where: { id: data.sessionInstanceId, tenantId },
      include: {
        classType: { select: { name: true } },
        room: { select: { name: true, maxMatCapacity: true } },
        instructor: { select: { fullName: true } },
      },
    });
    if (!session) {
      throw new NotFoundException(`Class session with ID ${data.sessionInstanceId} not found`);
    }
    if (session.status === 'CANCELLED') {
      throw new BadRequestException('Cannot book into a cancelled session');
    }
    if (session.status === 'COMPLETED') {
      throw new BadRequestException('Cannot book into a completed past session');
    }

    // 3. Check for existing active booking
    const existing = await prisma.booking.findUnique({
      where: {
        tenantId_sessionInstanceId_studentId: {
          tenantId,
          sessionInstanceId: data.sessionInstanceId,
          studentId: data.studentId,
        },
      },
    });

    if (existing && (existing.status === BookingStatus.BOOKED || existing.status === BookingStatus.ATTENDED)) {
      throw new ConflictException('Student already has an active booking for this session');
    }

    // 4. Check for student membership / pass eligibility
    const eligibility = await this.eligibility.checkEligibility(
      tenantId,
      data.studentId,
      data.sessionInstanceId
    );
    const linkedMembershipId = eligibility.eligible ? eligibility.studentMembershipId : null;

    // 5. Enforce capacity transactionally
    const booking = await prisma.$transaction(async (tx) => {
      // Query current active bookings with lock or transactional count
      const activeBookingsCount = await tx.booking.count({
        where: {
          tenantId,
          sessionInstanceId: data.sessionInstanceId,
          status: { in: [BookingStatus.BOOKED, BookingStatus.ATTENDED] },
        },
      });

      if (activeBookingsCount >= session.capacity) {
        throw new ConflictException(
          `Class session is at full capacity (${activeBookingsCount}/${session.capacity}). Student must be placed on the waitlist.`
        );
      }

      // Upsert booking
      const created = await tx.booking.upsert({
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
          status: BookingStatus.BOOKED,
          source: (data.source as BookingSource) || BookingSource.FRONT_DESK,
          studentMembershipId: linkedMembershipId,
          notes: data.notes ?? null,
        },
        update: {
          status: BookingStatus.BOOKED,
          source: (data.source as BookingSource) || BookingSource.FRONT_DESK,
          studentMembershipId: linkedMembershipId,
          cancelledAt: null,
          cancellationReason: null,
          notes: data.notes !== undefined ? data.notes : undefined,
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

      // If student was on waitlist in WAITING status, mark waitlist entry as PROMOTED
      await tx.waitlistEntry.updateMany({
        where: {
          tenantId,
          sessionInstanceId: data.sessionInstanceId,
          studentId: data.studentId,
          status: WaitlistStatus.WAITING,
        },
        data: {
          status: WaitlistStatus.PROMOTED,
          promotedToBookingId: created.id,
        },
      });

      return created;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BOOKING_CREATED',
      resourceType: 'Booking',
      resourceId: booking.id,
      details: {
        studentId: data.studentId,
        sessionInstanceId: data.sessionInstanceId,
        source: booking.source,
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

  async cancelBooking(
    tenantId: string,
    id: string,
    data: CancelBookingRequest = {},
    userId: string
  ): Promise<BookingDetails> {
    const existing = await prisma.booking.findFirst({
      where: { id, tenantId },
      include: {
        session: {
          include: {
            classType: { select: { name: true } },
            room: { select: { name: true } },
            instructor: { select: { fullName: true } },
          },
        },
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
        attendance: {
          include: {
            checkedInByUser: { select: { fullName: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    if (existing.status === BookingStatus.CANCELLED) {
      const hasCaution =
        !!existing.student.healthDisclaimer?.injurySummary ||
        !!existing.student.healthDisclaimer?.hasPregnancyAlert;
      return {
        id: existing.id,
        tenantId: existing.tenantId,
        sessionInstanceId: existing.sessionInstanceId,
        studentId: existing.studentId,
        studentName: existing.student.fullName,
        studentPhone: existing.student.mobilePhone,
        studentEmail: existing.student.email,
        hasHealthCaution: hasCaution,
        status: existing.status,
        source: existing.source,
        bookedAt: existing.bookedAt.toISOString(),
        cancelledAt: existing.cancelledAt ? existing.cancelledAt.toISOString() : null,
        cancellationReason: existing.cancellationReason,
        notes: existing.notes,
        checkedInAt: existing.attendance?.checkedInAt?.toISOString() || null,
        checkedInByUserName: existing.attendance?.checkedInByUser?.fullName || null,
        checkInMethod: existing.attendance?.checkInMethod || null,
        className: existing.session.classType.name,
        sessionDate: existing.session.sessionDate.toISOString().slice(0, 10),
        sessionStart: existing.session.startTimestamp.toISOString(),
        sessionEnd: existing.session.endTimestamp.toISOString(),
        roomName: existing.session.room.name,
        instructorName: existing.session.instructor.fullName,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    // Cancel booking and auto-promote waitlist entry if queue exists
    const updated = await prisma.$transaction(async (tx) => {
      // Refund credit if it was previously deducted
      if (existing.isPassCreditDeducted && existing.studentMembershipId) {
        await this.creditLedger.refundCredit(
          tx,
          tenantId,
          existing.studentMembershipId,
          existing.id,
          userId,
          'Booking cancellation credit restore'
        );
      }

      const cancelledBooking = await tx.booking.update({
        where: { id: existing.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: data.cancellationReason ?? 'Cancelled by request',
          isPassCreditDeducted: false,
        },
        include: {
          session: {
            include: {
              classType: { select: { name: true } },
              room: { select: { name: true } },
              instructor: { select: { fullName: true } },
            },
          },
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
          attendance: {
            include: {
              checkedInByUser: { select: { fullName: true } },
            },
          },
        },
      });

      // Check FIFO Waitlist for next student (FR-BKG-03: Cancellation & Auto-Promotion)
      const nextWaitlisted = await tx.waitlistEntry.findFirst({
        where: {
          tenantId,
          sessionInstanceId: existing.sessionInstanceId,
          status: WaitlistStatus.WAITING,
        },
        orderBy: { priorityRank: 'asc' },
      });

      if (nextWaitlisted) {
        // Promote next waitlisted student to BOOKED
        const promotedBooking = await tx.booking.upsert({
          where: {
            tenantId_sessionInstanceId_studentId: {
              tenantId,
              sessionInstanceId: existing.sessionInstanceId,
              studentId: nextWaitlisted.studentId,
            },
          },
          create: {
            tenantId,
            sessionInstanceId: existing.sessionInstanceId,
            studentId: nextWaitlisted.studentId,
            status: BookingStatus.BOOKED,
            source: BookingSource.FRONT_DESK,
            notes: 'Auto-promoted from waitlist upon spot cancellation',
          },
          update: {
            status: BookingStatus.BOOKED,
            source: BookingSource.FRONT_DESK,
            cancelledAt: null,
            cancellationReason: null,
            notes: 'Auto-promoted from waitlist upon spot cancellation',
          },
        });

        await tx.waitlistEntry.update({
          where: { id: nextWaitlisted.id },
          data: {
            status: WaitlistStatus.PROMOTED,
            promotedToBookingId: promotedBooking.id,
          },
        });
      }

      return cancelledBooking;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BOOKING_CANCELLED',
      resourceType: 'Booking',
      resourceId: updated.id,
      details: {
        reason: data.cancellationReason,
        sessionInstanceId: updated.sessionInstanceId,
        studentId: updated.studentId,
      },
    });

    const hasCaution =
      !!updated.student.healthDisclaimer?.injurySummary ||
      !!updated.student.healthDisclaimer?.hasPregnancyAlert;

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      sessionInstanceId: updated.sessionInstanceId,
      studentId: updated.studentId,
      studentName: updated.student.fullName,
      studentPhone: updated.student.mobilePhone,
      studentEmail: updated.student.email,
      hasHealthCaution: hasCaution,
      status: updated.status,
      source: updated.source,
      bookedAt: updated.bookedAt.toISOString(),
      cancelledAt: updated.cancelledAt ? updated.cancelledAt.toISOString() : null,
      cancellationReason: updated.cancellationReason,
      notes: updated.notes,
      checkedInAt: updated.attendance?.checkedInAt?.toISOString() || null,
      checkedInByUserName: updated.attendance?.checkedInByUser?.fullName || null,
      checkInMethod: updated.attendance?.checkInMethod || null,
      className: updated.session.classType.name,
      sessionDate: updated.session.sessionDate.toISOString().slice(0, 10),
      sessionStart: updated.session.startTimestamp.toISOString(),
      sessionEnd: updated.session.endTimestamp.toISOString(),
      roomName: updated.session.room.name,
      instructorName: updated.session.instructor.fullName,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async getBooking(tenantId: string, id: string): Promise<BookingDetails> {
    const booking = await prisma.booking.findFirst({
      where: { id, tenantId },
      include: {
        session: {
          include: {
            classType: { select: { name: true } },
            room: { select: { name: true } },
            instructor: { select: { fullName: true } },
          },
        },
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
        attendance: {
          include: {
            checkedInByUser: { select: { fullName: true } },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

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

  async getBookings(
    tenantId: string,
    query: BookingListQuery = { page: 1, limit: 50 }
  ): Promise<{ bookings: BookingDetails[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (query.sessionInstanceId) where.sessionInstanceId = query.sessionInstanceId;
    if (query.studentId) where.studentId = query.studentId;
    if (query.status) where.status = query.status as BookingStatus;

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          session: {
            include: {
              classType: { select: { name: true } },
              room: { select: { name: true } },
              instructor: { select: { fullName: true } },
            },
          },
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
          attendance: {
            include: {
              checkedInByUser: { select: { fullName: true } },
            },
          },
        },
        orderBy: { bookedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const mapped: BookingDetails[] = bookings.map((b) => {
      const hasCaution =
        !!b.student.healthDisclaimer?.injurySummary ||
        !!b.student.healthDisclaimer?.hasPregnancyAlert;

      return {
        id: b.id,
        tenantId: b.tenantId,
        sessionInstanceId: b.sessionInstanceId,
        studentId: b.studentId,
        studentName: b.student.fullName,
        studentPhone: b.student.mobilePhone,
        studentEmail: b.student.email,
        hasHealthCaution: hasCaution,
        status: b.status,
        source: b.source,
        bookedAt: b.bookedAt.toISOString(),
        cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
        cancellationReason: b.cancellationReason,
        notes: b.notes,
        checkedInAt: b.attendance?.checkedInAt?.toISOString() || null,
        checkedInByUserName: b.attendance?.checkedInByUser?.fullName || null,
        checkInMethod: b.attendance?.checkInMethod || null,
        className: b.session.classType.name,
        sessionDate: b.session.sessionDate.toISOString().slice(0, 10),
        sessionStart: b.session.startTimestamp.toISOString(),
        sessionEnd: b.session.endTimestamp.toISOString(),
        roomName: b.session.room.name,
        instructorName: b.session.instructor.fullName,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    });

    return { bookings: mapped, total, page, limit };
  }

  async getStudentBookings(tenantId: string, studentId: string): Promise<BookingDetails[]> {
    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const bookings = await prisma.booking.findMany({
      where: { tenantId, studentId },
      include: {
        session: {
          include: {
            classType: { select: { name: true } },
            room: { select: { name: true } },
            instructor: { select: { fullName: true } },
          },
        },
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
        attendance: {
          include: {
            checkedInByUser: { select: { fullName: true } },
          },
        },
      },
      orderBy: { session: { startTimestamp: 'desc' } },
    });

    return bookings.map((b) => {
      const hasCaution =
        !!b.student.healthDisclaimer?.injurySummary ||
        !!b.student.healthDisclaimer?.hasPregnancyAlert;

      return {
        id: b.id,
        tenantId: b.tenantId,
        sessionInstanceId: b.sessionInstanceId,
        studentId: b.studentId,
        studentName: b.student.fullName,
        studentPhone: b.student.mobilePhone,
        studentEmail: b.student.email,
        hasHealthCaution: hasCaution,
        status: b.status,
        source: b.source,
        bookedAt: b.bookedAt.toISOString(),
        cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
        cancellationReason: b.cancellationReason,
        notes: b.notes,
        checkedInAt: b.attendance?.checkedInAt?.toISOString() || null,
        checkedInByUserName: b.attendance?.checkedInByUser?.fullName || null,
        checkInMethod: b.attendance?.checkInMethod || null,
        className: b.session.classType.name,
        sessionDate: b.session.sessionDate.toISOString().slice(0, 10),
        sessionStart: b.session.startTimestamp.toISOString(),
        sessionEnd: b.session.endTimestamp.toISOString(),
        roomName: b.session.room.name,
        instructorName: b.session.instructor.fullName,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    });
  }
}
