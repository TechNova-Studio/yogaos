import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, UserRole, MemberStatus, BatchStatus, SessionStatus } from '@yogaos/database';
import { ClassTypesService } from '../src/modules/classes/class-types.service.js';
import { BatchesService } from '../src/modules/classes/batches.service.js';
import { SessionsService } from '../src/modules/classes/sessions.service.js';
import { ConflictValidationService } from '../src/modules/classes/conflict-validation.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('P09 Real Database Integration Tests (Class Types, Batches, Scheduling & Conflicts)', () => {
  let auditService: AuditService;
  let conflictService: ConflictValidationService;
  let classTypesService: ClassTypesService;
  let batchesService: BatchesService;
  let sessionsService: SessionsService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  // Tenant IDs & Shared Instructor
  let tenantA: string;
  let tenantB: string;
  let branchA: string;
  let branchB: string;
  let roomA1: string; // capacity 20
  let roomA2: string; // capacity 10
  let roomB1: string; // capacity 25

  let userOwnerA: string;
  let userInstructorMulti: string; // Active Instructor in BOTH Tenant A & Tenant B
  let userInstructorA2: string; // Instructor only in Tenant A

  beforeAll(async () => {
    auditService = new AuditService();
    conflictService = new ConflictValidationService();
    classTypesService = new ClassTypesService(auditService);
    batchesService = new BatchesService(conflictService, auditService);
    sessionsService = new SessionsService(conflictService, auditService);

    // 1. Create Tenant A
    const orgA = await prisma.organization.create({
      data: {
        name: `Ananda Yoga Studio ${Date.now()}`,
        slug: `ananda-yoga-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    // 2. Create Tenant B
    const orgB = await prisma.organization.create({
      data: {
        name: `Prana Yoga Hub ${Date.now()}`,
        slug: `prana-yoga-${Date.now()}`,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 3. Create Branches
    const bA = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Indiranagar Main',
        slug: `indiranagar-${Date.now()}`,
        streetAddress: '100 Feet Road, HAL 2nd Stage',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560038',
        phone: '+91 98765 43210',
        email: 'indiranagar@ananda.com',
      },
    });
    branchA = bA.id;

    const bB = await prisma.branch.create({
      data: {
        tenantId: tenantB,
        name: 'Koramangala Center',
        slug: `koramangala-${Date.now()}`,
        streetAddress: '80 Feet Road, 4th Block',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560034',
        phone: '+91 98765 43211',
        email: 'koramangala@prana.com',
      },
    });
    branchB = bB.id;

    // 4. Create Rooms
    const rA1 = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA,
        name: 'Shanti Hall',
        maxMatCapacity: 20,
      },
    });
    roomA1 = rA1.id;

    const rA2 = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA,
        name: 'Ananda Studio Mini',
        maxMatCapacity: 10,
      },
    });
    roomA2 = rA2.id;

    const rB1 = await prisma.room.create({
      data: {
        tenantId: tenantB,
        branchId: branchB,
        name: 'Surya Hall',
        maxMatCapacity: 25,
      },
    });
    roomB1 = rB1.id;

    // 5. Create Owner user for Tenant A
    const ownerA = await prisma.user.create({
      data: {
        fullName: 'Aarav Sharma',
        email: `aarav.${Date.now()}@ananda.com`,
      },
    });
    userOwnerA = ownerA.id;
    createdUserIds.push(userOwnerA);
    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userOwnerA,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });

    // 6. Create Multi-Studio Instructor (Member of BOTH Tenant A and Tenant B)
    const multiInstructor = await prisma.user.create({
      data: {
        fullName: 'Devi Priya',
        email: `devi.priya.${Date.now()}@yogaos.com`,
      },
    });
    userInstructorMulti = multiInstructor.id;
    createdUserIds.push(userInstructorMulti);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userInstructorMulti,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: userInstructorMulti,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    // 7. Create Instructor only in Tenant A
    const instA2 = await prisma.user.create({
      data: {
        fullName: 'Rohan Mehra',
        email: `rohan.${Date.now()}@ananda.com`,
      },
    });
    userInstructorA2 = instA2.id;
    createdUserIds.push(userInstructorA2);
    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userInstructorA2,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    // Cascade delete test organizations and users
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

  describe('1. Class Types & Programs (CRUD & Isolation)', () => {
    let createdClassTypeId: string;

    it('should create a new tenant-scoped class type', async () => {
      const created = await classTypesService.createClassType(
        tenantA,
        {
          name: 'Traditional Hatha Yoga',
          description: 'Classical asanas and pranayama breathing techniques',
          category: 'Hatha',
          level: 'ALL_LEVELS',
          defaultDurationMins: 60,
          defaultCapacity: 15,
        },
        userOwnerA
      );

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Traditional Hatha Yoga');
      expect(created.level).toBe('ALL_LEVELS');
      expect(created.defaultCapacity).toBe(15);
      expect(created.isActive).toBe(true);
      createdClassTypeId = created.id;
    });

    it('should list class types with filtering and pagination', async () => {
      const result = await classTypesService.getClassTypes(tenantA, {
        search: 'Traditional',
        level: 'ALL_LEVELS',
        page: 1,
        limit: 10,
      });

      expect(result.classTypes.length).toBeGreaterThanOrEqual(1);
      expect(result.classTypes[0].name).toContain('Traditional');
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('should prevent cross-tenant access to class types', async () => {
      // Tenant B trying to fetch Tenant A's class type must fail with NotFoundException
      await expect(
        classTypesService.getClassType(tenantB, createdClassTypeId)
      ).rejects.toThrow(NotFoundException);

      // Tenant B trying to update Tenant A's class type must fail
      await expect(
        classTypesService.updateClassType(
          tenantB,
          createdClassTypeId,
          { name: 'Hijacked Class' },
          'random-user'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should archive a class type safely', async () => {
      await classTypesService.archiveClassType(tenantA, createdClassTypeId, userOwnerA);
      const record = await prisma.classType.findUnique({ where: { id: createdClassTypeId } });
      expect(record?.isActive).toBe(false);
      expect(record?.deletedAt).not.toBeNull();
    });
  });

  describe('2. Batches & Class Groups (Capacity & Session Generation)', () => {
    let classTypeA: string;
    let batchAId: string;

    beforeAll(async () => {
      const ct = await classTypesService.createClassType(
        tenantA,
        {
          name: 'Vinyasa Flow',
          category: 'Vinyasa',
          level: 'INTERMEDIATE',
          defaultDurationMins: 60,
          defaultCapacity: 12,
        },
        userOwnerA
      );
      classTypeA = ct.id;
    });

    it('should reject batch creation when capacity exceeds room maxMatCapacity', async () => {
      // Room A2 max capacity is 10; requesting 15 must throw BadRequestException
      await expect(
        batchesService.createBatch(
          tenantA,
          {
            name: 'Overcapacity Batch',
            classTypeId: classTypeA,
            branchId: branchA,
            roomId: roomA2, // max 10
            instructorId: userInstructorMulti,
            daysOfWeek: [1, 3, 5],
            startTime: '07:00',
            endTime: '08:00',
            startDate: new Date('2026-12-01T00:00:00Z').toISOString(),
            capacity: 15, // exceeds 10!
          },
          userOwnerA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject batch creation when startTime >= endTime', async () => {
      await expect(
        batchesService.createBatch(
          tenantA,
          {
            name: 'Invalid Timing Batch',
            classTypeId: classTypeA,
            branchId: branchA,
            roomId: roomA1,
            instructorId: userInstructorMulti,
            daysOfWeek: [1, 3, 5],
            startTime: '09:00',
            endTime: '08:00', // invalid!
            startDate: new Date('2026-12-01T00:00:00Z').toISOString(),
            capacity: 10,
          },
          userOwnerA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an active batch and automatically generate initial 30 days of sessions', async () => {
      // Schedule Mon, Wed, Fri (1, 3, 5) at 07:00-08:00 IST in room A1 with userInstructorMulti
      const startDate = new Date('2026-12-01T00:00:00Z'); // 2026-12-01 is Tuesday
      const batch = await batchesService.createBatch(
        tenantA,
        {
          name: 'Morning Sunrise Vinyasa',
          classTypeId: classTypeA,
          branchId: branchA,
          roomId: roomA1,
          instructorId: userInstructorMulti,
          daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
          startTime: '07:00',
          endTime: '08:00',
          startDate: startDate.toISOString(),
          capacity: 15,
        },
        userOwnerA
      );

      expect(batch).toBeDefined();
      expect(batch.id).toBeDefined();
      expect(batch.capacity).toBe(15);
      batchAId = batch.id;

      // Verify sessions were automatically generated for the next 30 days
      const sessions = await prisma.classSessionInstance.findMany({
        where: { batchId: batch.id },
        orderBy: { startTimestamp: 'asc' },
      });

      expect(sessions.length).toBeGreaterThanOrEqual(12); // ~13 sessions in 30 days for 3 days/week
      expect(sessions[0].status).toBe(SessionStatus.SCHEDULED);
      expect(sessions[0].instructorId).toBe(userInstructorMulti);
      expect(sessions[0].roomId).toBe(roomA1);
    });

    it('should be idempotent: re-generating sessions for the same range creates 0 duplicate instances', async () => {
      const upToDate = new Date('2026-12-31T23:59:59Z').toISOString();
      const res = await batchesService.generateSessions(tenantA, batchAId, upToDate, userOwnerA);
      expect(res.generatedCount).toBe(0);
    });

    it('should archive batch and automatically cancel all future sessions', async () => {
      await batchesService.archiveBatch(tenantA, batchAId, userOwnerA);
      const updatedBatch = await prisma.classBatch.findUnique({ where: { id: batchAId } });
      expect(updatedBatch?.status).toBe(BatchStatus.ARCHIVED);
      expect(updatedBatch?.deletedAt).not.toBeNull();

      // Verify future scheduled sessions are cancelled
      const activeFutureSessions = await prisma.classSessionInstance.count({
        where: {
          batchId: batchAId,
          status: SessionStatus.SCHEDULED,
        },
      });
      expect(activeFutureSessions).toBe(0);
    });
  });

  describe('3. Conflict Prevention (Room Overlap & Cross-Studio Instructor)', () => {
    let classTypeA: string;
    let classTypeB: string;

    beforeAll(async () => {
      const ctA = await classTypesService.createClassType(
        tenantA,
        {
          name: 'Ashtanga Primary',
          category: 'Ashtanga',
          level: 'ADVANCED',
          defaultDurationMins: 60,
          defaultCapacity: 10,
        },
        userOwnerA
      );
      classTypeA = ctA.id;

      const ctB = await classTypesService.createClassType(
        tenantB,
        {
          name: 'Pranayama & Meditation',
          category: 'Pranayama',
          level: 'ALL_LEVELS',
          defaultDurationMins: 60,
          defaultCapacity: 15,
        },
        userInstructorMulti
      );
      classTypeB = ctB.id;
    });

    it('should detect and prevent overlapping room bookings in the same studio', async () => {
      // 1. Create a 1-session batch or instance in Room A1 from 10:00 to 11:00 UTC on 2027-01-10
      const start1 = new Date('2027-01-10T10:00:00.000Z');
      const end1 = new Date('2027-01-10T11:00:00.000Z');

      await prisma.classSessionInstance.create({
        data: {
          tenantId: tenantA,
          classTypeId: classTypeA,
          branchId: branchA,
          roomId: roomA1,
          instructorId: userInstructorA2,
          sessionDate: new Date('2027-01-10T00:00:00.000Z'),
          startTimestamp: start1,
          endTimestamp: end1,
          capacity: 10,
          status: SessionStatus.SCHEDULED,
        },
      });

      // 2. Room availability check for overlapping window (10:30 to 11:30) must throw ConflictException
      const overlappingStart = new Date('2027-01-10T10:30:00.000Z');
      const overlappingEnd = new Date('2027-01-10T11:30:00.000Z');

      await expect(
        conflictService.validateRoomAvailability(roomA1, overlappingStart, overlappingEnd)
      ).rejects.toThrow(ConflictException);

      // 3. Non-overlapping window (11:00 to 12:00) must succeed
      const nonOverlappingStart = new Date('2027-01-10T11:00:00.000Z');
      const nonOverlappingEnd = new Date('2027-01-10T12:00:00.000Z');
      await expect(
        conflictService.validateRoomAvailability(roomA1, nonOverlappingStart, nonOverlappingEnd)
      ).resolves.not.toThrow();
    });

    it('should detect and prevent cross-studio instructor overlap WITHOUT leaking external studio information', async () => {
      // Scenario:
      // Devi Priya is booked for a session in Tenant A on 2027-02-05 from 08:00 to 09:00 UTC
      const startUtc = new Date('2027-02-05T08:00:00.000Z');
      const endUtc = new Date('2027-02-05T09:00:00.000Z');

      await prisma.classSessionInstance.create({
        data: {
          tenantId: tenantA,
          classTypeId: classTypeA,
          branchId: branchA,
          roomId: roomA1,
          instructorId: userInstructorMulti,
          sessionDate: new Date('2027-02-05T00:00:00.000Z'),
          startTimestamp: startUtc,
          endTimestamp: endUtc,
          capacity: 10,
          status: SessionStatus.SCHEDULED,
        },
      });

      // Now, Tenant B tries to book the same instructor Devi Priya at an overlapping time (08:30 to 09:30 UTC)
      const tenantBOverlapStart = new Date('2027-02-05T08:30:00.000Z');
      const tenantBOverlapEnd = new Date('2027-02-05T09:30:00.000Z');

      // The validation must reject with ConflictException without mentioning Tenant A
      try {
        await conflictService.validateInstructorAvailability(
          userInstructorMulti,
          tenantBOverlapStart,
          tenantBOverlapEnd
        );
        expect.unreachable('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.message).toContain('Instructor conflict');
        // Critical Privacy Guarantee: verify Tenant A or Ananda is NOT leaked in the error message
        expect(err.message).not.toContain(tenantA);
        expect(err.message).not.toContain('Ananda');
      }

      // But if Tenant B books Devi Priya at a non-overlapping time (09:30 to 10:30 UTC), it must succeed
      const nonOverlappingBStart = new Date('2027-02-05T09:30:00.000Z');
      const nonOverlappingBEnd = new Date('2027-02-05T10:30:00.000Z');
      await expect(
        conflictService.validateInstructorAvailability(
          userInstructorMulti,
          nonOverlappingBStart,
          nonOverlappingBEnd
        )
      ).resolves.not.toThrow();
    });
  });

  describe('4. Individual Session Management & Substitution', () => {
    let testSessionId: string;
    let classTypeA: string;

    beforeAll(async () => {
      const ctA = await classTypesService.createClassType(
        tenantA,
        {
          name: 'Restorative Nidra',
          category: 'Nidra',
          level: 'ALL_LEVELS',
          defaultDurationMins: 45,
          defaultCapacity: 8,
        },
        userOwnerA
      );
      classTypeA = ctA.id;

      const created = await prisma.classSessionInstance.create({
        data: {
          tenantId: tenantA,
          classTypeId: classTypeA,
          branchId: branchA,
          roomId: roomA2,
          instructorId: userInstructorA2,
          sessionDate: new Date('2027-03-01T00:00:00.000Z'),
          startTimestamp: new Date('2027-03-01T14:00:00.000Z'),
          endTimestamp: new Date('2027-03-01T14:45:00.000Z'),
          capacity: 8,
          status: SessionStatus.SCHEDULED,
        },
      });
      testSessionId = created.id;
    });

    it('should query calendar sessions within date range with filter params', async () => {
      const results = await sessionsService.getSessions(tenantA, {
        startDate: '2027-03-01T00:00:00.000Z',
        endDate: '2027-03-01T23:59:59.000Z',
        branchId: branchA,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      const found = results.find((s) => s.id === testSessionId);
      expect(found).toBeDefined();
      expect(found?.classTypeName).toBe('Restorative Nidra');
      expect(found?.capacity).toBe(8);
    });

    it('should allow substituting instructor on an individual session instance', async () => {
      // Substitute Rohan with Devi Priya
      const updated = await sessionsService.updateSession(
        tenantA,
        testSessionId,
        {
          instructorId: userInstructorMulti,
          notes: 'Instructor substituted for evening Nidra session',
        },
        userOwnerA
      );

      expect(updated.instructorId).toBe(userInstructorMulti);
      expect(updated.instructorName).toBe('Devi Priya');
      expect(updated.notes).toContain('substituted');
    });

    it('should cancel an individual session instance with a required reason', async () => {
      const cancelled = await sessionsService.cancelSession(
        tenantA,
        testSessionId,
        {
          cancellationReason: 'Studio electrical maintenance',
        },
        userOwnerA
      );

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Studio electrical maintenance');

      // Verify it cannot be updated while cancelled (unless reactivated)
      await expect(
        sessionsService.updateSession(
          tenantA,
          testSessionId,
          {
            notes: 'Attempted edit on cancelled session',
          },
          userOwnerA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce tenant isolation on session endpoints', async () => {
      // Tenant B cannot fetch Tenant A's session
      await expect(sessionsService.getSession(tenantB, testSessionId)).rejects.toThrow(
        NotFoundException
      );

      // Tenant B cannot update Tenant A's session
      await expect(
        sessionsService.updateSession(
          tenantB,
          testSessionId,
          { notes: 'Unauthorized edit' },
          'random-user'
        )
      ).rejects.toThrow(NotFoundException);

      // Tenant B cannot cancel Tenant A's session
      await expect(
        sessionsService.cancelSession(
          tenantB,
          testSessionId,
          { cancellationReason: 'Unauthorized cancel' },
          'random-user'
        )
      ).rejects.toThrow(NotFoundException);
    });
  });
});
