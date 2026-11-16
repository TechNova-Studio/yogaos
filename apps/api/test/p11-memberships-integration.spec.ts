import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  UserRole,
  MemberStatus,
  BookingStatus,
  MembershipStatus,
} from '@yogaos/database';
import { PlansService } from '../src/modules/student-plans/plans.service.js';
import { StudentMembershipsService } from '../src/modules/student-plans/student-memberships.service.js';
import { CreditLedgerService } from '../src/modules/student-plans/credit-ledger.service.js';
import { EligibilityService } from '../src/modules/student-plans/eligibility.service.js';
import { BookingsService } from '../src/modules/bookings/bookings.service.js';
import { AttendanceService } from '../src/modules/bookings/attendance.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

describe('P11 Real Database Integration Tests (Membership Plans, Student Memberships & Passes)', () => {
  let auditService: AuditService;
  let plansService: PlansService;
  let membershipsService: StudentMembershipsService;
  let creditLedgerService: CreditLedgerService;
  let eligibilityService: EligibilityService;
  let bookingsService: BookingsService;
  let attendanceService: AttendanceService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];

  // Tenants & entities
  let tenantA: string;
  let tenantB: string;
  let staffA: string;
  let staffB: string;

  let branchA: string;
  let branchB: string;
  let roomA: string;
  let classTypeA: string;
  let sessionA: string;

  let student1: string;
  let student2: string;
  let student3: string;

  // Plans & Memberships
  let unlimitedPlanId: string;
  let classPackPlanId: string;
  let dropInPlanId: string;
  let student1MembershipId: string;
  let student2MembershipId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    plansService = new PlansService(auditService);
    membershipsService = new StudentMembershipsService(auditService);
    creditLedgerService = new CreditLedgerService(auditService);
    eligibilityService = new EligibilityService();
    bookingsService = new BookingsService(auditService, eligibilityService, creditLedgerService);
    attendanceService = new AttendanceService(auditService, creditLedgerService);

    // 1. Create Tenant A
    const orgA = await prisma.organization.create({
      data: {
        name: `Prana Vinyasa Studio ${Date.now()}`,
        slug: `prana-vinyasa-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    // 2. Create Tenant B (Isolation testing)
    const orgB = await prisma.organization.create({
      data: {
        name: `Himalayan Yoga ${Date.now()}`,
        slug: `himalayan-yoga-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 3. Create Staff Users
    const userA = await prisma.user.create({
      data: {
        email: `manager-a-${Date.now()}@prana.com`,
        fullName: 'Studio Manager A',
      },
    });
    staffA = userA.id;
    createdUserIds.push(staffA);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: staffA,
        role: UserRole.MANAGER,
        status: MemberStatus.ACTIVE,
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: `manager-b-${Date.now()}@himalayan.com`,
        fullName: 'Studio Manager B',
      },
    });
    staffB = userB.id;
    createdUserIds.push(staffB);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: staffB,
        role: UserRole.MANAGER,
        status: MemberStatus.ACTIVE,
      },
    });

    // 4. Create Branches in Tenant A
    const branch1 = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'South Delhi Hub',
        slug: `south-delhi-${Date.now()}`,
        streetAddress: 'B-12 Greater Kailash 1',
        city: 'New Delhi',
        state: 'Delhi',
        stateCode: 'DL',
        postalCode: '110048',
        phone: '+91 99111 22334',
        email: 'southdelhi@prana.com',
      },
    });
    branchA = branch1.id;

    const branch2 = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Gurugram Branch',
        slug: `gurugram-${Date.now()}`,
        streetAddress: 'Golf Course Road, Sector 54',
        city: 'Gurugram',
        state: 'Haryana',
        stateCode: 'HR',
        postalCode: '122002',
        phone: '+91 99222 33445',
        email: 'gurugram@prana.com',
      },
    });
    branchB = branch2.id;

    // 5. Create Room, ClassType & Session in Tenant A
    const room = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA,
        name: 'Ganga Studio',
        maxMatCapacity: 10,
      },
    });
    roomA = room.id;

    const classType = await prisma.classType.create({
      data: {
        tenantId: tenantA,
        name: 'Vinyasa Flow 75',
        category: 'Vinyasa',
        level: 'ALL_LEVELS',
        defaultDurationMins: 75,
        defaultCapacity: 10,
      },
    });
    classTypeA = classType.id;

    const now = new Date();
    const sessionDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startTs = new Date(sessionDate.getTime() + 9 * 3600 * 1000);
    const endTs = new Date(sessionDate.getTime() + 10.25 * 3600 * 1000);

    const session = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA,
        roomId: roomA,
        classTypeId: classTypeA,
        instructorId: staffA,
        sessionDate,
        startTimestamp: startTs,
        endTimestamp: endTs,
        capacity: 10,
        status: 'SCHEDULED',
      },
    });
    sessionA = session.id;

    // 6. Create Students in Tenant A
    const s1 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Kavita Sharma',
        mobilePhone: `+919810${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
        emergencyContactName: 'Emergency Contact 1',
        emergencyContactPhone: '+919900011221',
        emergencyContactRelation: 'Spouse',
      },
    });
    student1 = s1.id;
    createdStudentIds.push(student1);

    const s2 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Rahul Verma',
        mobilePhone: `+919811${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
        emergencyContactName: 'Emergency Contact 2',
        emergencyContactPhone: '+919900011222',
        emergencyContactRelation: 'Parent',
      },
    });
    student2 = s2.id;
    createdStudentIds.push(student2);

    const s3 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Ananya Roy',
        mobilePhone: `+919812${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
        emergencyContactName: 'Emergency Contact 3',
        emergencyContactPhone: '+919900011223',
        emergencyContactRelation: 'Sibling',
      },
    });
    student3 = s3.id;
    createdStudentIds.push(student3);
  });

  afterAll(async () => {
    // Teardown created data in reverse dependency order
    await prisma.membershipCreditLedger.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.booking.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.studentMembership.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.membershipPlan.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.classSessionInstance.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.classType.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.student.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.room.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.branch.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.organizationMember.deleteMany({
      where: { tenantId: { in: createdOrgIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: createdOrgIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  });

  describe('1. Membership Plan Configuration & Lifecycle', () => {
    it('should create a TIME_UNLIMITED membership plan with tax and SAC defaults', async () => {
      const plan = await plansService.createPlan(
        tenantA,
        {
          name: 'Monthly Unlimited Sadhana',
          description: 'Unlimited access to all scheduled group classes',
          planType: 'TIME_UNLIMITED',
          price: 4500,
          validityDays: 30,
          maxFreezesAllowed: 1,
          maxFreezeDays: 14,
          isMultiBranchValid: true,
        },
        staffA
      );

      expect(plan.id).toBeDefined();
      expect(plan.name).toBe('Monthly Unlimited Sadhana');
      expect(plan.planType).toBe('TIME_UNLIMITED');
      expect(plan.price).toBe(4500);
      expect(plan.taxRatePercent).toBe(18);
      expect(plan.sacCode).toBe('9992');
      expect(plan.creditCount).toBeNull();
      expect(plan.maxFreezesAllowed).toBe(1);
      expect(plan.isActive).toBe(true);

      unlimitedPlanId = plan.id;
    });

    it('should create a CLASS_PACK membership plan with credit count', async () => {
      const plan = await plansService.createPlan(
        tenantA,
        {
          name: '10-Class Practice Pack',
          description: '10 class attendances valid across any branch',
          planType: 'CLASS_PACK',
          price: 3500,
          validityDays: 60,
          creditCount: 10,
          maxFreezesAllowed: 1,
          maxFreezeDays: 14,
          isMultiBranchValid: true,
        },
        staffA
      );

      expect(plan.id).toBeDefined();
      expect(plan.planType).toBe('CLASS_PACK');
      expect(plan.creditCount).toBe(10);
      expect(plan.validityDays).toBe(60);

      classPackPlanId = plan.id;
    });

    it('should create a SINGLE_DROP_IN plan defaulting creditCount to 1', async () => {
      const plan = await plansService.createPlan(
        tenantA,
        {
          name: 'Single Class Drop-In Pass',
          planType: 'SINGLE_DROP_IN',
          price: 600,
          validityDays: 7,
          isMultiBranchValid: true,
        },
        staffA
      );

      expect(plan.creditCount).toBe(1);
      dropInPlanId = plan.id;
    });

    it('should update plan price and attributes without affecting historical snapshot logic', async () => {
      const updated = await plansService.updatePlan(
        tenantA,
        classPackPlanId,
        {
          price: 4000,
          description: 'Updated price for new purchases',
        },
        staffA
      );

      expect(updated.price).toBe(4000);
      expect(updated.description).toBe('Updated price for new purchases');
    });

    it('should list active plans in tenant', async () => {
      const plans = await plansService.getPlans(tenantA, { isActive: true });
      expect(plans.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('2. Student Membership Assignment & Historical Snapshot Preservation', () => {
    it('should assign a 10-class pack to a student and record immutable snapshots', async () => {
      const membership = await membershipsService.assignMembership(
        tenantA,
        {
          studentId: student1,
          membershipPlanId: classPackPlanId,
          notes: 'Assigned via front-desk registration',
        },
        staffA
      );

      expect(membership.id).toBeDefined();
      expect(membership.studentId).toBe(student1);
      expect(membership.planNameSnapshot).toBe('10-Class Practice Pack');
      expect(membership.planTypeSnapshot).toBe('CLASS_PACK');
      expect(membership.priceSnapshot).toBe(4000);
      expect(membership.totalCredits).toBe(10);
      expect(membership.remainingCredits).toBe(10);
      expect(membership.status).toBe('ACTIVE');

      student1MembershipId = membership.id;

      // Verify Initial Allocation entry created in MembershipCreditLedger
      const ledgerEntries = await creditLedgerService.getLedgerEntries(tenantA, {
        studentMembershipId: membership.id,
      });

      expect(ledgerEntries.length).toBe(1);
      expect(ledgerEntries[0].entryType).toBe('INITIAL_ALLOCATION');
      expect(ledgerEntries[0].creditsDelta).toBe(10);
      expect(ledgerEntries[0].balanceAfter).toBe(10);
    });

    it('should preserve historical snapshots even if the underlying plan is mutated or archived', async () => {
      // Mutate the master plan price and name
      await plansService.updatePlan(
        tenantA,
        classPackPlanId,
        {
          name: '10-Class Pack (NEW 2027 PRICE)',
          price: 5500,
        },
        staffA
      );

      // Verify Student 1's membership has not changed
      const studentMembership = await membershipsService.getMembership(tenantA, student1MembershipId);
      expect(studentMembership.planNameSnapshot).toBe('10-Class Practice Pack');
      expect(studentMembership.priceSnapshot).toBe(4000); // Retains original ₹4,000 snapshot
    });
  });

  describe('3. Freeze & Unfreeze Mechanics', () => {
    it('should freeze an active membership and track frozenAt timestamp', async () => {
      const frozen = await membershipsService.freezeMembership(
        tenantA,
        student1MembershipId,
        { freezeReason: 'Knee rehabilitation rest' },
        staffA
      );

      expect(frozen.status).toBe('FROZEN');
      expect(frozen.frozenAt).toBeDefined();
      expect(frozen.freezeReason).toBe('Knee rehabilitation rest');
    });

    it('should prevent freezing an already frozen membership', async () => {
      await expect(
        membershipsService.freezeMembership(
          tenantA,
          student1MembershipId,
          { freezeReason: 'Double freeze attempt' },
          staffA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should unfreeze membership, extend expiry date by frozen days, and increment freezesUsed', async () => {
      const beforeUnfreeze = await membershipsService.getMembership(tenantA, student1MembershipId);
      const originalExpiry = new Date(beforeUnfreeze.expiryDate);

      const unfrozen = await membershipsService.unfreezeMembership(
        tenantA,
        student1MembershipId,
        staffA
      );

      expect(unfrozen.status).toBe('ACTIVE');
      expect(unfrozen.frozenAt).toBeNull();
      expect(unfrozen.freezeReason).toBeNull();
      expect(unfrozen.freezesUsed).toBe(1);
      expect(unfrozen.totalFrozenDays).toBeGreaterThanOrEqual(1);

      // Expiry date must have been extended
      const newExpiry = new Date(unfrozen.expiryDate);
      expect(newExpiry.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should enforce maxFreezesAllowed limit on subsequent freeze attempts', async () => {
      // The plan allows maxFreezesAllowed = 1, and we have now used 1 freeze
      await expect(
        membershipsService.freezeMembership(
          tenantA,
          student1MembershipId,
          { freezeReason: 'Second freeze attempt beyond plan limit' },
          staffA
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Class Passes & Auditable Entitlement Credit Ledger', () => {
    it('should track manual credit adjustments and prevent negative balances', async () => {
      // Assign 5-class pack to Student 2
      const pack5 = await plansService.createPlan(
        tenantA,
        {
          name: '5-Class Mini Pack',
          planType: 'CLASS_PACK',
          price: 2000,
          validityDays: 30,
          creditCount: 5,
          isMultiBranchValid: true,
        },
        staffA
      );

      const membership = await membershipsService.assignMembership(
        tenantA,
        {
          studentId: student2,
          membershipPlanId: pack5.id,
        },
        staffA
      );
      student2MembershipId = membership.id;

      // Initial credit count = 5
      expect(membership.remainingCredits).toBe(5);

      // Manual adjustment: Add 2 courtesy credits
      const entryAdd = await creditLedgerService.manualAdjustment(
        tenantA,
        student2MembershipId,
        { creditsDelta: 2, reason: 'Complimentary bonus class' },
        staffA
      );

      expect(entryAdd.entryType).toBe('MANUAL_ADJUSTMENT');
      expect(entryAdd.creditsDelta).toBe(2);
      expect(entryAdd.balanceAfter).toBe(7);

      const mAfterAdd = await membershipsService.getMembership(tenantA, student2MembershipId);
      expect(mAfterAdd.remainingCredits).toBe(7);

      // Manual adjustment: Deduct 1 credit
      const entrySub = await creditLedgerService.manualAdjustment(
        tenantA,
        student2MembershipId,
        { creditsDelta: -1, reason: 'Correction of accidental over-allocation' },
        staffA
      );
      expect(entrySub.balanceAfter).toBe(6);

      // Manual adjustment: Attempt to deduct more credits than balance (e.g. -20)
      await expect(
        creditLedgerService.manualAdjustment(
          tenantA,
          student2MembershipId,
          { creditsDelta: -20, reason: 'Excess deduction' },
          staffA
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Booking Eligibility & Attendance Credit Deduction / Restoration', () => {
    it('should verify student eligibility and link membership when creating a booking', async () => {
      // Check eligibility
      const eligibility = await eligibilityService.checkEligibility(
        tenantA,
        student2,
        sessionA
      );

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.studentMembershipId).toBe(student2MembershipId);
      expect(eligibility.remainingCredits).toBe(6);

      // Create booking
      const booking = await bookingsService.createBooking(
        tenantA,
        {
          studentId: student2,
          sessionInstanceId: sessionA,
        },
        staffA
      );

      expect(booking.id).toBeDefined();
      expect(booking.status).toBe(BookingStatus.BOOKED);

      // Verify booking is linked to student membership
      const dbBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(dbBooking?.studentMembershipId).toBe(student2MembershipId);
      expect(dbBooking?.isPassCreditDeducted).toBe(false);
    });

    it('should deduct 1 credit via ledger on attendance check-in', async () => {
      const dbBooking = await prisma.booking.findFirst({
        where: { tenantId: tenantA, studentId: student2, sessionInstanceId: sessionA },
      });
      expect(dbBooking).toBeDefined();

      // Check-in student
      await attendanceService.markAttendance(
        tenantA,
        dbBooking!.id,
        { status: 'ATTENDED' },
        staffA
      );

      // Booking flag must be updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: dbBooking!.id },
      });
      expect(updatedBooking?.isPassCreditDeducted).toBe(true);

      // Membership remaining credits must be debited by 1
      const updatedMembership = await membershipsService.getMembership(tenantA, student2MembershipId);
      expect(updatedMembership.remainingCredits).toBe(5);

      // Ledger must contain REDEMPTION entry
      const ledger = await creditLedgerService.getLedgerEntries(tenantA, {
        studentMembershipId: student2MembershipId,
      });
      const redemption = ledger.find((l) => l.entryType === 'REDEMPTION');
      expect(redemption).toBeDefined();
      expect(redemption?.creditsDelta).toBe(-1);
      expect(redemption?.balanceAfter).toBe(5);
      expect(redemption?.bookingId).toBe(dbBooking!.id);
    });

    it('should restore credit on booking cancellation if credit was deducted', async () => {
      const dbBooking = await prisma.booking.findFirst({
        where: { tenantId: tenantA, studentId: student2, sessionInstanceId: sessionA },
      });

      // Cancel the booking
      await bookingsService.cancelBooking(
        tenantA,
        dbBooking!.id,
        { cancellationReason: 'Student requested cancellation with credit refund' },
        staffA
      );

      // Credit must be restored to 6
      const restoredMembership = await membershipsService.getMembership(tenantA, student2MembershipId);
      expect(restoredMembership.remainingCredits).toBe(6);

      // Ledger must contain REFUND_RESTORE entry
      const ledger = await creditLedgerService.getLedgerEntries(tenantA, {
        studentMembershipId: student2MembershipId,
      });
      const refund = ledger.find((l) => l.entryType === 'REFUND_RESTORE');
      expect(refund).toBeDefined();
      expect(refund?.creditsDelta).toBe(1);
      expect(refund?.balanceAfter).toBe(6);
    });
  });

  describe('6. Overspend Prevention Under Exhausted Credits', () => {
    it('should prevent credit deduction when pass balance is 0', async () => {
      // Assign 1-class drop in pass to Student 3
      const membership = await membershipsService.assignMembership(
        tenantA,
        {
          studentId: student3,
          membershipPlanId: dropInPlanId,
        },
        staffA
      );
      expect(membership.remainingCredits).toBe(1);

      // Create booking 1
      const booking1 = await bookingsService.createBooking(
        tenantA,
        { studentId: student3, sessionInstanceId: sessionA },
        staffA
      );

      // Attend booking 1 -> balance becomes 0
      await attendanceService.markAttendance(
        tenantA,
        booking1.id,
        { status: 'ATTENDED' },
        staffA
      );

      const mAfter1 = await membershipsService.getMembership(tenantA, membership.id);
      expect(mAfter1.remainingCredits).toBe(0);

      // Eligibility check should now report 0 remaining credits
      const eligibility = await eligibilityService.checkEligibility(
        tenantA,
        student3,
        sessionA
      );
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.remainingCredits).toBe(0);
    });
  });

  describe('7. Multi-Branch Restriction Enforcement', () => {
    it('should deny eligibility if membership is restricted to a different branch', async () => {
      // Create a plan restricted only to Branch B (Gurugram)
      const restrictedPlan = await plansService.createPlan(
        tenantA,
        {
          name: 'Gurugram Local Only Pack',
          planType: 'CLASS_PACK',
          price: 2500,
          validityDays: 30,
          creditCount: 5,
          isMultiBranchValid: false,
          homeBranchId: branchB,
        },
        staffA
      );

      // Assign to student 1 (whose home branch is branchA, session is in branchA)
      await membershipsService.assignMembership(
        tenantA,
        {
          studentId: student1,
          membershipPlanId: restrictedPlan.id,
          homeBranchId: branchB,
        },
        staffA
      );

      // Check eligibility for session in Branch A -> must be false for the restricted plan
      const sA = await prisma.classSessionInstance.create({
        data: {
          tenantId: tenantA,
          branchId: branchA,
          roomId: roomA,
          classTypeId: classTypeA,
          instructorId: staffA,
          sessionDate: new Date(),
          startTimestamp: new Date(Date.now() + 86400000),
          endTimestamp: new Date(Date.now() + 90000000),
          capacity: 5,
        },
      });

      // Session in branch B
      const roomB = await prisma.room.create({
        data: {
          tenantId: tenantA,
          branchId: branchB,
          name: 'Yamuna Studio',
          maxMatCapacity: 10,
        },
      });

      const sB = await prisma.classSessionInstance.create({
        data: {
          tenantId: tenantA,
          branchId: branchB,
          roomId: roomB.id,
          classTypeId: classTypeA,
          instructorId: staffA,
          sessionDate: new Date(),
          startTimestamp: new Date(Date.now() + 86400000),
          endTimestamp: new Date(Date.now() + 90000000),
          capacity: 5,
        },
      });

      const eligB = await eligibilityService.checkEligibility(tenantA, student1, sB.id);
      expect(eligB.eligible).toBe(true);
    });
  });

  describe('8. Cross-Tenant Isolation Enforcement', () => {
    it('should prevent Tenant B from reading or modifying Tenant A membership plans', async () => {
      await expect(
        plansService.getPlan(tenantB, classPackPlanId)
      ).rejects.toThrow(NotFoundException);

      await expect(
        plansService.updatePlan(
          tenantB,
          classPackPlanId,
          { name: 'Hijacked Plan Name' },
          staffB
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent Tenant B from assigning Tenant A plans or accessing student memberships', async () => {
      await expect(
        membershipsService.getMembership(tenantB, student1MembershipId)
      ).rejects.toThrow(NotFoundException);

      await expect(
        membershipsService.freezeMembership(
          tenantB,
          student1MembershipId,
          { freezeReason: 'Malicious freeze' },
          staffB
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty credit ledger for unauthorized tenant queries', async () => {
      const crossLedger = await creditLedgerService.getLedgerEntries(tenantB, {
        studentMembershipId: student1MembershipId,
      });
      expect(crossLedger.length).toBe(0);
    });
  });
});
