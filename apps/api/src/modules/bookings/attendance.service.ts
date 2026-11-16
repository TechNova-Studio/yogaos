import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, BookingStatus, CheckInMethod } from '@yogaos/database';
import {
  MarkAttendanceRequest,
  AttendanceRecordDetails,
  SessionRoster,
  BookingDetails,
  WaitlistEntryDetails,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class AttendanceService {
  constructor(private readonly audit: AuditService) {}

  async markAttendance(
    tenantId: string,
    bookingId: string,
    data: MarkAttendanceRequest,
    userId: string
  ): Promise<AttendanceRecordDetails> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        session: true,
        attendance: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    if (booking.session.status === 'CANCELLED') {
      throw new BadRequestException('Cannot mark attendance for a cancelled session');
    }

    const targetStatus = data.status as BookingStatus;
    const checkInMethod = (data.checkInMethod as CheckInMethod) || CheckInMethod.FRONT_DESK_ROSTER;

    const record = await prisma.$transaction(async (tx) => {
      // 1. Update Booking status
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: targetStatus },
      });

      // 2. Handle AttendanceRecord
      if (targetStatus === BookingStatus.ATTENDED) {
        const attendanceRecord = await tx.attendanceRecord.upsert({
          where: { bookingId: booking.id },
          create: {
            tenantId,
            bookingId: booking.id,
            checkedInAt: new Date(),
            checkedInByUserId: userId,
            checkInMethod,
            notes: data.notes ?? null,
          },
          update: {
            checkedInAt: new Date(),
            checkedInByUserId: userId,
            checkInMethod,
            notes: data.notes !== undefined ? data.notes : undefined,
          },
          include: {
            checkedInByUser: { select: { fullName: true } },
          },
        });
        return attendanceRecord;
      } else {
        // NO_SHOW, LATE_CANCEL, or BOOKED (reverted check-in)
        if (booking.attendance) {
          await tx.attendanceRecord.delete({
            where: { bookingId: booking.id },
          });
        }
        return null;
      }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    const action =
      targetStatus === BookingStatus.ATTENDED
        ? 'ATTENDANCE_CHECKED_IN'
        : targetStatus === BookingStatus.BOOKED
        ? 'ATTENDANCE_CORRECTED'
        : 'ATTENDANCE_STATUS_UPDATED';

    await this.audit.log({
      tenantId,
      userId,
      action,
      resourceType: 'AttendanceRecord',
      resourceId: record?.id || booking.id,
      details: {
        bookingId: booking.id,
        sessionInstanceId: booking.sessionInstanceId,
        studentId: booking.studentId,
        newStatus: targetStatus,
        previousStatus: booking.status,
      },
    });

    return {
      id: record?.id || booking.id,
      tenantId,
      bookingId: booking.id,
      status: targetStatus,
      checkedInAt: record ? record.checkedInAt.toISOString() : new Date().toISOString(),
      checkedInByUserId: userId,
      checkedInByUserName: user?.fullName || 'Staff User',
      checkInMethod,
      notes: data.notes ?? null,
      createdAt: record ? record.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: record ? record.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  async getSessionRoster(tenantId: string, sessionId: string): Promise<SessionRoster> {
    const session = await prisma.classSessionInstance.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        classType: { select: { name: true } },
        batch: { select: { name: true } },
        branch: { select: { name: true } },
        room: { select: { name: true } },
        instructor: { select: { fullName: true } },
        bookings: {
          include: {
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
          orderBy: { bookedAt: 'asc' },
        },
        waitlistEntries: {
          where: { status: 'WAITING' },
          include: {
            student: {
              select: {
                fullName: true,
                mobilePhone: true,
              },
            },
          },
          orderBy: { priorityRank: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Class session with ID ${sessionId} not found`);
    }

    const activeBookings = session.bookings.filter(
      (b) => b.status === BookingStatus.BOOKED || b.status === BookingStatus.ATTENDED
    );
    const attendedCount = session.bookings.filter(
      (b) => b.status === BookingStatus.ATTENDED
    ).length;

    const mappedBookings: BookingDetails[] = session.bookings.map((b) => {
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
        className: session.classType.name,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        sessionStart: session.startTimestamp.toISOString(),
        sessionEnd: session.endTimestamp.toISOString(),
        roomName: session.room.name,
        instructorName: session.instructor.fullName,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    });

    const mappedWaitlist: WaitlistEntryDetails[] = session.waitlistEntries.map((w) => ({
      id: w.id,
      tenantId: w.tenantId,
      sessionInstanceId: w.sessionInstanceId,
      studentId: w.studentId,
      studentName: w.student.fullName,
      studentPhone: w.student.mobilePhone,
      priorityRank: w.priorityRank,
      status: w.status,
      promotedToBookingId: w.promotedToBookingId,
      notes: w.notes,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }));

    return {
      sessionId: session.id,
      className: session.classType.name,
      batchName: session.batch?.name || null,
      branchName: session.branch.name,
      roomName: session.room.name,
      instructorName: session.instructor.fullName,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      startTimestamp: session.startTimestamp.toISOString(),
      endTimestamp: session.endTimestamp.toISOString(),
      capacity: session.capacity,
      bookedCount: activeBookings.length,
      availableCapacity: Math.max(0, session.capacity - activeBookings.length),
      attendedCount,
      waitlistCount: mappedWaitlist.length,
      status: session.status,
      bookings: mappedBookings,
      waitlist: mappedWaitlist,
    };
  }
}
