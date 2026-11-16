import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'node:crypto';
import {
  prisma,
  UserRole,
  MemberStatus,
  AsanaCategory,
  AsanaDifficulty,
  AsanaStatus,
  SequenceStatus,
  SequenceLevel,
  ExecutionMode,
} from '@yogaos/database';
import { ConductorService } from '../src/modules/conductor/conductor.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('P16 Real Database Integration Tests (Automated Class Conductor Engine)', () => {
  let auditService: AuditService;
  let conductorService: ConductorService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdRoomIds: string[] = [];
  const createdClassTypeIds: string[] = [];
  const createdSessionInstanceIds: string[] = [];
  const createdAsanaIds: string[] = [];
  const createdSequenceIds: string[] = [];
  const createdConductorSessionIds: string[] = [];

  let tenantA: string;
  let tenantB: string;
  let ownerUserA: string;
  let instructorA1: string;
  let instructorA2: string;
  let instructorB1: string;

  let sessionInstanceA1: string;
  let sessionInstanceA2: string;
  let publishedVersionA: any;

  beforeAll(async () => {
    auditService = new AuditService();
    conductorService = new ConductorService(auditService);

    // 1. Setup Tenant A
    const orgA = await prisma.organization.create({
      data: {
        name: `P16 Moksha Yoga ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p16-moksha-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    // 2. Setup Tenant B
    const orgB = await prisma.organization.create({
      data: {
        name: `P16 Prana Flow ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p16-prana-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 3. Create Users
    const ownerA = await prisma.user.create({
      data: {
        email: `owner.a.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Owner A',
        memberships: {
          create: { tenantId: tenantA, role: UserRole.OWNER, status: MemberStatus.ACTIVE },
        },
      },
    });
    ownerUserA = ownerA.id;
    createdUserIds.push(ownerUserA);

    const instA1 = await prisma.user.create({
      data: {
        email: `inst.a1.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Aarav Instructor A1',
        memberships: {
          create: { tenantId: tenantA, role: UserRole.INSTRUCTOR, status: MemberStatus.ACTIVE },
        },
      },
    });
    instructorA1 = instA1.id;
    createdUserIds.push(instructorA1);

    const instA2 = await prisma.user.create({
      data: {
        email: `inst.a2.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Diya Instructor A2',
        memberships: {
          create: { tenantId: tenantA, role: UserRole.INSTRUCTOR, status: MemberStatus.ACTIVE },
        },
      },
    });
    instructorA2 = instA2.id;
    createdUserIds.push(instructorA2);

    const instB1 = await prisma.user.create({
      data: {
        email: `inst.b1.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Kabir Instructor B1',
        memberships: {
          create: { tenantId: tenantB, role: UserRole.INSTRUCTOR, status: MemberStatus.ACTIVE },
        },
      },
    });
    instructorB1 = instB1.id;
    createdUserIds.push(instructorB1);

    // 4. Create Studio Branch & Room in Tenant A
    const branchA = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Indiranagar Flagship',
        slug: `indiranagar-${crypto.randomUUID().slice(0, 6)}`,
        streetAddress: '100 Feet Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560038',
        phone: '+91 99000 11221',
        email: 'info@mokshayoga.test',
      },
    });
    createdBranchIds.push(branchA.id);

    const roomA = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        name: 'Shanti Studio Room',
        maxMatCapacity: 25,
      },
    });
    createdRoomIds.push(roomA.id);

    const classTypeA = await prisma.classType.create({
      data: {
        tenantId: tenantA,
        name: 'Vinyasa Flow Foundation',
        category: 'Vinyasa',
        level: 'ALL_LEVELS',
        defaultDurationMins: 60,
        defaultCapacity: 20,
      },
    });
    createdClassTypeIds.push(classTypeA.id);

    // 5. Create Asanas
    const asana1 = await prisma.asana.create({
      data: {
        tenantId: tenantA,
        createdByUserId: ownerUserA,
        sanskritName: 'Tadasana',
        sanskritNameIast: 'Tāḍāsana',
        englishName: 'Mountain Pose',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        status: AsanaStatus.PUBLISHED,
      },
    });
    createdAsanaIds.push(asana1.id);

    const asana2 = await prisma.asana.create({
      data: {
        tenantId: tenantA,
        createdByUserId: ownerUserA,
        sanskritName: 'Virabhadrasana II',
        sanskritNameIast: 'Vīrabhadrāsana II',
        englishName: 'Warrior II',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.INTERMEDIATE,
        status: AsanaStatus.PUBLISHED,
      },
    });
    createdAsanaIds.push(asana2.id);

    // 6. Create Published Sequence with 2 steps (one unilateral, one bilateral with rest)
    const seq = await prisma.sequence.create({
      data: {
        tenantId: tenantA,
        creatorUserId: instructorA1,
        title: 'Morning Energizing Flow V1',
        targetLevel: SequenceLevel.ALL_LEVELS,
        status: SequenceStatus.PUBLISHED,
        activeVersion: 1,
        estimatedTotalDurationSecs: 135,
        versions: {
          create: {
            tenantId: tenantA,
            versionNumber: 1,
            status: SequenceStatus.PUBLISHED,
            totalEstimatedDurationSecs: 135,
            publishedAt: new Date(),
            steps: {
              create: [
                {
                  tenantId: tenantA,
                  stepOrder: 1,
                  asanaId: asana1.id,
                  asanaNameSnapshot: 'Mountain Pose',
                  sanskritNameSnapshot: 'Tāḍāsana',
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 30,
                  isBilateral: false,
                  restIntervalSeconds: 0,
                  cues: 'Root feet, crown high',
                },
                {
                  tenantId: tenantA,
                  stepOrder: 2,
                  asanaId: asana2.id,
                  asanaNameSnapshot: 'Warrior II',
                  sanskritNameSnapshot: 'Vīrabhadrāsana II',
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 45,
                  isBilateral: true, // Bilateral: Side A (45s), Side B (45s)
                  restIntervalSeconds: 15,
                  cues: 'Deep lunge, gaze past front fingertips',
                },
              ],
            },
          },
        },
      },
      include: {
        versions: {
          include: { steps: true },
        },
      },
    });
    createdSequenceIds.push(seq.id);
    publishedVersionA = seq.versions[0];

    // 7. Create ClassSessionInstances
    const session1 = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        roomId: roomA.id,
        classTypeId: classTypeA.id,
        instructorId: instructorA1, // Assigned to Instructor A1
        sessionDate: new Date(),
        startTimestamp: new Date(Date.now() + 3600000),
        endTimestamp: new Date(Date.now() + 7200000),
        capacity: 20,
        status: 'SCHEDULED',
        attachedSequenceVersionId: publishedVersionA.id,
      },
    });
    sessionInstanceA1 = session1.id;
    createdSessionInstanceIds.push(sessionInstanceA1);

    const session2 = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        roomId: roomA.id,
        classTypeId: classTypeA.id,
        instructorId: instructorA2, // Assigned to Instructor A2
        sessionDate: new Date(),
        startTimestamp: new Date(Date.now() + 10800000),
        endTimestamp: new Date(Date.now() + 14400000),
        capacity: 20,
        status: 'SCHEDULED',
        attachedSequenceVersionId: publishedVersionA.id,
      },
    });
    sessionInstanceA2 = session2.id;
    createdSessionInstanceIds.push(sessionInstanceA2);
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    for (const sid of createdConductorSessionIds) {
      await prisma.conductorExecutionEvent.deleteMany({ where: { conductorSessionId: sid } }).catch(() => {});
      await prisma.conductorSession.delete({ where: { id: sid } }).catch(() => {});
    }
    for (const sid of createdSessionInstanceIds) {
      await prisma.classSessionInstance.delete({ where: { id: sid } }).catch(() => {});
    }
    for (const sid of createdSequenceIds) {
      await prisma.sequenceStep.deleteMany({ where: { sequenceVersion: { sequenceId: sid } } }).catch(() => {});
      await prisma.sequenceVersion.deleteMany({ where: { sequenceId: sid } }).catch(() => {});
      await prisma.sequence.delete({ where: { id: sid } }).catch(() => {});
    }
    for (const aid of createdAsanaIds) {
      await prisma.asana.delete({ where: { id: aid } }).catch(() => {});
    }
    for (const cid of createdClassTypeIds) {
      await prisma.classType.delete({ where: { id: cid } }).catch(() => {});
    }
    for (const rid of createdRoomIds) {
      await prisma.room.delete({ where: { id: rid } }).catch(() => {});
    }
    for (const bid of createdBranchIds) {
      await prisma.branch.delete({ where: { id: bid } }).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await prisma.organizationMember.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    for (const oid of createdOrgIds) {
      await prisma.organization.delete({ where: { id: oid } }).catch(() => {});
    }
  });

  describe('1. Conductor Session Initialization & Authorization', () => {
    it('initializes a conductor session for assigned instructor', async () => {
      const state = await conductorService.initSession(
        tenantA,
        { sessionInstanceId: sessionInstanceA1 },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      createdConductorSessionIds.push(state.id);
      expect(state.status).toBe('READY');
      expect(state.sessionInstanceId).toBe(sessionInstanceA1);
      expect(state.totalSteps).toBe(2);
      expect(state.currentStepIndex).toBe(0);
      expect(state.currentPhase).toBe('POSTURE_HOLD');
      expect(state.currentStep?.asanaName).toBe('Mountain Pose');

      // Verify DB record
      const dbRecord = await prisma.conductorSession.findUnique({
        where: { id: state.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.status).toBe('READY');

      // Verify SESSION_INITIALIZED event
      const event = await prisma.conductorExecutionEvent.findFirst({
        where: { conductorSessionId: state.id, eventType: 'SESSION_INITIALIZED' },
      });
      expect(event).not.toBeNull();
    });

    it('returns existing session idempotently if initialized again', async () => {
      const state = await conductorService.initSession(
        tenantA,
        { sessionInstanceId: sessionInstanceA1 },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(state.sessionInstanceId).toBe(sessionInstanceA1);
    });

    it('denies another instructor from launching a session they are not assigned to', async () => {
      // Instructor A2 trying to launch Instructor A1's session
      await expect(
        conductorService.initSession(
          tenantA,
          { sessionInstanceId: sessionInstanceA1 },
          instructorA2,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies cross-tenant conductor launch and retrieval', async () => {
      // Instructor B1 from Tenant B trying to access Session A1
      await expect(
        conductorService.initSession(
          tenantB,
          { sessionInstanceId: sessionInstanceA1 },
          instructorB1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(NotFoundException);

      await expect(
        conductorService.getSession(
          tenantB,
          sessionInstanceA1,
          instructorB1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('permits OWNER to access and control any session in their organization', async () => {
      const state = await conductorService.getSession(
        tenantA,
        sessionInstanceA1,
        ownerUserA,
        UserRole.OWNER
      );
      expect(state.sessionInstanceId).toBe(sessionInstanceA1);
    });
  });

  describe('2. State Machine Transitions & Runtime Execution', () => {
    it('starts class: transitions from READY to RUNNING', async () => {
      const state = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'START',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(state.status).toBe('RUNNING');
      expect(state.actualStartedAt).not.toBeNull();

      // Check event
      const event = await prisma.conductorExecutionEvent.findFirst({
        where: { conductorSessionId: state.id, eventType: 'SESSION_STARTED' },
      });
      expect(event).not.toBeNull();
    });

    it('pauses and resumes class runtime', async () => {
      // Pause
      const pausedState = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'PAUSE',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(pausedState.status).toBe('PAUSED');

      // Resume
      const resumedState = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'RESUME',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(resumedState.status).toBe('RUNNING');
    });

    it('adjusts hold time (+30 seconds)', async () => {
      const state = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'ADJUST_TIME',
          deltaSeconds: 30,
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(state.addedTimeSeconds).toBe(30);
    });

    it('progresses through bilateral posture phases and rest intervals', async () => {
      // Step 1: Mountain pose (unilateral) -> NEXT_STEP advances to Step 2 (Warrior II - Bilateral Side A)
      const toStep2SideA = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'NEXT_STEP',
          currentStepIndex: 0,
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(toStep2SideA.currentStepIndex).toBe(1);
      expect(toStep2SideA.currentPhase).toBe('BILATERAL_SIDE_A');
      expect(toStep2SideA.completedStepsCount).toBe(1);

      // Step 2: NEXT_STEP advances from Side A to Side B
      const toStep2SideB = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'NEXT_STEP',
          currentStepIndex: 1,
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(toStep2SideB.currentStepIndex).toBe(1);
      expect(toStep2SideB.currentPhase).toBe('BILATERAL_SIDE_B');

      // Step 2: NEXT_STEP advances from Side B to REST_INTERVAL (15s rest)
      const toRest = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'NEXT_STEP',
          currentStepIndex: 1,
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(toRest.currentStepIndex).toBe(1);
      expect(toRest.currentPhase).toBe('REST_INTERVAL');

      // Final step complete: advances past last step to COMPLETED
      const completedState = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'NEXT_STEP',
          currentStepIndex: 1,
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(completedState.status).toBe('COMPLETED');
      expect(completedState.actualConcludedAt).not.toBeNull();
      expect(completedState.completedStepsCount).toBe(2);
    });

    it('enforces idempotency on duplicate clientEventUuid', async () => {
      const fixedEventUuid = crypto.randomUUID();

      // Action on Session A2
      const initA2 = await conductorService.initSession(
        tenantA,
        { sessionInstanceId: sessionInstanceA2 },
        instructorA2,
        UserRole.INSTRUCTOR
      );
      createdConductorSessionIds.push(initA2.id);

      const firstCall = await conductorService.executeAction(
        tenantA,
        sessionInstanceA2,
        {
          action: 'START',
          clientEventUuid: fixedEventUuid,
        },
        instructorA2,
        UserRole.INSTRUCTOR
      );
      expect(firstCall.status).toBe('RUNNING');

      // Second identical call with duplicate clientEventUuid
      const duplicateCall = await conductorService.executeAction(
        tenantA,
        sessionInstanceA2,
        {
          action: 'START',
          clientEventUuid: fixedEventUuid,
        },
        instructorA2,
        UserRole.INSTRUCTOR
      );
      expect(duplicateCall.status).toBe('RUNNING');

      // Ensure duplicate event was not created
      const events = await prisma.conductorExecutionEvent.findMany({
        where: { clientEventUuid: fixedEventUuid },
      });
      expect(events.length).toBe(1);
    });

    it('rejects action on completed session (terminal state invariant)', async () => {
      await expect(
        conductorService.executeAction(
          tenantA,
          sessionInstanceA1,
          {
            action: 'START',
            clientEventUuid: crypto.randomUUID(),
          },
          instructorA1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Stale Session Heartbeat Invariant & Abandonment Timeout', () => {
    it('marks abandoned stale session as INTERRUPTED_ABANDONED and NEVER COMPLETED', async () => {
      // Simulate stale session by modifying session A2's lastHeartbeatAt to 45 mins ago
      const staleTime = new Date(Date.now() - 45 * 60 * 1000);
      await prisma.conductorSession.updateMany({
        where: { sessionInstanceId: sessionInstanceA2 },
        data: {
          status: 'PAUSED',
          lastHeartbeatAt: staleTime,
          updatedAt: staleTime,
        },
      });

      const abandonedCount = await conductorService.checkAbandonedSessions(tenantA, 30);
      expect(abandonedCount).toBeGreaterThanOrEqual(1);

      const staleDb = await prisma.conductorSession.findFirst({
        where: { sessionInstanceId: sessionInstanceA2 },
      });

      expect(staleDb?.status).toBe('INTERRUPTED_ABANDONED');
      expect(staleDb?.status).not.toBe('COMPLETED');

      // Verify SESSION_ABANDONED event
      const event = await prisma.conductorExecutionEvent.findFirst({
        where: { conductorSessionId: staleDb?.id, eventType: 'SESSION_ABANDONED' },
      });
      expect(event).not.toBeNull();
    });
  });
});
