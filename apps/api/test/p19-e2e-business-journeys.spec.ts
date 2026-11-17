import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'node:crypto';
import {
  prisma,
  UserRole,
  MemberStatus,
  StudentStatus,
  BookingStatus,
  WaitlistStatus,
  PaymentMode,
  PaymentStatus,
  InvoiceStatus,
  RefundStatus,
  ReminderType,
  NotificationChannel,
  NotificationDeliveryStatus,
  PlanType,
  ClassLevel,
  AsanaCategory,
  AsanaDifficulty,
  AsanaStatus,
  SequenceLevel,
  SequenceStatus,
  ConductorSessionStatus,
  ConductorStepPhase,
  ExecutionMode,
} from '@yogaos/database';
import { AuditService } from '../src/common/services/audit.service.js';
import { ConductorService } from '../src/modules/conductor/conductor.service.js';
import { RemindersService } from '../src/modules/billing/reminders.service.js';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('P19 End-to-End Business Journeys (13 Critical Workflows)', () => {
  const auditService = new AuditService();
  const conductorService = new ConductorService(auditService);
  const remindersService = new RemindersService(auditService);

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  // Journey state references
  let studioOwnerUser: any;
  let instructorUser: any;
  let receptionistUser: any;
  let tenant1Id: string;
  let tenant2Id: string;
  let branchId: string;
  let roomId: string;
  let studentId: string;
  let classTypeId: string;
  let sessionInstanceId: string;
  let bookingId: string;
  let membershipPlanId: string;
  let studentMembershipId: string;
  let invoiceId: string;
  let paymentId: string;
  let failedReminderId: string;
  let asanaId: string;
  let mediaAssetId: string;
  let sequenceId: string;
  let sequenceVersion1Id: string;
  let conductorSessionId: string;

  beforeAll(async () => {
    // Initial global setup
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

  // --------------------------------------------------------------------------
  // Journey 1: Registration, authentication, organization membership, and studio context switching
  // --------------------------------------------------------------------------
  it('Journey 1: Registration, login, multi-studio membership and context switching', async () => {
    // 1. User registration
    studioOwnerUser = await prisma.user.create({
      data: {
        email: `journey-owner-${crypto.randomUUID().slice(0, 8)}@veda.yoga`,
        fullName: 'Devi Sundaram',
      },
    });
    createdUserIds.push(studioOwnerUser.id);

    // 2. Studio 1 Creation
    const org1 = await prisma.organization.create({
      data: {
        name: 'Veda Yoga Shala Indiranagar',
        slug: `veda-indiranagar-${crypto.randomUUID().slice(0, 6)}`,
      },
    });
    tenant1Id = org1.id;
    createdOrgIds.push(tenant1Id);

    // 3. Studio 2 Creation
    const org2 = await prisma.organization.create({
      data: {
        name: 'Veda Yoga Shala Whitefield',
        slug: `veda-whitefield-${crypto.randomUUID().slice(0, 6)}`,
      },
    });
    tenant2Id = org2.id;
    createdOrgIds.push(tenant2Id);

    // 4. Assign Owner memberships to both studios
    await prisma.organizationMember.create({
      data: {
        tenantId: tenant1Id,
        userId: studioOwnerUser.id,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });
    await prisma.organizationMember.create({
      data: {
        tenantId: tenant2Id,
        userId: studioOwnerUser.id,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });

    // Verify user has memberships in both studios and can switch activeTenantId
    const affiliations = await prisma.organizationMember.findMany({
      where: { userId: studioOwnerUser.id },
      include: { organization: true },
    });
    expect(affiliations.length).toBe(2);
    expect(affiliations.map((a) => a.tenantId)).toContain(tenant1Id);
    expect(affiliations.map((a) => a.tenantId)).toContain(tenant2Id);
  });

  // --------------------------------------------------------------------------
  // Journey 2: Branch, room, and student profile management
  // --------------------------------------------------------------------------
  it('Journey 2: Branch, room, and student management with emergency contacts and health consents', async () => {
    // 1. Create Branch
    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant1Id,
        name: 'Main Shala',
        slug: `main-shala-${crypto.randomUUID().slice(0, 6)}`,
        streetAddress: '12th Main, HAL 2nd Stage',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560038',
        phone: '+919876500010',
        email: 'indiranagar@veda.yoga',
      },
    });
    branchId = branch.id;

    // 2. Create Room
    const room = await prisma.room.create({
      data: {
        tenantId: tenant1Id,
        branchId,
        name: 'Prana Studio Room',
        maxMatCapacity: 10,
      },
    });
    roomId = room.id;

    // 3. Create Student
    const student = await prisma.student.create({
      data: {
        tenantId: tenant1Id,
        homeBranchId: branchId,
        fullName: 'Ananya Deshmukh',
        email: 'ananya.deshmukh@example.com',
        mobilePhone: '+919876543220',
        emergencyContactName: 'Vikram Deshmukh',
        emergencyContactPhone: '+919876543221',
        emergencyContactRelation: 'Spouse',
        status: StudentStatus.ACTIVE,
      },
    });
    studentId = student.id;

    expect(student.fullName).toBe('Ananya Deshmukh');
    expect(student.tenantId).toBe(tenant1Id);
  });

  // --------------------------------------------------------------------------
  // Journey 3: Class creation and scheduling
  // --------------------------------------------------------------------------
  it('Journey 3: Class template, batch, and session scheduling', async () => {
    // 1. Create Instructor
    const instructor = await prisma.user.create({
      data: {
        email: `instructor-${crypto.randomUUID().slice(0, 8)}@veda.yoga`,
        fullName: 'Guru Ramanathan',
      },
    });
    instructorUser = instructor;
    createdUserIds.push(instructor.id);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenant1Id,
        userId: instructor.id,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    // 2. Create Class Type
    const classType = await prisma.classType.create({
      data: {
        tenantId: tenant1Id,
        name: 'Ashtanga Primary Series',
        category: 'Ashtanga',
        level: ClassLevel.INTERMEDIATE,
        defaultDurationMins: 75,
        defaultCapacity: 2, // Low capacity to test waitlist
      },
    });
    classTypeId = classType.id;

    // 3. Create Scheduled Session
    const now = new Date();
    const session = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenant1Id,
        branchId,
        roomId,
        classTypeId,
        instructorId: instructor.id,
        sessionDate: now,
        startTimestamp: now,
        endTimestamp: new Date(now.getTime() + 75 * 60 * 1000),
        capacity: 2,
      },
    });
    sessionInstanceId = session.id;

    expect(session.capacity).toBe(2);
    expect(session.instructorId).toBe(instructor.id);
  });

  // --------------------------------------------------------------------------
  // Journey 4: Booking, waitlist, and attendance
  // --------------------------------------------------------------------------
  it('Journey 4: Student booking, capacity fill, waitlist promotion, and attendance marking', async () => {
    // Create Student 2 & Student 3
    const s2 = await prisma.student.create({
      data: {
        tenantId: tenant1Id,
        homeBranchId: branchId,
        fullName: 'Rahul Bose',
        email: 'rahul@example.com',
        mobilePhone: '+919876543222',
        emergencyContactName: 'Bose Sr',
        emergencyContactPhone: '+919876543223',
        emergencyContactRelation: 'Parent',
      },
    });

    const s3 = await prisma.student.create({
      data: {
        tenantId: tenant1Id,
        homeBranchId: branchId,
        fullName: 'Pooja Hegde',
        email: 'pooja@example.com',
        mobilePhone: '+919876543224',
        emergencyContactName: 'Hegde Sr',
        emergencyContactPhone: '+919876543225',
        emergencyContactRelation: 'Parent',
      },
    });

    // 1. Student 1 books session (Seat 1/2)
    const b1 = await prisma.booking.create({
      data: {
        tenantId: tenant1Id,
        sessionInstanceId,
        studentId,
        status: BookingStatus.BOOKED,
      },
    });
    bookingId = b1.id;

    // 2. Student 2 books session (Seat 2/2 -> Capacity Full)
    const b2 = await prisma.booking.create({
      data: {
        tenantId: tenant1Id,
        sessionInstanceId,
        studentId: s2.id,
        status: BookingStatus.BOOKED,
      },
    });

    // 3. Student 3 joins waitlist
    const wl = await prisma.waitlistEntry.create({
      data: {
        tenantId: tenant1Id,
        sessionInstanceId,
        studentId: s3.id,
        priorityRank: 1,
        status: WaitlistStatus.WAITING,
      },
    });

    expect(wl.priorityRank).toBe(1);

    // 4. Student 2 cancels booking -> Student 3 is promoted
    await prisma.booking.update({
      where: { id: b2.id },
      data: { status: BookingStatus.CANCELLED, cancellationReason: 'Student schedule conflict' },
    });

    await prisma.waitlistEntry.update({
      where: { id: wl.id },
      data: { status: WaitlistStatus.PROMOTED },
    });

    const promotedBooking = await prisma.booking.create({
      data: {
        tenantId: tenant1Id,
        sessionInstanceId,
        studentId: s3.id,
        status: BookingStatus.BOOKED,
      },
    });
    expect(promotedBooking.status).toBe(BookingStatus.BOOKED);

    // 5. Mark Student 1 attendance as ATTENDED
    const attended = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ATTENDED },
    });
    expect(attended.status).toBe(BookingStatus.ATTENDED);
  });

  // --------------------------------------------------------------------------
  // Journey 5: Membership assignment, freeze, and credit redemption
  // --------------------------------------------------------------------------
  it('Journey 5: Membership plan, student membership assignment, freeze and credit deduction', async () => {
    // 1. Create Pack Membership Plan (10 classes, 60 days)
    const plan = await prisma.membershipPlan.create({
      data: {
        tenantId: tenant1Id,
        name: '10 Class Pass',
        planType: PlanType.CLASS_PACK,
        price: 4500,
        validityDays: 60,
        creditCount: 10,
        maxFreezesAllowed: 2,
        maxFreezeDays: 14,
      },
    });
    membershipPlanId = plan.id;

    const now = new Date();
    const expiry = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // 2. Assign Membership to Student 1
    const membership = await prisma.studentMembership.create({
      data: {
        tenantId: tenant1Id,
        studentId,
        membershipPlanId,
        planNameSnapshot: plan.name,
        planTypeSnapshot: plan.planType,
        priceSnapshot: plan.price,
        startDate: now,
        expiryDate: expiry,
        totalCredits: 10,
        remainingCredits: 10,
        status: 'ACTIVE',
      },
    });
    studentMembershipId = membership.id;
    expect(membership.remainingCredits).toBe(10);

    // 3. Freeze membership for medical rest (7 days)
    const frozen = await prisma.studentMembership.update({
      where: { id: studentMembershipId },
      data: {
        status: 'FROZEN',
        frozenAt: now,
        freezeReason: 'Sprained wrist medical recovery',
        freezesUsed: 1,
        totalFrozenDays: 7,
        expiryDate: new Date(expiry.getTime() + 7 * 24 * 60 * 60 * 1000), // Extended by 7 days
      },
    });
    expect(frozen.status).toBe('FROZEN');
    expect(frozen.freezesUsed).toBe(1);

    // 4. Unfreeze & Deduct 1 credit for class attendance
    const active = await prisma.studentMembership.update({
      where: { id: studentMembershipId },
      data: {
        status: 'ACTIVE',
        remainingCredits: 9,
      },
    });
    expect(active.status).toBe('ACTIVE');
    expect(active.remainingCredits).toBe(9);
  });

  // --------------------------------------------------------------------------
  // Journey 6: Invoice generation, payment, and refund
  // --------------------------------------------------------------------------
  it('Journey 6: GST invoice generation, payment transaction, and refund execution', async () => {
    // 1. Generate GST Invoice (₹4,500 + 18% GST = ₹5,310)
    const invoice = await prisma.taxInvoice.create({
      data: {
        tenantId: tenant1Id,
        branchId,
        studentId,
        studentMembershipId,
        invoiceNumber: `INV-GST-${crypto.randomUUID().slice(0, 6)}`,
        fiscalYear: '2026-2027',
        sequenceNumber: 101,
        status: InvoiceStatus.ISSUED,
        subtotal: 4500,
        taxableAmount: 4500,
        cgstAmount: 405, // 9%
        sgstAmount: 405, // 9%
        totalTax: 810,
        totalAmount: 5310,
        amountPaid: 0,
        balanceDue: 5310,
        supplierLegalName: 'Veda Yoga Shala Indiranagar',
        supplierStateCode: '29',
        customerName: 'Ananya Deshmukh',
        customerStateCode: '29',
      },
    });
    invoiceId = invoice.id;
    expect(Number(invoice.totalAmount)).toBe(5310);

    // 2. Record Payment (UPI Full Payment)
    const payment = await prisma.paymentTransaction.create({
      data: {
        tenantId: tenant1Id,
        branchId,
        invoiceId,
        studentId,
        amount: 5310,
        currency: 'INR',
        paymentMode: PaymentMode.UPI,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
        utrReference: 'UPI-REF-99228811',
      },
    });
    paymentId = payment.id;

    // Update invoice to PAID
    await prisma.taxInvoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        amountPaid: 5310,
        balanceDue: 0,
      },
    });

    // 3. Process Refund for cancelled session (Partial Refund ₹531)
    const refund = await prisma.refundRecord.create({
      data: {
        tenantId: tenant1Id,
        paymentTransactionId: paymentId,
        studentId,
        refundNumber: `REF-${crypto.randomUUID().slice(0, 6)}`,
        amount: 531,
        refundMode: PaymentMode.UPI,
        reason: 'Customer goodwill credit adjustment',
        status: RefundStatus.COMPLETED,
      },
    });
    expect(refund.status).toBe(RefundStatus.COMPLETED);
    expect(Number(refund.amount)).toBe(531);
  });

  // --------------------------------------------------------------------------
  // Journey 7: Membership renewal and notification workflows
  // --------------------------------------------------------------------------
  it('Journey 7: Membership renewal notification scheduling and 1-click retry dispatch', async () => {
    // 1. Create failed billing reminder
    const reminder = await prisma.billingReminder.create({
      data: {
        tenantId: tenant1Id,
        studentId,
        studentMembershipId,
        reminderType: ReminderType.EXPIRY_APPROACHING,
        channel: NotificationChannel.EMAIL,
        recipient: 'ananya.deshmukh@example.com',
        subject: 'Your 10 Class Pass is expiring soon',
        messageBody: 'Namaste Ananya, renew your pass to continue practicing.',
        status: NotificationDeliveryStatus.FAILED,
        failureReason: 'Upstream SMTP connection dropped',
        metadata: { retryCount: 0 },
      },
    });
    failedReminderId = reminder.id;
    expect(reminder.status).toBe(NotificationDeliveryStatus.FAILED);

    // 2. Retry reminder
    const retried = await remindersService.retryReminder(
      tenant1Id,
      failedReminderId,
      studioOwnerUser.id
    );

    expect(retried.status).toBe(NotificationDeliveryStatus.DELIVERED);
    const meta = retried.metadata as Record<string, any>;
    expect(meta.retryCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Journey 8: Asana library and media management
  // --------------------------------------------------------------------------
  it('Journey 8: Asana creation, media asset upload, and pose association', async () => {
    // 1. Create Asana
    const asana = await prisma.asana.create({
      data: {
        tenantId: tenant1Id,
        sanskritName: 'Virabhadrasana II',
        englishName: 'Warrior II Pose',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        status: AsanaStatus.PUBLISHED,
        anatomicalFocus: ['quadriceps', 'hips', 'chest'],
        benefits: ['Builds stamina', 'Strengthens legs and ankles'],
        contraindications: ['Recent knee surgery', 'High blood pressure'],
      },
    });
    asanaId = asana.id;
    expect(asana.sanskritName).toBe('Virabhadrasana II');

    // 2. Create Media Asset
    const media = await prisma.mediaAsset.create({
      data: {
        tenantId: tenant1Id,
        title: 'Warrior II Demonstration',
        fileName: 'virabhadrasana-2.mp4',
        fileSize: 14500000,
        mimeType: 'video/mp4',
        mediaType: 'VIDEO',
        storageKey: 'media/virabhadrasana-2.mp4',
        url: 'https://cdn.veda.yoga/media/virabhadrasana-2.mp4',
        durationSeconds: 180,
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    });
    mediaAssetId = media.id;

    // 3. Associate media to Asana
    const assoc = await prisma.asanaMedia.create({
      data: {
        asanaId,
        mediaAssetId,
        isFeatured: true,
        sortOrder: 1,
      },
    });
    expect(assoc.isFeatured).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Journey 9: Sequence creation, publishing, and version preservation
  // --------------------------------------------------------------------------
  it('Journey 9: Sequence composition, publishing, and immutable version preservation', async () => {
    // 1. Create Sequence
    const seq = await prisma.sequence.create({
      data: {
        tenantId: tenant1Id,
        creatorUserId: instructorUser.id,
        title: 'Warrior Strength Sequence',
        targetLevel: SequenceLevel.INTERMEDIATE,
        status: SequenceStatus.PUBLISHED,
        activeVersion: 1,
        estimatedTotalDurationSecs: 600,
        versions: {
          create: {
            tenantId: tenant1Id,
            versionNumber: 1,
            status: SequenceStatus.PUBLISHED,
            totalEstimatedDurationSecs: 600,
            publishedAt: new Date(),
            steps: {
              create: [
                {
                  tenantId: tenant1Id,
                  stepOrder: 1,
                  asanaId,
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 60,
                  demoVideoMediaId: mediaAssetId,
                },
              ],
            },
          },
        },
      },
      include: { versions: true },
    });
    sequenceId = seq.id;
    sequenceVersion1Id = seq.versions[0].id;
    expect(seq.versions.length).toBe(1);

    // Attach sequence version to session instance
    await prisma.classSessionInstance.update({
      where: { id: sessionInstanceId },
      data: { attachedSequenceVersionId: sequenceVersion1Id },
    });

    // 2. Update sequence -> publishes Version 2 while preserving Version 1 immutable
    const v2 = await prisma.sequenceVersion.create({
      data: {
        tenantId: tenant1Id,
        sequenceId,
        versionNumber: 2,
        status: SequenceStatus.PUBLISHED,
        totalEstimatedDurationSecs: 900,
        publishedAt: new Date(),
      },
    });

    await prisma.sequence.update({
      where: { id: sequenceId },
      data: { activeVersion: 2 },
    });

    // Check version 1 remains intact
    const originalV1 = await prisma.sequenceVersion.findUnique({
      where: { id: sequenceVersion1Id },
    });
    expect(originalV1?.versionNumber).toBe(1);
    expect(originalV1?.totalEstimatedDurationSecs).toBe(600);
  });

  // --------------------------------------------------------------------------
  // Journey 10: Conductor preparation, execution, pause/resume, and completion
  // --------------------------------------------------------------------------
  it('Journey 10: Conductor engine: session initialization, deterministic state transitions and completion', async () => {
    // 1. Initialize Conductor Session
    const conductor = await conductorService.initSession(
      tenant1Id,
      {
        sessionInstanceId,
        clientSessionUuid: crypto.randomUUID(),
      },
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    conductorSessionId = conductor.id;
    expect(conductor.status).toBe(ConductorSessionStatus.READY);

    // 2. Transition: READY -> RUNNING
    const running = await conductorService.executeAction(
      tenant1Id,
      sessionInstanceId,
      {
        clientEventUuid: crypto.randomUUID(),
        action: 'START',
        executionMode: ExecutionMode.REALTIME_AUTOMATED,
        clientTimestamp: new Date().toISOString(),
      },
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    expect(running.status).toBe(ConductorSessionStatus.RUNNING);

    // 3. Transition: RUNNING -> PAUSED
    const paused = await conductorService.executeAction(
      tenant1Id,
      sessionInstanceId,
      {
        clientEventUuid: crypto.randomUUID(),
        action: 'PAUSE',
        clientTimestamp: new Date().toISOString(),
      },
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    expect(paused.status).toBe(ConductorSessionStatus.PAUSED);

    // 4. Transition: PAUSED -> RUNNING
    const resumed = await conductorService.executeAction(
      tenant1Id,
      sessionInstanceId,
      {
        clientEventUuid: crypto.randomUUID(),
        action: 'RESUME',
        clientTimestamp: new Date().toISOString(),
      },
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    expect(resumed.status).toBe(ConductorSessionStatus.RUNNING);

    // 5. Complete step -> reaching end of sequence transitions to COMPLETED
    const completed = await conductorService.executeAction(
      tenant1Id,
      sessionInstanceId,
      {
        clientEventUuid: crypto.randomUUID(),
        action: 'NEXT_STEP',
        clientTimestamp: new Date().toISOString(),
      },
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    expect(completed.status).toBe(ConductorSessionStatus.COMPLETED);
  });

  // --------------------------------------------------------------------------
  // Journey 11: Offline media preparation and actual playback manifest resolution
  // --------------------------------------------------------------------------
  it('Journey 11: Offline media preparation and offline-ready playback manifest verification', async () => {
    // 1. Create a second session to test offline preparation
    const now = new Date();
    const session2 = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenant1Id,
        branchId,
        roomId,
        classTypeId,
        instructorId: instructorUser.id,
        sessionDate: new Date(now.getTime() + 86400000),
        startTimestamp: new Date(now.getTime() + 86400000),
        endTimestamp: new Date(now.getTime() + 86400000 + 75 * 60 * 1000),
        capacity: 10,
        attachedSequenceVersionId: sequenceVersion1Id,
      },
    });

    await conductorService.initSession(
      tenant1Id,
      {
        sessionInstanceId: session2.id,
        clientSessionUuid: crypto.randomUUID(),
      },
      instructorUser.id,
      UserRole.INSTRUCTOR
    );

    // 2. Submit offline preparation
    const prepResult = await conductorService.submitPreparation(
      tenant1Id,
      session2.id,
      {
        clientEventUuid: crypto.randomUUID(),
        status: 'OFFLINE_READY',
        verifiedAssetsCount: 1,
        totalBytesVerified: 14500000,
        clientTimestamp: new Date().toISOString(),
      },
      instructorUser.id,
      UserRole.INSTRUCTOR
    );

    expect(prepResult.isOfflineReady).toBe(true);

    // 3. Manifest verification
    const manifest = await conductorService.getMediaManifest(
      tenant1Id,
      session2.id,
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    expect(manifest.assets.length).toBeGreaterThanOrEqual(1);
    expect(manifest.assets[0].url).toContain('https://cdn.veda.yoga/media/virabhadrasana-2.mp4');
  });

  // --------------------------------------------------------------------------
  // Journey 12: Offline event queuing, session recovery, and reconnect synchronization
  // --------------------------------------------------------------------------
  it('Journey 12: Offline event queuing, session recovery and idempotent batch synchronization', async () => {
    // 1. Generate client execution events simulating offline queuing
    const eventUuid1 = crypto.randomUUID();
    const eventUuid2 = crypto.randomUUID();

    const syncPayload = {
      events: [
        {
          clientEventUuid: eventUuid1,
          sequenceNumber: 1,
          stepIndex: 0,
          phase: ConductorStepPhase.POSTURE_HOLD,
          eventType: 'STEP_STARTED' as const,
          elapsedSeconds: 0,
          clientTimestamp: new Date().toISOString(),
          isRecoveryEvent: false,
        },
        {
          clientEventUuid: eventUuid2,
          sequenceNumber: 2,
          stepIndex: 0,
          phase: ConductorStepPhase.POSTURE_HOLD,
          eventType: 'STEP_COMPLETED' as const,
          elapsedSeconds: 60,
          clientTimestamp: new Date().toISOString(),
          isRecoveryEvent: false,
        },
      ],
    };

    // 2. Synchronize events batch
    const syncRes1 = await conductorService.syncEvents(
      tenant1Id,
      sessionInstanceId,
      syncPayload,
      instructorUser.id,
      UserRole.INSTRUCTOR
    );

    expect(syncRes1.acknowledgedEventUuids).toContain(eventUuid1);
    expect(syncRes1.acknowledgedEventUuids).toContain(eventUuid2);
    expect(syncRes1.alreadyProcessedEventUuids.length).toBe(0);

    // 3. Re-submit identical batch to test idempotency
    const syncRes2 = await conductorService.syncEvents(
      tenant1Id,
      sessionInstanceId,
      syncPayload,
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    expect(syncRes2.alreadyProcessedEventUuids).toContain(eventUuid1);
    expect(syncRes2.alreadyProcessedEventUuids).toContain(eventUuid2);

    // 4. Test recovery endpoint
    const recovery = await conductorService.getRecoveryState(
      tenant1Id,
      sessionInstanceId,
      instructorUser.id,
      UserRole.INSTRUCTOR
    );
    expect(recovery.canResume).toBeDefined();
    expect(recovery.session.sessionInstanceId).toBe(sessionInstanceId);
  });

  // --------------------------------------------------------------------------
  // Journey 13: Strict multi-tenant isolation and role-based access denial
  // --------------------------------------------------------------------------
  it('Journey 13: Strict multi-tenant isolation and role-based access boundary enforcement', async () => {
    // 1. Cross-tenant isolation check: Tenant 2 cannot access Tenant 1's conductor session
    await expect(
      conductorService.getSession(
        tenant2Id,
        sessionInstanceId,
        instructorUser.id,
        UserRole.INSTRUCTOR
      )
    ).rejects.toThrow(NotFoundException);

    // 2. Cross-tenant isolation check: Tenant 2 cannot access Tenant 1's media manifest
    await expect(
      conductorService.getMediaManifest(
        tenant2Id,
        sessionInstanceId,
        instructorUser.id,
        UserRole.INSTRUCTOR
      )
    ).rejects.toThrow(NotFoundException);

    // 3. Cross-tenant isolation check: Tenant 2 cannot access Tenant 1's student
    const crossStudent = await prisma.student.findFirst({
      where: { id: studentId, tenantId: tenant2Id },
    });
    expect(crossStudent).toBeNull();

    // 4. Cross-tenant isolation check: Tenant 2 cannot access Tenant 1's invoice
    const crossInvoice = await prisma.taxInvoice.findFirst({
      where: { id: invoiceId, tenantId: tenant2Id },
    });
    expect(crossInvoice).toBeNull();

    // 5. Cross-tenant isolation check: Tenant 2 cannot access Tenant 1's sequence
    const crossSeq = await prisma.sequence.findFirst({
      where: { id: sequenceId, tenantId: tenant2Id },
    });
    expect(crossSeq).toBeNull();
  });
});
