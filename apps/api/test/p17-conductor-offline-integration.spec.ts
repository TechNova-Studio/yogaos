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
  MediaType,
  MediaStatus,
} from '@yogaos/database';
import { ConductorService } from '../src/modules/conductor/conductor.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('P17 Real Database Integration Tests (Conductor Offline Media & Playback)', () => {
  let auditService: AuditService;
  let conductorService: ConductorService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdRoomIds: string[] = [];
  const createdClassTypeIds: string[] = [];
  const createdSessionInstanceIds: string[] = [];
  const createdMediaIds: string[] = [];
  const createdAsanaIds: string[] = [];
  const createdSequenceIds: string[] = [];
  const createdConductorSessionIds: string[] = [];

  let tenantA: string;
  let tenantB: string;
  let ownerUserA: string;
  let instructorA1: string;
  let instructorA2: string;
  let instructorB1: string;

  let validMediaVideoA: any;
  let validMediaAudioA: any;
  let validMediaImageA: any;
  let crossTenantMediaB: any;
  let archivedMediaA: any;

  let sessionInstanceA1: string;
  let sessionInstanceCrossTenant: string;
  let sessionInstanceArchived: string;

  beforeAll(async () => {
    auditService = new AuditService();
    conductorService = new ConductorService(auditService);

    // 1. Setup Tenant A & Tenant B
    const orgA = await prisma.organization.create({
      data: {
        name: `P17 Sattva Yoga ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p17-sattva-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    const orgB = await prisma.organization.create({
      data: {
        name: `P17 Prana Hub ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p17-prana-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 2. Setup Users
    const ownerA = await prisma.user.create({
      data: {
        email: `owner.p17.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Owner P17',
        memberships: {
          create: { tenantId: tenantA, role: UserRole.OWNER, status: MemberStatus.ACTIVE },
        },
      },
    });
    ownerUserA = ownerA.id;
    createdUserIds.push(ownerUserA);

    const instA1 = await prisma.user.create({
      data: {
        email: `inst.a1.p17.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Instructor A1 P17',
        memberships: {
          create: { tenantId: tenantA, role: UserRole.INSTRUCTOR, status: MemberStatus.ACTIVE },
        },
      },
    });
    instructorA1 = instA1.id;
    createdUserIds.push(instructorA1);

    const instA2 = await prisma.user.create({
      data: {
        email: `inst.a2.p17.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Instructor A2 P17',
        memberships: {
          create: { tenantId: tenantA, role: UserRole.INSTRUCTOR, status: MemberStatus.ACTIVE },
        },
      },
    });
    instructorA2 = instA2.id;
    createdUserIds.push(instructorA2);

    const instB1 = await prisma.user.create({
      data: {
        email: `inst.b1.p17.${crypto.randomUUID()}@yogaos.test`,
        fullName: 'Instructor B1 P17',
        memberships: {
          create: { tenantId: tenantB, role: UserRole.INSTRUCTOR, status: MemberStatus.ACTIVE },
        },
      },
    });
    instructorB1 = instB1.id;
    createdUserIds.push(instructorB1);

    // 3. Studio Branch & Room in Tenant A
    const branchA = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Koramangala Studio',
        slug: `koramangala-${crypto.randomUUID().slice(0, 6)}`,
        streetAddress: '80 Feet Road, 4th Block',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        postalCode: '560034',
        phone: '+91 99000 77881',
        email: 'koramangala@sattvayoga.test',
      },
    });
    createdBranchIds.push(branchA.id);

    const roomA = await prisma.room.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        name: 'Ganga Hall',
        maxMatCapacity: 30,
      },
    });
    createdRoomIds.push(roomA.id);

    const classTypeA = await prisma.classType.create({
      data: {
        tenantId: tenantA,
        name: 'Vinyasa Flow P17',
        category: 'Vinyasa',
        level: 'ALL_LEVELS',
        defaultDurationMins: 60,
        defaultCapacity: 25,
      },
    });
    createdClassTypeIds.push(classTypeA.id);

    // 4. Create Media Assets with valid SHA-256 hashes
    validMediaVideoA = await prisma.mediaAsset.create({
      data: {
        tenantId: tenantA,
        uploadedByUserId: instructorA1,
        title: 'Warrior II Master Demonstration Video',
        mediaType: MediaType.VIDEO,
        mediaStatus: MediaStatus.READY,
        fileName: 'warrior2_demo.mp4',
        fileSize: 15420000,
        mimeType: 'video/mp4',
        storageKey: 'tenantA/videos/warrior2_demo.mp4',
        url: 'https://cdn.yogaos.test/tenantA/videos/warrior2_demo.mp4',
        sha256Hash: crypto.createHash('sha256').update('Warrior II Demo Video Bits').digest('hex'),
      },
    });
    createdMediaIds.push(validMediaVideoA.id);

    validMediaAudioA = await prisma.mediaAsset.create({
      data: {
        tenantId: tenantA,
        uploadedByUserId: instructorA1,
        title: 'Tadasana Breath & Alignment Guidance Audio',
        mediaType: MediaType.AUDIO,
        mediaStatus: MediaStatus.READY,
        fileName: 'tadasana_cues.mp3',
        fileSize: 3200000,
        mimeType: 'audio/mpeg',
        storageKey: 'tenantA/audio/tadasana_cues.mp3',
        url: 'https://cdn.yogaos.test/tenantA/audio/tadasana_cues.mp3',
        sha256Hash: crypto.createHash('sha256').update('Tadasana Voice Audio Bits').digest('hex'),
      },
    });
    createdMediaIds.push(validMediaAudioA.id);

    validMediaImageA = await prisma.mediaAsset.create({
      data: {
        tenantId: tenantA,
        uploadedByUserId: instructorA1,
        title: 'Tadasana High-Res Anatomical Reference Photo',
        mediaType: MediaType.IMAGE,
        mediaStatus: MediaStatus.READY,
        fileName: 'tadasana_alignment.jpg',
        fileSize: 1850000,
        mimeType: 'image/jpeg',
        storageKey: 'tenantA/images/tadasana_alignment.jpg',
        url: 'https://cdn.yogaos.test/tenantA/images/tadasana_alignment.jpg',
        sha256Hash: crypto.createHash('sha256').update('Tadasana Image Bits').digest('hex'),
      },
    });
    createdMediaIds.push(validMediaImageA.id);

    crossTenantMediaB = await prisma.mediaAsset.create({
      data: {
        tenantId: tenantB, // BELONGS TO TENANT B!
        uploadedByUserId: instructorB1,
        title: 'Tenant B Private Soundscape',
        mediaType: MediaType.AUDIO,
        mediaStatus: MediaStatus.READY,
        fileName: 'private_soundscape.mp3',
        fileSize: 5000000,
        mimeType: 'audio/mpeg',
        storageKey: 'tenantB/audio/private_soundscape.mp3',
        url: 'https://cdn.yogaos.test/tenantB/audio/private_soundscape.mp3',
        sha256Hash: crypto.createHash('sha256').update('Tenant B Audio Bits').digest('hex'),
      },
    });
    createdMediaIds.push(crossTenantMediaB.id);

    archivedMediaA = await prisma.mediaAsset.create({
      data: {
        tenantId: tenantA,
        uploadedByUserId: instructorA1,
        title: 'Archived Deprecated Demo Video',
        mediaType: MediaType.VIDEO,
        mediaStatus: MediaStatus.READY,
        fileName: 'deprecated_demo.mp4',
        fileSize: 8000000,
        mimeType: 'video/mp4',
        storageKey: 'tenantA/videos/deprecated_demo.mp4',
        url: 'https://cdn.yogaos.test/tenantA/videos/deprecated_demo.mp4',
        sha256Hash: crypto.createHash('sha256').update('Archived Bits').digest('hex'),
        isArchived: true, // ARCHIVED!
      },
    });
    createdMediaIds.push(archivedMediaA.id);

    // 5. Create Asana
    const asana = await prisma.asana.create({
      data: {
        tenantId: tenantA,
        createdByUserId: ownerUserA,
        sanskritName: 'Tadasana P17',
        sanskritNameIast: 'Tāḍāsana',
        englishName: 'Mountain Pose',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        status: AsanaStatus.PUBLISHED,
      },
    });
    createdAsanaIds.push(asana.id);

    // 6. Sequence 1 (Valid sequence with video, audio, image)
    const seq1 = await prisma.sequence.create({
      data: {
        tenantId: tenantA,
        creatorUserId: instructorA1,
        title: 'P17 Multimedia Class Flow',
        targetLevel: SequenceLevel.ALL_LEVELS,
        status: SequenceStatus.PUBLISHED,
        activeVersion: 1,
        estimatedTotalDurationSecs: 90,
        versions: {
          create: {
            tenantId: tenantA,
            versionNumber: 1,
            status: SequenceStatus.PUBLISHED,
            totalEstimatedDurationSecs: 90,
            publishedAt: new Date(),
            steps: {
              create: [
                {
                  tenantId: tenantA,
                  stepOrder: 1,
                  asanaId: asana.id,
                  asanaNameSnapshot: 'Mountain Pose',
                  sanskritNameSnapshot: 'Tāḍāsana',
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 30,
                  isBilateral: false,
                  referenceImageMediaId: validMediaImageA.id,
                  voiceAudioMediaId: validMediaAudioA.id, // Content mode: IMAGE_WITH_VOICE
                },
                {
                  tenantId: tenantA,
                  stepOrder: 2,
                  asanaId: asana.id,
                  asanaNameSnapshot: 'Warrior II',
                  sanskritNameSnapshot: 'Vīrabhadrāsana II',
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 45,
                  isBilateral: true,
                  demoVideoMediaId: validMediaVideoA.id, // Content mode: VIDEO
                },
              ],
            },
          },
        },
      },
      include: { versions: true },
    });
    createdSequenceIds.push(seq1.id);

    // 7. Sequence 2 (References Cross-Tenant Media Asset)
    const seqCrossTenant = await prisma.sequence.create({
      data: {
        tenantId: tenantA,
        creatorUserId: instructorA1,
        title: 'Tampered Cross-Tenant Sequence',
        targetLevel: SequenceLevel.ALL_LEVELS,
        status: SequenceStatus.PUBLISHED,
        activeVersion: 1,
        estimatedTotalDurationSecs: 60,
        versions: {
          create: {
            tenantId: tenantA,
            versionNumber: 1,
            status: SequenceStatus.PUBLISHED,
            totalEstimatedDurationSecs: 60,
            publishedAt: new Date(),
            steps: {
              create: [
                {
                  tenantId: tenantA,
                  stepOrder: 1,
                  asanaId: asana.id,
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 30,
                  voiceAudioMediaId: crossTenantMediaB.id, // CROSS TENANT!
                },
              ],
            },
          },
        },
      },
      include: { versions: true },
    });
    createdSequenceIds.push(seqCrossTenant.id);

    // 8. Sequence 3 (References Archived Media Asset)
    const seqArchived = await prisma.sequence.create({
      data: {
        tenantId: tenantA,
        creatorUserId: instructorA1,
        title: 'Broken Archived Media Sequence',
        targetLevel: SequenceLevel.ALL_LEVELS,
        status: SequenceStatus.PUBLISHED,
        activeVersion: 1,
        estimatedTotalDurationSecs: 60,
        versions: {
          create: {
            tenantId: tenantA,
            versionNumber: 1,
            status: SequenceStatus.PUBLISHED,
            totalEstimatedDurationSecs: 60,
            publishedAt: new Date(),
            steps: {
              create: [
                {
                  tenantId: tenantA,
                  stepOrder: 1,
                  asanaId: asana.id,
                  executionMode: ExecutionMode.TIME_HOLD,
                  durationSeconds: 30,
                  demoVideoMediaId: archivedMediaA.id, // ARCHIVED!
                },
              ],
            },
          },
        },
      },
      include: { versions: true },
    });
    createdSequenceIds.push(seqArchived.id);

    // 9. ClassSessionInstances
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
        attachedSequenceVersionId: seq1.versions[0].id,
      },
    });
    sessionInstanceA1 = s1.id;
    createdSessionInstanceIds.push(sessionInstanceA1);

    const sCross = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        roomId: roomA.id,
        classTypeId: classTypeA.id,
        instructorId: instructorA1,
        sessionDate: new Date(),
        startTimestamp: new Date(Date.now() + 10800000),
        endTimestamp: new Date(Date.now() + 14400000),
        capacity: 25,
        status: 'SCHEDULED',
        attachedSequenceVersionId: seqCrossTenant.versions[0].id,
      },
    });
    sessionInstanceCrossTenant = sCross.id;
    createdSessionInstanceIds.push(sessionInstanceCrossTenant);

    const sArchived = await prisma.classSessionInstance.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        roomId: roomA.id,
        classTypeId: classTypeA.id,
        instructorId: instructorA1,
        sessionDate: new Date(),
        startTimestamp: new Date(Date.now() + 18000000),
        endTimestamp: new Date(Date.now() + 21600000),
        capacity: 25,
        status: 'SCHEDULED',
        attachedSequenceVersionId: seqArchived.versions[0].id,
      },
    });
    sessionInstanceArchived = sArchived.id;
    createdSessionInstanceIds.push(sessionInstanceArchived);
  });

  afterAll(async () => {
    // Reverse dependency cleanup
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
    for (const mid of createdMediaIds) {
      await prisma.mediaAsset.delete({ where: { id: mid } }).catch(() => {});
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

  describe('1. Session Media Manifest Resolution & Content Modes', () => {
    it('resolves immutable media manifest with all required assets, checksums, and content modes', async () => {
      const manifest = await conductorService.getMediaManifest(
        tenantA,
        sessionInstanceA1,
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(manifest.sessionInstanceId).toBe(sessionInstanceA1);
      expect(manifest.totalAssetsCount).toBe(3); // Video, Audio, Image
      expect(manifest.totalBytes).toBe(
        validMediaVideoA.fileSize + validMediaAudioA.fileSize + validMediaImageA.fileSize
      );

      const videoAsset = manifest.assets.find((a) => a.assetId === validMediaVideoA.id);
      expect(videoAsset).toBeDefined();
      expect(videoAsset?.mediaType).toBe('VIDEO');
      expect(videoAsset?.contentMode).toBe('VIDEO');
      expect(videoAsset?.sha256Hash).toBe(validMediaVideoA.sha256Hash);

      const audioAsset = manifest.assets.find((a) => a.assetId === validMediaAudioA.id);
      expect(audioAsset).toBeDefined();
      expect(audioAsset?.mediaType).toBe('AUDIO');
      expect(audioAsset?.contentMode).toBe('IMAGE_WITH_VOICE');

      const imageAsset = manifest.assets.find((a) => a.assetId === validMediaImageA.id);
      expect(imageAsset).toBeDefined();
      expect(imageAsset?.mediaType).toBe('IMAGE');
    });

    it('allows OWNER to resolve media manifest for any session in their studio', async () => {
      const manifest = await conductorService.getMediaManifest(
        tenantA,
        sessionInstanceA1,
        ownerUserA,
        UserRole.OWNER
      );
      expect(manifest.totalAssetsCount).toBe(3);
    });
  });

  describe('2. Tenant Authorization & Security Boundaries', () => {
    it('denies unassigned instructor from accessing session media manifest', async () => {
      await expect(
        conductorService.getMediaManifest(
          tenantA,
          sessionInstanceA1,
          instructorA2, // Not assigned
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies cross-tenant user from accessing session media manifest', async () => {
      await expect(
        conductorService.getMediaManifest(
          tenantB, // Tenant B
          sessionInstanceA1,
          instructorB1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects media manifest resolution if sequence references cross-tenant media', async () => {
      await expect(
        conductorService.getMediaManifest(
          tenantA,
          sessionInstanceCrossTenant,
          instructorA1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects media manifest resolution if sequence references deleted/archived media', async () => {
      await expect(
        conductorService.getMediaManifest(
          tenantA,
          sessionInstanceArchived,
          instructorA1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Preparation Metadata Persistence & OFFLINE_READY Transitions', () => {
    let conductorSessionId: string;

    it('initializes conductor session and submits OFFLINE_READY preparation status', async () => {
      const session = await conductorService.initSession(
        tenantA,
        { sessionInstanceId: sessionInstanceA1 },
        instructorA1,
        UserRole.INSTRUCTOR
      );
      conductorSessionId = session.id;
      createdConductorSessionIds.push(conductorSessionId);

      expect(session.status).toBe('READY');
      expect(session.isOfflineReady).toBe(false);

      // Submit offline readiness
      const prepEventUuid = crypto.randomUUID();
      const preparedSession = await conductorService.submitPreparation(
        tenantA,
        sessionInstanceA1,
        {
          clientEventUuid: prepEventUuid,
          status: 'OFFLINE_READY',
          verifiedAssetsCount: 3,
          totalBytesVerified: 20470000,
          storageAvailableBytes: 1073741824, // 1GB
          clientTimestamp: new Date().toISOString(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(preparedSession.status).toBe('OFFLINE_READY');
      expect(preparedSession.isOfflineReady).toBe(true);
      expect(preparedSession.offlinePreparedAt).not.toBeNull();
      expect(preparedSession.preparationMetadata).toBeDefined();

      // Verify in DB
      const dbRecord = await prisma.conductorSession.findUnique({
        where: { id: conductorSessionId },
      });
      expect(dbRecord?.status).toBe('OFFLINE_READY');
      expect(dbRecord?.isOfflineReady).toBe(true);

      // Verify OFFLINE_READY event written
      const event = await prisma.conductorExecutionEvent.findFirst({
        where: { conductorSessionId, eventType: 'OFFLINE_READY' },
      });
      expect(event).not.toBeNull();
    });

    it('denies marking session OFFLINE_READY if verification errors are reported', async () => {
      await expect(
        conductorService.submitPreparation(
          tenantA,
          sessionInstanceA1,
          {
            clientEventUuid: crypto.randomUUID(),
            status: 'OFFLINE_READY',
            verificationErrors: ['Checksum mismatch on warrior2_demo.mp4'],
          },
          instructorA1,
          UserRole.INSTRUCTOR
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('records OFFLINE_VERIFICATION_FAILED when verification errors occur', async () => {
      const failedSession = await conductorService.submitPreparation(
        tenantA,
        sessionInstanceA1,
        {
          clientEventUuid: crypto.randomUUID(),
          status: 'VERIFICATION_FAILED',
          verificationErrors: ['Storage quota exceeded on client device'],
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(failedSession.isOfflineReady).toBe(false);

      const event = await prisma.conductorExecutionEvent.findFirst({
        where: { conductorSessionId, eventType: 'OFFLINE_VERIFICATION_FAILED' },
      });
      expect(event).not.toBeNull();
    });

    it('starts class seamlessly from OFFLINE_READY state into RUNNING', async () => {
      // First re-submit OFFLINE_READY
      await conductorService.submitPreparation(
        tenantA,
        sessionInstanceA1,
        {
          clientEventUuid: crypto.randomUUID(),
          status: 'OFFLINE_READY',
          verifiedAssetsCount: 3,
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      // Execute START
      const runningState = await conductorService.executeAction(
        tenantA,
        sessionInstanceA1,
        {
          action: 'START',
          clientEventUuid: crypto.randomUUID(),
        },
        instructorA1,
        UserRole.INSTRUCTOR
      );

      expect(runningState.status).toBe('RUNNING');
      expect(runningState.actualStartedAt).not.toBeNull();
    });
  });

  describe('4. Stale Session Heartbeat Invariant with OFFLINE_READY', () => {
    it('marks abandoned OFFLINE_READY session as INTERRUPTED_ABANDONED and NEVER COMPLETED', async () => {
      // Create session on sessionInstanceArchived
      const sess = await prisma.conductorSession.create({
        data: {
          tenantId: tenantA,
          sessionInstanceId: sessionInstanceArchived,
          sequenceVersionId: (await prisma.sequence.findUnique({ where: { id: createdSequenceIds[0] }, include: { versions: true } }))!.versions[0].id,
          conductorInstructorId: instructorA1,
          status: 'OFFLINE_READY',
          isOfflineReady: true,
          clientSessionUuid: crypto.randomUUID(),
          lastHeartbeatAt: new Date(Date.now() - 40 * 60 * 1000), // 40 mins ago
        },
      });
      createdConductorSessionIds.push(sess.id);

      const count = await conductorService.checkAbandonedSessions(tenantA, 30);
      expect(count).toBeGreaterThanOrEqual(1);

      const stale = await prisma.conductorSession.findUnique({ where: { id: sess.id } });
      expect(stale?.status).toBe('INTERRUPTED_ABANDONED');
      expect(stale?.status).not.toBe('COMPLETED');
    });
  });
});
