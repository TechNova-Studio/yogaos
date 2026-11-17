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

describe('P18 Real Database Integration Tests (Conductor Recovery, Event Sync & History)', () => {
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
  let sequenceVersionIdA: string;

  beforeAll(async () => {
    auditService = new AuditService();
    conductorService = new ConductorService(auditService);

    // 1. Setup Tenant A & Tenant B
    const orgA = await prisma.organization.create({
      data: {
        name: `P18 Moksha Yoga ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p18-moksha-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    const orgB = await prisma.organization.create({
      data: {
        name: `P18 Anand Studio ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p18-anand-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 2. Setup Users
    const ownerA = await prisma.user.create({
      data: {
        email: `owner-p18-a-${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Kavita Iyer (Owner A)',
      },
    });
    ownerUserA = ownerA.id;
    createdUserIds.push(ownerUserA);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: ownerUserA,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });

    const instA1 = await prisma.user.create({
      data: {
        email: `inst-p18-a1-${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Arjun Deshmukh (Instructor A1)',
      },
    });
    instructorA1 = instA1.id;
    createdUserIds.push(instructorA1);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: instructorA1,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    const instA2 = await prisma.user.create({
      data: {
        email: `inst-p18-a2-${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Pooja Nair (Instructor A2 - Unassigned)',
      },
    });
    instructorA2 = instA2.id;
    createdUserIds.push(instructorA2);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: instructorA2,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    const instB1 = await prisma.user.create({
      data: {
        email: `inst-p18-b1-${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Vikram Seth (Instructor B1)',
      },
    });
    instructorB1 = instB1.id;
    createdUserIds.push(instructorB1);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: instructorB1,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    // 3. Branches, Rooms & Class Types
    const branchA = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Indiranagar Main',
        slug: `indiranagar-${crypto.randomUUID().slice(0, 6)}`,
        streetAddress: '100 Feet Road, HAL 2nd Stage',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560038',
        phone: '+91 98000 11223',
        email: 'indiranagar@mokshayoga.test',
      },
    });
    createdBranchIds.push(branchA.id);

    const roomA = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        name: 'Shanti Shala',
        maxMatCapacity: 25,
      },
    });
    createdRoomIds.push(roomA.id);

    const classTypeA = await prisma.classType.create({
      data: {
        tenantId: tenantA,
        name: 'Vinyasa Recovery Flow',
        category: 'Vinyasa',
        level: 'ALL_LEVELS',
        defaultDurationMins: 60,
        defaultCapacity: 25,
      },
    });
    createdClassTypeIds.push(classTypeA.id);

    // 4. Create Asana & Sequence
    const asana = await prisma.asana.create({
      data: {
        tenantId: tenantA,
        createdByUserId: ownerUserA,
        sanskritName: 'Vrikshasana P18',
        sanskritNameIast: 'Vṛkṣāsana',
        englishName: 'Tree Pose',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        status: AsanaStatus.PUBLISHED,
      },
    });
    createdAsanaIds.push(asana.id);

    const seqA = await prisma.sequence.create({
      data: {
        tenantId: tenantA,
        creatorUserId: instructorA1,
        title: 'Recovery Balance Series',
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
            steps: {
              create: [
                {
                  tenantId: tenantA,
                  stepOrder: 1,
                  asanaId: asana.id,
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 60,
                },
                {
                  tenantId: tenantA,
                  stepOrder: 2,
                  asanaId: asana.id,
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 60,
                },
                {
                  tenantId: tenantA,
                  stepOrder: 3,
                  asanaId: asana.id,
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 60,
                },
              ],
            },
          },
        },
      },
      include: { versions: true },
    });
    createdSequenceIds.push(seqA.id);
    sequenceVersionIdA = seqA.versions[0].id;

    // 5. ClassSessionInstances
    const s1 = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        roomId: roomA.id,
        classTypeId: classTypeA.id,
        instructorId: instructorA1,
        sessionDate: new Date(),
        startTimestamp: new Date(Date.now() + 3600000),
        endTimestamp: new Date(Date.now() + 7200000),
        capacity: 25,
        status: 'SCHEDULED',
        attachedSequenceVersionId: sequenceVersionIdA,
      },
    });
    sessionInstanceA1 = s1.id;
    createdSessionInstanceIds.push(sessionInstanceA1);

    const s2 = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        roomId: roomA.id,
        classTypeId: classTypeA.id,
        instructorId: instructorA1,
        sessionDate: new Date(Date.now() + 86400000),
        startTimestamp: new Date(Date.now() + 90000000),
        endTimestamp: new Date(Date.now() + 93600000),
        capacity: 25,
        status: 'SCHEDULED',
        attachedSequenceVersionId: sequenceVersionIdA,
      },
    });
    sessionInstanceA2 = s2.id;
    createdSessionInstanceIds.push(sessionInstanceA2);
  });

  afterAll(async () => {
    // Cleanup reverse dependencies
    for (const sid of createdConductorSessionIds) {
      await prisma.conductorExecutionEvent.deleteMany({ where: { conductorSessionId: sid } }).catch(() => {});
      await prisma.conductorSession.delete({ where: { id: sid } }).catch(() => {});
    }
    for (const sid of createdSessionInstanceIds) {
      await prisma.conductorSession.deleteMany({ where: { sessionInstanceId: sid } }).catch(() => {});
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
    for (const ctid of createdClassTypeIds) {
      await prisma.classType.delete({ where: { id: ctid } }).catch(() => {});
    }
    for (const rid of createdRoomIds) {
      await prisma.room.delete({ where: { id: rid } }).catch(() => {});
    }
    for (const bid of createdBranchIds) {
      await prisma.branch.delete({ where: { id: bid } }).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await prisma.organizationMember.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    for (const oid of createdOrgIds) {
      await prisma.auditLog.deleteMany({ where: { tenantId: oid } }).catch(() => {});
      await prisma.organization.delete({ where: { id: oid } }).catch(() => {});
    }
  });

  describe('1. Offline Event Ingestion & Server-Side Idempotency', () => {
    let conductorSessionId: string;

    it('initializes a conductor session and accepts batch of offline execution events', async () => {
      const session = await conductorService.initSession(
        tenantA,
        {
          sessionInstanceId: sessionInstanceA1,
          clientSessionUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(session.status).toBe('READY');
      conductorSessionId = session.id;
      createdConductorSessionIds.push(conductorSessionId);

      const eventUuid1 = crypto.randomUUID();
      const eventUuid2 = crypto.randomUUID();
      const eventUuid3 = crypto.randomUUID();

      const batchResult = await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: [
            {
              clientEventUuid: eventUuid1,
              eventType: 'STEP_STARTED',
              stepOrder: 0,
              clientTimestamp: new Date().toISOString(),
              payload: { localStep: 1 },
            },
            {
              clientEventUuid: eventUuid2,
              eventType: 'TIME_ADJUSTED',
              stepOrder: 0,
              clientTimestamp: new Date().toISOString(),
              payload: { deltaSeconds: 30 },
            },
            {
              clientEventUuid: eventUuid3,
              eventType: 'STEP_COMPLETED',
              stepOrder: 0,
              clientTimestamp: new Date().toISOString(),
            },
          ],
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(batchResult.acknowledgedEventUuids).toHaveLength(3);
      expect(batchResult.alreadyProcessedEventUuids).toHaveLength(0);
      expect(batchResult.failedEventUuids).toHaveLength(0);

      // Verify records in database
      const count = await prisma.conductorExecutionEvent.count({
        where: { conductorSessionId },
      });
      // 1 init event + 3 synced events = 4
      expect(count).toBe(4);
    });

    it('idempotently handles duplicate batch submissions without duplicate rows or errors', async () => {
      // Fetch existing events
      const existingEvents = await prisma.conductorExecutionEvent.findMany({
        where: { conductorSessionId },
      });
      const syncedEvents = existingEvents.filter((e) => e.eventType !== 'SESSION_INITIALIZED');

      const reSyncResult = await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: syncedEvents.map((e) => ({
            clientEventUuid: e.clientEventUuid,
            eventType: e.eventType,
            stepOrder: e.stepOrder,
            clientTimestamp: e.clientTimestamp.toISOString(),
          })),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      // All 3 should be acknowledged, and all 3 reported as already processed
      expect(reSyncResult.acknowledgedEventUuids).toHaveLength(3);
      expect(reSyncResult.alreadyProcessedEventUuids).toHaveLength(3);

      // Total count in database must NOT change
      const countAfter = await prisma.conductorExecutionEvent.count({
        where: { conductorSessionId },
      });
      expect(countAfter).toBe(4);
    });

    it('handles partial batches containing both existing and new events', async () => {
      const existing = await prisma.conductorExecutionEvent.findFirst({
        where: { conductorSessionId, eventType: 'STEP_STARTED' },
      });
      expect(existing).toBeDefined();

      const newUuid1 = crypto.randomUUID();
      const newUuid2 = crypto.randomUUID();

      const partialResult = await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: [
            {
              clientEventUuid: existing!.clientEventUuid, // Existing
              eventType: existing!.eventType,
              clientTimestamp: existing!.clientTimestamp.toISOString(),
            },
            {
              clientEventUuid: newUuid1, // New
              eventType: 'STEP_STARTED',
              stepOrder: 1,
              clientTimestamp: new Date().toISOString(),
            },
            {
              clientEventUuid: newUuid2, // New
              eventType: 'STEP_COMPLETED',
              stepOrder: 1,
              clientTimestamp: new Date().toISOString(),
            },
          ],
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(partialResult.acknowledgedEventUuids).toHaveLength(3);
      expect(partialResult.alreadyProcessedEventUuids).toHaveLength(1);
      expect(partialResult.alreadyProcessedEventUuids).toContain(existing!.clientEventUuid);

      // New events must have isOfflineSync = true
      const inserted = await prisma.conductorExecutionEvent.findUnique({
        where: { clientEventUuid: newUuid1 },
      });
      expect(inserted?.isOfflineSync).toBe(true);
    });
  });

  describe('2. Authorization, Tenancy & Security Invariants', () => {
    it('strictly rejects cross-tenant sync requests with NotFoundException', async () => {
      await expect(
        conductorService.syncEvents(
          tenantB, // WRONG TENANT
          sessionInstanceA1,
          {
            events: [
              {
                clientEventUuid: crypto.randomUUID(),
                eventType: 'STEP_STARTED',
                clientTimestamp: new Date().toISOString(),
              },
            ],
          },
          instructorB1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('strictly denies unassigned instructor from synchronizing events with ForbiddenException', async () => {
      await expect(
        conductorService.syncEvents(
          tenantA,
          sessionInstanceA1,
          {
            events: [
              {
                clientEventUuid: crypto.randomUUID(),
                eventType: 'STEP_STARTED',
                clientTimestamp: new Date().toISOString(),
              },
            ],
          },
          instructorA2, // UNASSIGNED INSTRUCTOR
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows studio Owner and Manager to sync events on behalf of studio sessions', async () => {
      const ownerSyncResult = await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: [
            {
              clientEventUuid: crypto.randomUUID(),
              eventType: 'TIME_ADJUSTED',
              clientTimestamp: new Date().toISOString(),
              payload: { deltaSeconds: 15 },
            },
          ],
        },
        ownerUserA,
        UserRole.OWNER
      );
      expect(ownerSyncResult.acknowledgedEventUuids).toHaveLength(1);
    });

    it('sanitizes event payloads and strips sensitive student medical notes', async () => {
      const testUuid = crypto.randomUUID();
      await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: [
            {
              clientEventUuid: testUuid,
              eventType: 'STEP_STARTED',
              clientTimestamp: new Date().toISOString(),
              payload: {
                safeKey: 'alignment-cues',
                healthNotes: 'Confidential Herniated Disc Patient L4-L5',
                medicalHistory: 'Severe Spinal Stenosis',
              },
            },
          ],
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      const saved = await prisma.conductorExecutionEvent.findUnique({
        where: { clientEventUuid: testUuid },
      });
      expect(saved).toBeDefined();
      const payload = saved!.payload as any;
      expect(payload.safeKey).toBe('alignment-cues');
      expect(payload.healthNotes).toBeUndefined();
      expect(payload.medicalHistory).toBeUndefined();
    });
  });

  describe('3. State Reconciliation & Invariants', () => {
    it('advances progress monotonically and rejects regressive snapshots', async () => {
      // Advance to stepIndex 2, completedCount 2
      const res1 = await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: [
            {
              clientEventUuid: crypto.randomUUID(),
              eventType: 'STEP_STARTED',
              stepOrder: 2,
              clientTimestamp: new Date().toISOString(),
            },
          ],
          sessionStateSnapshot: {
            currentStepIndex: 2,
            currentPhase: 'POSTURE_HOLD',
            completedStepsCount: 2,
            skippedStepsCount: 0,
            totalElapsedSeconds: 120,
          },
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(res1.currentState.currentStepIndex).toBe(2);
      expect(res1.currentState.completedStepsCount).toBe(2);
      expect(res1.currentState.lastSyncAt).toBeDefined();

      // Attempt to send a regressive snapshot with stepIndex 0 and completedCount 0
      const res2 = await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: [
            {
              clientEventUuid: crypto.randomUUID(),
              eventType: 'STEP_STARTED',
              stepOrder: 2,
              clientTimestamp: new Date().toISOString(),
            },
          ],
          sessionStateSnapshot: {
            currentStepIndex: 0, // REGRESSIVE
            currentPhase: 'POSTURE_HOLD',
            completedStepsCount: 0, // REGRESSIVE
            skippedStepsCount: 0,
            totalElapsedSeconds: 50,
          },
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      // Server progress must remain monotonic at 2
      expect(res2.currentState.currentStepIndex).toBe(2);
      expect(res2.currentState.completedStepsCount).toBe(2);
      expect(res2.currentState.totalElapsedSeconds).toBe(120);
    });

    it('enforces crucial invariant: never automatically converts paused or interrupted sessions to COMPLETED', async () => {
      // Start the session first (READY -> RUNNING)
      await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'START',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      // Pause the session (RUNNING -> PAUSED)
      await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'PAUSE',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      const pausedState = await conductorService.getSession(
        tenantA,
        sessionInstanceA1,
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(pausedState.status).toBe('PAUSED');

      // Sync offline event with a snapshot claiming COMPLETED
      const syncResult = await conductorService.syncEvents(
        tenantA,
        sessionInstanceA1,
        {
          events: [
            {
              clientEventUuid: crypto.randomUUID(),
              eventType: 'STEP_COMPLETED',
              stepOrder: 2,
              clientTimestamp: new Date().toISOString(),
            },
          ],
          sessionStateSnapshot: {
            currentStepIndex: 1,
            currentPhase: 'POSTURE_HOLD',
            completedStepsCount: 1,
            skippedStepsCount: 0,
            totalElapsedSeconds: 200,
            status: 'COMPLETED', // ILLEGAL AUTOMATIC COMPLETION
          },
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      // Status must remain PAUSED!
      expect(syncResult.currentState.status).toBe('PAUSED');
    });
  });

  describe('4. Recovery Workflows (Resume & Abandon)', () => {
    it('inspects recovery state correctly for unfinished/interrupted sessions', async () => {
      const recovery = await conductorService.getRecoveryState(
        tenantA,
        sessionInstanceA1,
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(recovery.isUnfinished).toBe(true);
      expect(recovery.canResume).toBe(true);
      expect(recovery.isAbandoned).toBe(false);
      expect(recovery.serverLastEventAt).toBeDefined();
    });

    it('allows explicit instructor action to RESUME an interrupted or paused session', async () => {
      // First conclude early into INTERRUPTED
      await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'END_SESSION',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      const interruptedSession = await conductorService.getSession(
        tenantA,
        sessionInstanceA1,
        instructorA1,
        UserRole.INSTRUCTOR
      );
      expect(interruptedSession.status).toBe('INTERRUPTED');

      // Now explicitly RESUME via recovery
      const recovered = await conductorService.recoverSession(
        tenantA,
        sessionInstanceA1,
        {
          action: 'RESUME',
          reason: 'Tablet was temporarily closed; resuming class flow',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(recovered.status).toBe('RUNNING');
    });

    it('allows explicit instructor action to ABANDON an interrupted session', async () => {
      // Pause or interrupt again
      await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'PAUSE',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      // Now explicitly ABANDON via recovery
      const abandoned = await conductorService.recoverSession(
        tenantA,
        sessionInstanceA1,
        {
          action: 'ABANDON',
          reason: 'Studio power outage; class abandoned',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(abandoned.status).toBe('INTERRUPTED_ABANDONED');
      expect(abandoned.actualConcludedAt).toBeDefined();

      // Terminal state invariant: cannot recover an already abandoned session
      await expect(
        conductorService.recoverSession(
          tenantA,
          sessionInstanceA1,
          {
            action: 'RESUME',
            clientEventUuid: crypto.randomUUID(),
          },
          instructorA1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Session History & Event Timeline Queries', () => {
    it('retrieves session history with tenant isolation and instructor filtering', async () => {
      // Owner sees all tenant sessions
      const ownerHistory = await conductorService.getSessionHistory(
        tenantA,
        { limit: 10, offset: 0 },
        ownerUserA,
        UserRole.OWNER
      );
      expect(ownerHistory.total).toBeGreaterThanOrEqual(1);
      const item = ownerHistory.items.find((i) => i.sessionInstanceId === sessionInstanceA1);
      expect(item).toBeDefined();
      expect(item?.instructorName).toContain('Arjun');
      expect(item?.status).toBe('INTERRUPTED_ABANDONED');
      expect(item?.eventsCount).toBeGreaterThanOrEqual(5);

      // Instructor A2 (unassigned) sees 0 conducted sessions
      const instA2History = await conductorService.getSessionHistory(
        tenantA,
        { limit: 10, offset: 0 },
        instructorA2,
        UserRole.INSTRUCTOR
      );
      const foundA2 = instA2History.items.find((i) => i.sessionInstanceId === sessionInstanceA1);
      expect(foundA2).toBeUndefined();
    });

    it('retrieves full event history stream distinguishing offline synced events', async () => {
      const events = await conductorService.getSessionEvents(
        tenantA,
        sessionInstanceA1,
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(events.length).toBeGreaterThanOrEqual(5);
      // Verify chronological order
      for (let i = 1; i < events.length; i++) {
        expect(new Date(events[i].clientTimestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(events[i - 1].clientTimestamp).getTime()
        );
      }

      // Check offline synced events flag
      const offlineSynced = events.filter((e) => e.isOfflineSync);
      expect(offlineSynced.length).toBeGreaterThanOrEqual(1);
    });

    it('safely handles concurrent synchronization requests without crashing', async () => {
      // Setup second session
      const s2 = await conductorService.initSession(
        tenantA,
        {
          sessionInstanceId: sessionInstanceA2,
          clientSessionUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      createdConductorSessionIds.push(s2.id);

      const sharedUuid = crypto.randomUUID();
      const eventBatch = [
        {
          clientEventUuid: sharedUuid,
          eventType: 'STEP_STARTED' as const,
          stepOrder: 0,
          clientTimestamp: new Date().toISOString(),
        },
      ];

      // Execute 5 concurrent sync attempts sending the same event
      const results = await Promise.all([
        conductorService.syncEvents(tenantA, sessionInstanceA2, { events: eventBatch }, instructorA1, UserRole.INSTRUCTOR),
        conductorService.syncEvents(tenantA, sessionInstanceA2, { events: eventBatch }, instructorA1, UserRole.INSTRUCTOR),
        conductorService.syncEvents(tenantA, sessionInstanceA2, { events: eventBatch }, instructorA1, UserRole.INSTRUCTOR),
        conductorService.syncEvents(tenantA, sessionInstanceA2, { events: eventBatch }, instructorA1, UserRole.INSTRUCTOR),
        conductorService.syncEvents(tenantA, sessionInstanceA2, { events: eventBatch }, instructorA1, UserRole.INSTRUCTOR),
      ]);

      // All 5 must succeed with acknowledgedEventUuids containing the sharedUuid
      results.forEach((res) => {
        expect(res.acknowledgedEventUuids).toContain(sharedUuid);
      });

      // Database must have exactly 1 record for this UUID
      const exactRecords = await prisma.conductorExecutionEvent.findMany({
        where: { clientEventUuid: sharedUuid },
      });
      expect(exactRecords).toHaveLength(1);
    });
  });
});
