import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  UserRole,
  MemberStatus,
  BookingStatus,
  WaitlistStatus,
  CheckInMethod,
} from '@yogaos/database';
import { BookingsService } from '../src/modules/bookings/bookings.service.js';
import { WaitlistService } from '../src/modules/bookings/waitlist.service.js';
import { AttendanceService } from '../src/modules/bookings/attendance.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('P10 Real Database Integration Tests (Bookings, Waitlists & Attendance)', () => {
  let auditService: AuditService;
  let bookingsService: BookingsService;
  let waitlistService: WaitlistService;
  let attendanceService: AttendanceService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];

  // Tenants & entities
  let tenantA: string;
  let tenantB: string;
  let userStaffA: string;
  let userStaffB: string;

  let branchA: string;
  let roomA: string; // capacity 2
  let classTypeA: string;
  let sessionCap2: string; // Session with max capacity = 2

  let student1: string;
  let student2: string;
  let student3: string;
  let studentInactive: string;
  let studentTenantB: string;

  beforeAll(async () => {
    auditService = new AuditService();
    bookingsService = new BookingsService(auditService);
    waitlistService = new WaitlistService(auditService);
    attendanceService = new AttendanceService(auditService);

    // 1. Create Tenant A
    const orgA = await prisma.organization.create({
      data: {
        name: `Sattva Yoga Shala ${Date.now()}`,
        slug: `sattva-yoga-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    // 2. Create Tenant B
    const orgB = await prisma.organization.create({
      data: {
        name: `Kalyan Yoga Retreat ${Date.now()}`,
        slug: `kalyan-yoga-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 3. Create Staff Users
    const staffA = await prisma.user.create({
      data: {
        fullName: 'Meera Frontdesk',
        email: `meera.frontdesk.${Date.now()}@sattva.com`,
      },
    });
    userStaffA = staffA.id;
    createdUserIds.push(userStaffA);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userStaffA,
        role: UserRole.RECEPTIONIST,
        status: MemberStatus.ACTIVE,
      },
    });

    const staffB = await prisma.user.create({
      data: {
        fullName: 'Kiran Manager',
        email: `kiran.manager.${Date.now()}@kalyan.com`,
      },
    });
    userStaffB = staffB.id;
    createdUserIds.push(userStaffB);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: userStaffB,
        role: UserRole.MANAGER,
        status: MemberStatus.ACTIVE,
      },
    });

    // 4. Create Branch & Room in Tenant A
    const bA = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Sattva Indiranagar',
        slug: `sattva-indiranagar-${Date.now()}`,
        streetAddress: '12th Main, HAL 2nd Stage',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560038',
        phone: '+91 99000 11221',
        email: 'info@sattvayoga.com',
      },
    });
    branchA = bA.id;

    const rA = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA,
        name: 'Pranayama Chamber',
        maxMatCapacity: 10,
      },
    });
    roomA = rA.id;

    // 5. Create Class Type & Session (Capacity = 2 for tight capacity testing)
    const ctA = await prisma.classType.create({
      data: {
        tenantId: tenantA,
        name: 'Gentle Evening Yin',
        category: 'Yin',
        level: 'ALL_LEVELS',
        defaultDurationMins: 60,
        defaultCapacity: 2,
      },
    });
    classTypeA = ctA.id;

    const sessionInstance = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        classTypeId: classTypeA,
        branchId: branchA,
        roomId: roomA,
        instructorId: userStaffA,
        sessionDate: new Date('2027-04-15T00:00:00.000Z'),
        startTimestamp: new Date('2027-04-15T18:00:00.000Z'),
        endTimestamp: new Date('2027-04-15T19:00:00.000Z'),
        capacity: 2, // Maximum 2 students
        status: 'SCHEDULED',
      },
    });
    sessionCap2 = sessionInstance.id;

    // 6. Create Students in Tenant A
    const s1 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Ananya Roy',
        mobilePhone: `98000${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'ACTIVE',
        emergencyContactName: 'Raj Roy',
        emergencyContactPhone: '9800099999',
        emergencyContactRelation: 'Spouse',
      },
    });
    student1 = s1.id;
    createdStudentIds.push(student1);

    // Give Student 1 a health caution flag
    await prisma.studentHealthDisclaimer.create({
      data: {
        tenantId: tenantA,
        studentId: student1,
        injurySummary: 'Right Knee Meniscus Tear',
        healthNotesCiphertext: 'encrypted-narrative-test',
        healthNotesIv: 'iv-test',
        healthNotesTag: 'tag-test',
        hasPregnancyAlert: false,
      },
    });

    const s2 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Kavita Nair',
        mobilePhone: `98000${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'ACTIVE',
        emergencyContactName: 'Sunil Nair',
        emergencyContactPhone: '9800088888',
        emergencyContactRelation: 'Brother',
      },
    });
    student2 = s2.id;
    createdStudentIds.push(student2);

    const s3 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Rahul Verma',
        mobilePhone: `98000${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'ACTIVE',
        emergencyContactName: 'Pooja Verma',
        emergencyContactPhone: '9800077777',
        emergencyContactRelation: 'Sister',
      },
    });
    student3 = s3.id;
    createdStudentIds.push(student3);

    const sInactive = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Siddharth Inactive',
        mobilePhone: `98000${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'INACTIVE',
        emergencyContactName: 'Maya Inactive',
        emergencyContactPhone: '9800066666',
        emergencyContactRelation: 'Parent',
      },
    });
    studentInactive = sInactive.id;
    createdStudentIds.push(studentInactive);

    // Student in Tenant B
    const sB = await prisma.student.create({
      data: {
        tenantId: tenantB,
        homeBranchId: branchA, // foreign
        fullName: 'Farhan TenantB',
        mobilePhone: `98000${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'ACTIVE',
        emergencyContactName: 'Zainab TenantB',
        emergencyContactPhone: '9800055555',
        emergencyContactRelation: 'Spouse',
      },
    });
    studentTenantB = sB.id;
    createdStudentIds.push(studentTenantB);
  });

  afterAll(async () => {
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  describe('1. Student Booking & Capacity Enforcement', () => {
    let booking1Id: string;
    let booking2Id: string;

    it('should create confirmed booking for Student 1 and expose health caution without clinical narrative', async () => {
      const b1 = await bookingsService.createBooking(
        tenantA,
        {
          sessionInstanceId: sessionCap2,
          studentId: student1,
          source: 'FRONT_DESK',
        },
        userStaffA
      );

      expect(b1).toBeDefined();
      expect(b1.id).toBeDefined();
      expect(b1.status).toBe(BookingStatus.BOOKED);
      expect(b1.studentName).toBe('Ananya Roy');
      expect(b1.hasHealthCaution).toBe(true); // Flagged because of meniscus tear
      booking1Id = b1.id;
    });

    it('should prevent duplicate active bookings for the same student and session', async () => {
      await expect(
        bookingsService.createBooking(
          tenantA,
          {
            sessionInstanceId: sessionCap2,
            studentId: student1,
          },
          userStaffA
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent booking inactive students', async () => {
      await expect(
        bookingsService.createBooking(
          tenantA,
          {
            sessionInstanceId: sessionCap2,
            studentId: studentInactive,
          },
          userStaffA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent cross-tenant booking associations', async () => {
      // Tenant B trying to book Tenant A's session
      await expect(
        bookingsService.createBooking(
          tenantB,
          {
            sessionInstanceId: sessionCap2,
            studentId: studentTenantB,
          },
          userStaffB
        )
      ).rejects.toThrow(NotFoundException);

      // Tenant A trying to book Tenant B's student
      await expect(
        bookingsService.createBooking(
          tenantA,
          {
            sessionInstanceId: sessionCap2,
            studentId: studentTenantB,
          },
          userStaffA
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should book second spot and fill session capacity (2/2)', async () => {
      const b2 = await bookingsService.createBooking(
        tenantA,
        {
          sessionInstanceId: sessionCap2,
          studentId: student2,
          source: 'FRONT_DESK',
        },
        userStaffA
      );

      expect(b2.status).toBe(BookingStatus.BOOKED);
      expect(b2.hasHealthCaution).toBe(false);
      booking2Id = b2.id;
    });

    it('should reject booking attempts once capacity is full', async () => {
      // Attempting to book Student 3 when 2/2 spots are filled must reject with ConflictException
      await expect(
        bookingsService.createBooking(
          tenantA,
          {
            sessionInstanceId: sessionCap2,
            studentId: student3,
          },
          userStaffA
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should enforce capacity under concurrent booking requests', async () => {
      // Create a dedicated session with capacity = 1
      const singleSession = await prisma.classSessionInstance.create({
        data: {
          tenantId: tenantA,
          classTypeId: classTypeA,
          branchId: branchA,
          roomId: roomA,
          instructorId: userStaffA,
          sessionDate: new Date('2027-04-16T00:00:00.000Z'),
          startTimestamp: new Date('2027-04-16T10:00:00.000Z'),
          endTimestamp: new Date('2027-04-16T11:00:00.000Z'),
          capacity: 1,
          status: 'SCHEDULED',
        },
      });

      // Two students race to book the single spot simultaneously
      const results = await Promise.allSettled([
        bookingsService.createBooking(
          tenantA,
          { sessionInstanceId: singleSession.id, studentId: student2 },
          userStaffA
        ),
        bookingsService.createBooking(
          tenantA,
          { sessionInstanceId: singleSession.id, studentId: student3 },
          userStaffA
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify active booking count in database is strictly 1
      const count = await prisma.booking.count({
        where: {
          sessionInstanceId: singleSession.id,
          status: BookingStatus.BOOKED,
        },
      });
      expect(count).toBe(1);
    });
  });

  describe('2. Waitlist FIFO Queue & Auto-Promotion on Cancellation', () => {
    let waitlistEntry1Id: string;

    it('should queue Student 3 on the waitlist when session is full with priority rank 1', async () => {
      const entry = await waitlistService.joinWaitlist(
        tenantA,
        {
          sessionInstanceId: sessionCap2,
          studentId: student3,
          notes: 'Wants spot if someone cancels',
        },
        userStaffA
      );

      expect(entry).toBeDefined();
      expect(entry.priorityRank).toBe(1);
      expect(entry.status).toBe(WaitlistStatus.WAITING);
      expect(entry.studentName).toBe('Rahul Verma');
      waitlistEntry1Id = entry.id;
    });

    it('should prevent duplicate waitlist entries for the same student and session', async () => {
      await expect(
        waitlistService.joinWaitlist(
          tenantA,
          {
            sessionInstanceId: sessionCap2,
            studentId: student3,
          },
          userStaffA
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should automatically promote top waitlisted student when an enrolled student cancels (FR-BKG-03)', async () => {
      // Find Student 1's booking
      const b1 = await prisma.booking.findFirst({
        where: {
          tenantId: tenantA,
          sessionInstanceId: sessionCap2,
          studentId: student1,
          status: BookingStatus.BOOKED,
        },
      });
      expect(b1).toBeDefined();

      // Cancel Student 1's booking
      const cancelled = await bookingsService.cancelBooking(
        tenantA,
        b1!.id,
        { cancellationReason: 'Travel clash' },
        userStaffA
      );

      expect(cancelled.status).toBe(BookingStatus.CANCELLED);
      expect(cancelled.cancellationReason).toBe('Travel clash');

      // Verify waitlist entry was automatically promoted
      const updatedWaitlist = await prisma.waitlistEntry.findUnique({
        where: { id: waitlistEntry1Id },
      });
      expect(updatedWaitlist?.status).toBe(WaitlistStatus.PROMOTED);
      expect(updatedWaitlist?.promotedToBookingId).not.toBeNull();

      // Verify Student 3 now has an active confirmed BOOKED reservation
      const s3Booking = await prisma.booking.findFirst({
        where: {
          sessionInstanceId: sessionCap2,
          studentId: student3,
          status: BookingStatus.BOOKED,
        },
      });
      expect(s3Booking).toBeDefined();
      expect(s3Booking?.id).toBe(updatedWaitlist?.promotedToBookingId);

      // Verify total active bookings remain at capacity (2/2: Student 2 and Student 3)
      const activeCount = await prisma.booking.count({
        where: {
          sessionInstanceId: sessionCap2,
          status: BookingStatus.BOOKED,
        },
      });
      expect(activeCount).toBe(2);
    });

    it('should allow cancelling a waitlist entry', async () => {
      // Add Student 1 to waitlist
      const entry = await waitlistService.joinWaitlist(
        tenantA,
        {
          sessionInstanceId: sessionCap2,
          studentId: student1,
        },
        userStaffA
      );

      await waitlistService.cancelWaitlist(tenantA, entry.id, userStaffA);

      const fetched = await prisma.waitlistEntry.findUnique({
        where: { id: entry.id },
      });
      expect(fetched?.status).toBe(WaitlistStatus.CANCELLED);
    });
  });

  describe('3. Attendance Check-In, Corrections & Audit Trail', () => {
    let student2BookingId: string;

    beforeAll(async () => {
      const b2 = await prisma.booking.findFirst({
        where: {
          tenantId: tenantA,
          sessionInstanceId: sessionCap2,
          studentId: student2,
          status: BookingStatus.BOOKED,
        },
      });
      student2BookingId = b2!.id;
    });

    it('should mark student as ATTENDED and generate AttendanceRecord', async () => {
      const record = await attendanceService.markAttendance(
        tenantA,
        student2BookingId,
        {
          status: 'ATTENDED',
          checkInMethod: CheckInMethod.FRONT_DESK_ROSTER,
          notes: 'Checked in at front desk tablet',
        },
        userStaffA
      );

      expect(record.status).toBe(BookingStatus.ATTENDED);
      expect(record.checkedInByUserId).toBe(userStaffA);
      expect(record.checkInMethod).toBe(CheckInMethod.FRONT_DESK_ROSTER);

      // Check database AttendanceRecord
      const dbRecord = await prisma.attendanceRecord.findUnique({
        where: { bookingId: student2BookingId },
      });
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.checkedInByUserId).toBe(userStaffA);
    });

    it('should support attendance corrections (reverting ATTENDED back to BOOKED)', async () => {
      // Revert check-in
      const reverted = await attendanceService.markAttendance(
        tenantA,
        student2BookingId,
        {
          status: 'BOOKED',
          notes: 'Accidental check-in correction',
        },
        userStaffA
      );

      expect(reverted.status).toBe(BookingStatus.BOOKED);

      // Verify AttendanceRecord is deleted/cleaned
      const dbRecord = await prisma.attendanceRecord.findUnique({
        where: { bookingId: student2BookingId },
      });
      expect(dbRecord).toBeNull();
    });

    it('should support marking student as NO_SHOW', async () => {
      const marked = await attendanceService.markAttendance(
        tenantA,
        student2BookingId,
        {
          status: 'NO_SHOW',
        },
        userStaffA
      );

      expect(marked.status).toBe(BookingStatus.NO_SHOW);

      const dbBooking = await prisma.booking.findUnique({
        where: { id: student2BookingId },
      });
      expect(dbBooking?.status).toBe(BookingStatus.NO_SHOW);
    });

    it('should retrieve full session roster with counts, capacity, and privacy-safe health indicator', async () => {
      const roster = await attendanceService.getSessionRoster(tenantA, sessionCap2);

      expect(roster).toBeDefined();
      expect(roster.className).toBe('Gentle Evening Yin');
      expect(roster.capacity).toBe(2);
      expect(roster.bookings.length).toBeGreaterThanOrEqual(2);

      // Check Student 1 booking in roster
      const b1 = roster.bookings.find((b) => b.studentId === student1);
      expect(b1).toBeDefined();
      expect(b1?.hasHealthCaution).toBe(true); // Caution alert flagged
      // Raw clinical text should NOT exist on BookingDetails
      expect((b1 as any).healthNotes).toBeUndefined();
      expect((b1 as any).healthNotesCiphertext).toBeUndefined();
    });

    it('should verify audit log entries for all booking, waitlist, and attendance events', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { tenantId: tenantA },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('BOOKING_CREATED');
      expect(actions).toContain('BOOKING_CANCELLED');
      expect(actions).toContain('WAITLIST_JOINED');
      expect(actions).toContain('ATTENDANCE_CHECKED_IN');
      expect(actions).toContain('ATTENDANCE_CORRECTED');
    });

    it('should query a student booking history', async () => {
      const history = await bookingsService.getStudentBookings(tenantA, student1);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].studentId).toBe(student1);
    });

    it('should enforce tenant isolation on booking and roster queries', async () => {
      // Tenant B cannot fetch Tenant A's booking
      await expect(bookingsService.getBooking(tenantB, student2BookingId)).rejects.toThrow(
        NotFoundException
      );

      // Tenant B cannot mark attendance for Tenant A's booking
      await expect(
        attendanceService.markAttendance(
          tenantB,
          student2BookingId,
          { status: 'ATTENDED' },
          userStaffB
        )
      ).rejects.toThrow(NotFoundException);

      // Tenant B cannot view Tenant A's roster
      await expect(attendanceService.getSessionRoster(tenantB, sessionCap2)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
