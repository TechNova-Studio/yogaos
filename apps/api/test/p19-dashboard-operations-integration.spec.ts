import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'node:crypto';
import {
  prisma,
  UserRole,
  MemberStatus,
  BookingStatus,
  PaymentMode,
  PaymentStatus,
  InvoiceStatus,
  ReminderType,
  NotificationChannel,
  NotificationDeliveryStatus,
  ConductorSessionStatus,
  ConductorStepPhase,
  ExecutionMode,
  PaymentGatewayProvider,
  PlanType,
  SequenceLevel,
  SequenceStatus,
} from '@yogaos/database';
import { DashboardService } from '../src/modules/dashboard/dashboard.service.js';
import { RemindersService } from '../src/modules/billing/reminders.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator.js';

describe('P19 Real Database Integration Tests (Operational Dashboard & Notifications Hub)', () => {
  let auditService: AuditService;
  let dashboardService: DashboardService;
  let remindersService: RemindersService;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  let tenantA: string;
  let tenantB: string;
  let branchA1: string;
  let branchA2: string;
  let roomA1: string;
  let roomA2: string;

  let ownerUserA: AuthenticatedUser;
  let managerUserA: AuthenticatedUser;
  let instructorUserA1: AuthenticatedUser;
  let instructorUserA2: AuthenticatedUser;
  let receptionistUserA: AuthenticatedUser;
  let ownerUserB: AuthenticatedUser;

  let classTypeA: string;
  let studentA1: string;
  let studentA2: string;
  let failedReminderId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    dashboardService = new DashboardService();
    remindersService = new RemindersService(auditService);

    // 1. Create Tenant A & Tenant B
    const orgA = await prisma.organization.create({
      data: {
        name: `P19 Veda Studio ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p19-veda-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    const orgB = await prisma.organization.create({
      data: {
        name: `P19 Sattva Shala ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p19-sattva-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 2. Create Users for Tenant A
    const makeUser = async (role: UserRole, prefix: string, tenantId: string) => {
      const u = await prisma.user.create({
        data: {
          email: `${prefix}-${crypto.randomUUID().slice(0, 8)}@test.yogaos`,
          fullName: `${prefix} User`,
        },
      });
      createdUserIds.push(u.id);

      await prisma.organizationMember.create({
        data: {
          tenantId,
          userId: u.id,
          role,
          status: MemberStatus.ACTIVE,
        },
      });

      const authUser: AuthenticatedUser = {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        activeTenantId: tenantId,
        activeRole: role,
        sessionId: crypto.randomUUID(),
      };
      return authUser;
    };

    ownerUserA = await makeUser(UserRole.OWNER, 'OwnerA', tenantA);
    managerUserA = await makeUser(UserRole.MANAGER, 'ManagerA', tenantA);
    instructorUserA1 = await makeUser(UserRole.INSTRUCTOR, 'InstructorA1', tenantA);
    instructorUserA2 = await makeUser(UserRole.INSTRUCTOR, 'InstructorA2', tenantA);
    receptionistUserA = await makeUser(UserRole.RECEPTIONIST, 'ReceptionistA', tenantA);
    ownerUserB = await makeUser(UserRole.OWNER, 'OwnerB', tenantB);

    // 3. Branches & Rooms for Tenant A
    const b1 = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Koramangala Branch',
        slug: `koramangala-${crypto.randomUUID().slice(0, 6)}`,
        streetAddress: '80 Feet Road, 4th Block',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560034',
        phone: '+919876500001',
        email: 'koramangala@veda.yoga',
      },
    });
    branchA1 = b1.id;

    const b2 = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Indiranagar Branch',
        slug: `indiranagar-${crypto.randomUUID().slice(0, 6)}`,
        streetAddress: '100 Feet Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560038',
        phone: '+919876500002',
        email: 'indiranagar@veda.yoga',
      },
    });
    branchA2 = b2.id;

    const r1 = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA1,
        name: 'Ganga Shala',
        maxMatCapacity: 20,
      },
    });
    roomA1 = r1.id;

    const r2 = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA2,
        name: 'Yamuna Shala',
        maxMatCapacity: 15,
      },
    });
    roomA2 = r2.id;

    // 4. Class Type & Students
    const ct = await prisma.classType.create({
      data: {
        tenantId: tenantA,
        name: 'Morning Hatha Flow',
        defaultCapacity: 20,
        defaultDurationMins: 60,
      },
    });
    classTypeA = ct.id;

    const s1 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA1,
        fullName: 'Aarav Sharma',
        email: 'aarav@example.com',
        mobilePhone: '+919876543210',
        emergencyContactName: 'Priya Sharma',
        emergencyContactPhone: '+919876543290',
        emergencyContactRelation: 'Spouse',
      },
    });
    studentA1 = s1.id;

    const s2 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA1,
        fullName: 'Diya Patel',
        email: 'diya@example.com',
        mobilePhone: '+919876543211',
        emergencyContactName: 'Raj Patel',
        emergencyContactPhone: '+919876543291',
        emergencyContactRelation: 'Brother',
      },
    });
    studentA2 = s2.id;

    // 5. Today's Sessions for Tenant A
    const now = new Date();
    const sessionStart1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const sessionEnd1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);

    const sessionStart2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
    const sessionEnd2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);

    // Session 1: branchA1, instructorA1
    const sess1 = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA1,
        roomId: roomA1,
        classTypeId: classTypeA,
        instructorId: instructorUserA1.id,
        sessionDate: sessionStart1,
        startTimestamp: sessionStart1,
        endTimestamp: sessionEnd1,
        capacity: 20,
      },
    });

    // Session 2: branchA2, instructorA2
    const sess2 = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA2,
        roomId: roomA2,
        classTypeId: classTypeA,
        instructorId: instructorUserA2.id,
        sessionDate: sessionStart2,
        startTimestamp: sessionStart2,
        endTimestamp: sessionEnd2,
        capacity: 15,
      },
    });

    // 6. Bookings & Attendance for Session 1
    // s1 attended
    await prisma.booking.create({
      data: {
        tenantId: tenantA,
        sessionInstanceId: sess1.id,
        studentId: studentA1,
        status: BookingStatus.ATTENDED,
      },
    });

    // s2 no-show
    await prisma.booking.create({
      data: {
        tenantId: tenantA,
        sessionInstanceId: sess1.id,
        studentId: studentA2,
        status: BookingStatus.NO_SHOW,
      },
    });

    // 7. Active Membership & Expiring Membership
    const plan = await prisma.membershipPlan.create({
      data: {
        tenantId: tenantA,
        name: 'Unlimited Monthly Flow',
        planType: PlanType.TIME_UNLIMITED,
        validityDays: 30,
        price: 3500,
      },
    });

    // Expiring in 2 days
    const expDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    await prisma.studentMembership.create({
      data: {
        tenantId: tenantA,
        studentId: studentA1,
        membershipPlanId: plan.id,
        planNameSnapshot: plan.name,
        planTypeSnapshot: plan.planType,
        priceSnapshot: plan.price,
        startDate: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
        expiryDate: expDate,
        status: 'ACTIVE',
      },
    });

    // 8. Financials: Payments & Invoices
    await prisma.paymentTransaction.create({
      data: {
        tenantId: tenantA,
        branchId: branchA1,
        studentId: studentA1,
        amount: 3500.0,
        currency: 'INR',
        paymentMode: PaymentMode.UPI,
        status: PaymentStatus.COMPLETED,
        paidAt: now,
      },
    });

    // Overdue invoice
    await prisma.taxInvoice.create({
      data: {
        tenantId: tenantA,
        branchId: branchA1,
        studentId: studentA2,
        invoiceNumber: `INV-${crypto.randomUUID().slice(0, 6)}`,
        fiscalYear: '2026-2027',
        sequenceNumber: 1,
        status: InvoiceStatus.ISSUED,
        issueDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
        subtotal: 5000,
        taxableAmount: 5000,
        totalTax: 900,
        totalAmount: 5900,
        amountPaid: 0,
        balanceDue: 5900,
        supplierLegalName: 'Veda Studio Pvt Ltd',
        supplierStateCode: '29',
        customerName: 'Diya Patel',
        customerStateCode: '29',
      },
    });

    // 9. Lead Pipeline
    await prisma.lead.create({
      data: {
        tenantId: tenantA,
        fullName: 'Kavita Roy',
        phone: '+919876543299',
        status: 'NEW',
      },
    });
    await prisma.lead.create({
      data: {
        tenantId: tenantA,
        fullName: 'Rohan Mehra',
        phone: '+919876543298',
        status: 'CONVERTED',
      },
    });

    // 10. Conductor Session on Session 1
    // Need a dummy sequence version
    const asana = await prisma.asana.create({
      data: {
        tenantId: tenantA,
        sanskritName: 'Tadasana',
        englishName: 'Mountain Pose',
        category: 'STANDING',
        difficulty: 'BEGINNER',
        status: 'PUBLISHED',
      },
    });

    const seq = await prisma.sequence.create({
      data: {
        tenantId: tenantA,
        creatorUserId: instructorUserA1.id,
        title: 'Morning Awakening',
        targetLevel: SequenceLevel.ALL_LEVELS,
        status: SequenceStatus.PUBLISHED,
        activeVersion: 1,
        estimatedTotalDurationSecs: 300,
        versions: {
          create: {
            tenantId: tenantA,
            versionNumber: 1,
            status: SequenceStatus.PUBLISHED,
            totalEstimatedDurationSecs: 300,
            publishedAt: new Date(),
          },
        },
      },
      include: {
        versions: true,
      },
    });

    const seqVer = seq.versions[0];

    await prisma.conductorSession.create({
      data: {
        tenantId: tenantA,
        sessionInstanceId: sess1.id,
        sequenceVersionId: seqVer.id,
        conductorInstructorId: instructorUserA1.id,
        status: ConductorSessionStatus.READY,
        clientSessionUuid: crypto.randomUUID(),
        isOfflineReady: true,
      },
    });

    // 11. Payment Gateway Config: Test Mode
    await prisma.paymentGatewayConfig.create({
      data: {
        tenantId: tenantA,
        provider: PaymentGatewayProvider.RAZORPAY,
        isEnabled: true,
        isTestMode: true,
        apiKey: 'rzp_test_mockKey123',
        apiSecret: 'mockSecret456',
      },
    });

    // 12. Billing Reminder with FAILED status
    const failedReminder = await prisma.billingReminder.create({
      data: {
        tenantId: tenantA,
        studentId: studentA1,
        reminderType: ReminderType.EXPIRY_APPROACHING,
        channel: NotificationChannel.SMS,
        recipient: '+919876543210',
        messageBody: 'Your membership expires soon.',
        status: NotificationDeliveryStatus.FAILED,
        failureReason: 'Simulated SMS gateway timeout',
        metadata: { retryCount: 0 },
      },
    });
    failedReminderId = failedReminder.id;
  });

  afterAll(async () => {
    // Teardown created organizations (cascades all child entities)
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

  it('aggregates live operations metrics across sessions, attendance, memberships, and leads', async () => {
    const data = await dashboardService.getOperationsData(tenantA, {}, ownerUserA);

    expect(data.tenantId).toBe(tenantA);
    expect(data.todaySessions.length).toBe(2);
    expect(data.attendanceSummary.totalScheduledToday).toBe(2);
    expect(data.attendanceSummary.totalBooked).toBe(2);
    expect(data.attendanceSummary.totalAttended).toBe(1);
    expect(data.attendanceSummary.totalNoShow).toBe(1);
    expect(data.attendanceSummary.attendanceRatePercentage).toBe(50); // 1 / 2 = 50%

    // Capacity Utilization: (20 + 15) = 35 total capacity, 2 booked = ~6%
    expect(data.capacityUtilization.totalCapacity).toBe(35);
    expect(data.capacityUtilization.totalBooked).toBe(2);

    // Membership Alerts
    expect(data.membershipAlerts.activeCount).toBe(1);
    expect(data.membershipAlerts.expiringIn3DaysCount).toBe(1);
    expect(data.membershipAlerts.expiringIn7DaysCount).toBe(1);
    expect(data.membershipAlerts.recentExpiring.length).toBe(1);

    // Leads
    expect(data.leadPipeline.totalLeads).toBe(2);
    expect(data.leadPipeline.newLeads).toBe(1);
    expect(data.leadPipeline.convertedLeads).toBe(1);
    expect(data.leadPipeline.conversionRatePercentage).toBe(50);

    // Conductor
    expect(data.conductorSummary.unfinishedSessionsCount).toBe(1);
    expect(data.conductorSummary.offlineReadySessionsCount).toBe(1);
  });

  it('applies branch filtering accurately to scope sessions and room capacity', async () => {
    const dataBranch1 = await dashboardService.getOperationsData(
      tenantA,
      { branchId: branchA1 },
      ownerUserA
    );

    expect(dataBranch1.todaySessions.length).toBe(1);
    expect(dataBranch1.todaySessions[0].branchId).toBe(branchA1);
    expect(dataBranch1.capacityUtilization.totalCapacity).toBe(20);
    expect(dataBranch1.attendanceSummary.totalAttended).toBe(1);

    const dataBranch2 = await dashboardService.getOperationsData(
      tenantA,
      { branchId: branchA2 },
      ownerUserA
    );
    expect(dataBranch2.todaySessions.length).toBe(1);
    expect(dataBranch2.todaySessions[0].branchId).toBe(branchA2);
    expect(dataBranch2.capacityUtilization.totalCapacity).toBe(15);
  });

  it('applies date filtering to isolate sessions within requested date boundaries', async () => {
    // Tomorrow date range
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const dataTomorrow = await dashboardService.getOperationsData(
      tenantA,
      {
        startDate: `${dateStr}T00:00:00.000Z`,
        endDate: `${dateStr}T23:59:59.999Z`,
      },
      ownerUserA
    );

    expect(dataTomorrow.todaySessions.length).toBe(0);
    expect(dataTomorrow.attendanceSummary.totalScheduledToday).toBe(0);
  });

  it('enforces multi-tenant isolation: Tenant B sees zero data from Tenant A', async () => {
    const dataB = await dashboardService.getOperationsData(tenantB, {}, ownerUserB);

    expect(dataB.tenantId).toBe(tenantB);
    expect(dataB.todaySessions.length).toBe(0);
    expect(dataB.attendanceSummary.totalBooked).toBe(0);
    expect(dataB.membershipAlerts.activeCount).toBe(0);
    expect(dataB.leadPipeline.totalLeads).toBe(0);
    expect(dataB.conductorSummary.unfinishedSessionsCount).toBe(0);
    expect(dataB.financialSummary?.totalCollectedToday).toBe(0);
    expect(dataB.financialSummary?.totalOverdueAmount).toBe(0);
  });

  it('enforces role-based operational privacy: RECEPTIONIST cannot access financial metrics', async () => {
    const dataReceptionist = await dashboardService.getOperationsData(
      tenantA,
      {},
      receptionistUserA
    );

    // Receptionist sees schedules and rosters
    expect(dataReceptionist.todaySessions.length).toBe(2);
    expect(dataReceptionist.attendanceSummary.totalBooked).toBe(2);

    // Financial analytics strictly stripped/nullified
    expect(dataReceptionist.financialSummary).toBeNull();
  });

  it('enforces role-based operational scoping: INSTRUCTOR sees only their assigned sessions and no financials', async () => {
    const dataInstructor1 = await dashboardService.getOperationsData(
      tenantA,
      {},
      instructorUserA1
    );

    // Instructor 1 sees only Session 1 (where instructorId = instructorUserA1.id)
    expect(dataInstructor1.todaySessions.length).toBe(1);
    expect(dataInstructor1.todaySessions[0].instructorId).toBe(instructorUserA1.id);
    expect(dataInstructor1.financialSummary).toBeNull();
  });

  it('allows OWNER and MANAGER full financial visibility into collections and overdue invoices', async () => {
    const dataOwner = await dashboardService.getOperationsData(tenantA, {}, ownerUserA);
    expect(dataOwner.financialSummary).not.toBeNull();
    expect(dataOwner.financialSummary?.totalCollectedToday).toBe(3500);
    expect(dataOwner.financialSummary?.totalOverdueAmount).toBe(5900);
    expect(dataOwner.financialSummary?.overdueInvoicesCount).toBe(1);

    const dataManager = await dashboardService.getOperationsData(tenantA, {}, managerUserA);
    expect(dataManager.financialSummary).not.toBeNull();
    expect(dataManager.financialSummary?.totalCollectedToday).toBe(3500);
  });

  it('accurately verifies gateway readiness without claiming LIVE status without production credentials', async () => {
    const data = await dashboardService.getOperationsData(tenantA, {}, ownerUserA);
    const razorpay = data.integrations.gateways.find((g) => g.provider === 'RAZORPAY');
    const stripe = data.integrations.gateways.find((g) => g.provider === 'STRIPE');

    expect(razorpay).toBeDefined();
    expect(razorpay?.status).toBe('SANDBOX_CONFIGURED');
    expect(razorpay?.isEnabled).toBe(true);

    expect(stripe).toBeDefined();
    expect(stripe?.status).toBe('UNCONFIGURED');
    expect(stripe?.isEnabled).toBe(false);
  });

  it('supports notification retry workflow, updating delivery status, retry count and audit trail', async () => {
    const retried = await remindersService.retryReminder(
      tenantA,
      failedReminderId,
      ownerUserA.id
    );

    expect(retried.status).toBe(NotificationDeliveryStatus.DELIVERED);
    const meta = retried.metadata as Record<string, any>;
    expect(meta.retryCount).toBe(1);
    expect(meta.retriedBy).toBe(ownerUserA.id);

    // Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: tenantA,
        action: 'BILLING_REMINDER_RETRIED',
        resourceId: failedReminderId,
      },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);

    // Check dashboard reflection
    const data = await dashboardService.getOperationsData(tenantA, {}, ownerUserA);
    expect(data.integrations.notifications.failedCount).toBe(0);
    expect(data.integrations.notifications.deliveredCount).toBeGreaterThanOrEqual(1);
  });
});
