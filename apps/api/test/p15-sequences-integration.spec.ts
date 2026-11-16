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
} from '@yogaos/database';
import { SequencesService } from '../src/modules/sequences/sequences.service.js';
import { AsanaService } from '../src/modules/asana/asana.service.js';
import { MediaService } from '../src/modules/media/media.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('P15 Real Database Integration Tests (Instructor Sequence Builder)', () => {
  let auditService: AuditService;
  let sequencesService: SequencesService;
  let asanaService: AsanaService;
  let mediaService: MediaService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAsanaIds: string[] = [];
  const createdMediaIds: string[] = [];
  const createdSequenceIds: string[] = [];

  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;

  let classicalAsana1: any;
  let customAsanaA: any;
  let customAsanaB: any;

  let mediaAssetA1: any;
  let mediaAssetB1: any;

  let createdSequenceA: any;

  beforeAll(async () => {
    auditService = new AuditService();
    sequencesService = new SequencesService(auditService);
    asanaService = new AsanaService(auditService);
    mediaService = new MediaService(auditService);

    // Setup Tenant A (Moksha Studio)
    const orgA = await prisma.organization.create({
      data: {
        name: `P15 Moksha Yoga Studio ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p15-moksha-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    const uA = await prisma.user.create({
      data: {
        email: `moksha-instructor-${crypto.randomUUID().slice(0, 8)}@test.yogaos`,
        fullName: 'Moksha Lead Teacher',
      },
    });
    userA = uA.id;
    createdUserIds.push(userA);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userA,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    // Setup Tenant B (Nirvana Studio)
    const orgB = await prisma.organization.create({
      data: {
        name: `P15 Nirvana Yoga Studio ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p15-nirvana-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    const uB = await prisma.user.create({
      data: {
        email: `nirvana-instructor-${crypto.randomUUID().slice(0, 8)}@test.yogaos`,
        fullName: 'Nirvana Lead Teacher',
      },
    });
    userB = uB.id;
    createdUserIds.push(userB);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: userB,
        role: UserRole.INSTRUCTOR,
        status: MemberStatus.ACTIVE,
      },
    });

    // Seed Classical Posers
    await asanaService.seedClassicalAsanas();
    const classical = await prisma.asana.findFirst({
      where: { isSharedReference: true, deletedAt: null },
    });
    classicalAsana1 = classical;

    // Create Custom Asana for Tenant A
    customAsanaA = await asanaService.createAsana(
      tenantA,
      {
        sanskritName: 'मोक्षप्रवाह',
        englishName: 'Moksha Signature Opener',
        category: 'STANDING',
      },
      userA
    );
    createdAsanaIds.push(customAsanaA.id);

    // Create Custom Asana for Tenant B
    customAsanaB = await asanaService.createAsana(
      tenantB,
      {
        sanskritName: 'निर्वाणआसन',
        englishName: 'Nirvana Secret Pose',
        category: 'SEATED',
      },
      userB
    );
    createdAsanaIds.push(customAsanaB.id);

    // Create Media Asset for Tenant A
    mediaAssetA1 = await mediaService.createMedia(
      tenantA,
      {
        title: 'Moksha Voice Guidance Cue',
        mediaType: 'AUDIO',
        fileName: 'moksha-guidance.mp3',
        fileSize: 1024 * 500,
        mimeType: 'audio/mpeg',
        storageKey: `studios/${tenantA}/audio/moksha.mp3`,
        url: 'https://storage.yogaos.app/moksha/audio.mp3',
      },
      userA
    );
    createdMediaIds.push(mediaAssetA1.id);

    // Create Media Asset for Tenant B
    mediaAssetB1 = await mediaService.createMedia(
      tenantB,
      {
        title: 'Nirvana Video Demo',
        mediaType: 'VIDEO',
        fileName: 'nirvana-video.mp4',
        fileSize: 1024 * 1024 * 10,
        mimeType: 'video/mp4',
        storageKey: `studios/${tenantB}/video/nirvana.mp4`,
        url: 'https://storage.yogaos.app/nirvana/video.mp4',
      },
      userB
    );
    createdMediaIds.push(mediaAssetB1.id);
  });

  afterAll(async () => {
    // Clean up created Sequences
    if (createdSequenceIds.length > 0) {
      await prisma.sequenceStep.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.sequenceVersion.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.sequence.deleteMany({ where: { id: { in: createdSequenceIds } } });
    }

    // Clean up Asanas & Media
    if (createdAsanaIds.length > 0) {
      await prisma.asana.deleteMany({ where: { id: { in: createdAsanaIds } } });
    }
    if (createdMediaIds.length > 0) {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
    }

    // Clean up Organizations & Members
    for (const orgId of createdOrgIds) {
      await prisma.organizationMember.deleteMany({ where: { tenantId: orgId } });
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }

    for (const userId of createdUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  describe('1. Sequence Creation, Composition & Tenant Isolation', () => {
    it('creates class sequence in DRAFT with steps referencing classical and custom asanas', async () => {
      createdSequenceA = await sequencesService.createSequence(
        tenantA,
        {
          title: 'Moksha Morning Solar Flow',
          description: 'A dynamic flow sequence blending classical and studio variations.',
          objective: 'Awaken core and thoracic mobility',
          targetLevel: 'INTERMEDIATE',
          intendedAudience: 'Intermediate practitioners',
          isStudioTemplate: true,
          tags: ['solar', 'morning', 'core'],
          steps: [
            {
              stepOrder: 1,
              asanaId: classicalAsana1.id, // Shared reference asana
              executionMode: 'TIME_HOLD',
              durationSeconds: 60,
              isBilateral: false,
              restIntervalSeconds: 15,
              cues: 'Root palms flat, lengthen spine',
              voiceAudioMediaId: mediaAssetA1.id,
            },
            {
              stepOrder: 2,
              asanaId: customAsanaA.id, // Tenant A custom asana
              executionMode: 'TIME_HOLD',
              durationSeconds: 45,
              isBilateral: true, // Bilateral doubling: 45s * 2 = 90s hold
              restIntervalSeconds: 10,
              cues: 'Engage bandhas on each side equally',
            },
          ],
        },
        userA
      );

      expect(createdSequenceA.id).toBeDefined();
      expect(createdSequenceA.status).toBe(SequenceStatus.DRAFT);
      expect(createdSequenceA.activeVersion).toBe(1);
      // Step 1: 60s + 15s = 75s; Step 2: (45s * 2) + 10s = 100s. Total: 175s
      expect(createdSequenceA.estimatedTotalDurationSecs).toBe(175);
      createdSequenceIds.push(createdSequenceA.id);

      // Verify sequence details with active version and steps
      const detailed = await sequencesService.getSequence(tenantA, createdSequenceA.id);
      expect(detailed.activeVersionDetails.versionNumber).toBe(1);
      expect(detailed.activeVersionDetails.steps.length).toBe(2);
      expect(detailed.activeVersionDetails.steps[0].asanaId).toBe(classicalAsana1.id);
      expect(detailed.activeVersionDetails.steps[0].voiceAudioMediaId).toBe(mediaAssetA1.id);
      expect(detailed.activeVersionDetails.steps[1].isBilateral).toBe(true);
      expect(detailed.activeVersionDetails.steps[1].asanaNameSnapshot).toBe('Moksha Signature Opener');
    });

    it('enforces tenant isolation: Tenant B cannot view or access Tenant A sequence', async () => {
      // Direct get attempt by Tenant B fails
      await expect(
        sequencesService.getSequence(tenantB, createdSequenceA.id)
      ).rejects.toThrow(NotFoundException);

      // Sequence listing for Tenant B does not contain Tenant A sequence
      const listB = await sequencesService.listSequences(tenantB, {});
      expect(listB.items.some((s) => s.id === createdSequenceA.id)).toBe(false);
    });

    it('enforces tenant isolation: Tenant B cannot update, duplicate, publish or archive Tenant A sequence', async () => {
      // Update attempt
      await expect(
        sequencesService.updateSequence(
          tenantB,
          createdSequenceA.id,
          { title: 'Malicious Hijack' },
          userB
        )
      ).rejects.toThrow(NotFoundException);

      // Duplicate attempt
      await expect(
        sequencesService.duplicateSequence(tenantB, createdSequenceA.id, userB)
      ).rejects.toThrow(NotFoundException);

      // Publish attempt
      await expect(
        sequencesService.publishSequence(tenantB, createdSequenceA.id, {}, userB)
      ).rejects.toThrow(NotFoundException);

      // Archive attempt
      await expect(
        sequencesService.archiveSequence(tenantB, createdSequenceA.id, userB)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Step Reordering & Persistence', () => {
    it('reorders sequence steps transactionally and updates order', async () => {
      const detailed = await sequencesService.getSequence(tenantA, createdSequenceA.id);
      const step1 = detailed.activeVersionDetails.steps[0];
      const step2 = detailed.activeVersionDetails.steps[1];

      // Reorder: swap step 2 to first, step 1 to second
      const reorderRes = await sequencesService.reorderSteps(
        tenantA,
        createdSequenceA.id,
        { stepIds: [step2.id, step1.id] },
        userA
      );

      expect(reorderRes.success).toBe(true);
      expect(reorderRes.reorderedCount).toBe(2);

      // Verify new order in database
      const refreshed = await sequencesService.getSequence(tenantA, createdSequenceA.id);
      expect(refreshed.activeVersionDetails.steps[0].id).toBe(step2.id);
      expect(refreshed.activeVersionDetails.steps[0].stepOrder).toBe(1);
      expect(refreshed.activeVersionDetails.steps[1].id).toBe(step1.id);
      expect(refreshed.activeVersionDetails.steps[1].stepOrder).toBe(2);
    });
  });

  describe('3. Draft to Published Lifecycle & Media Manifest', () => {
    it('publishes sequence, locks version 1, and compiles mediaManifest', async () => {
      const published = await sequencesService.publishSequence(
        tenantA,
        createdSequenceA.id,
        { notes: 'Ready for class conductor execution' },
        userA
      );

      expect(published.status).toBe(SequenceStatus.PUBLISHED);
      expect(published.activeVersionDetails.status).toBe(SequenceStatus.PUBLISHED);
      expect(published.activeVersionDetails.publishedAt).toBeDefined();

      // Verify media manifest was compiled from attached media assets
      const manifest = published.activeVersionDetails.mediaManifest as any[];
      expect(Array.isArray(manifest)).toBe(true);
      expect(manifest.length).toBeGreaterThanOrEqual(1);
      expect(manifest.some((m) => m.assetId === mediaAssetA1.id)).toBe(true);
    });

    it('rejects publishing a sequence with 0 steps', async () => {
      const emptySequence = await sequencesService.createSequence(
        tenantA,
        {
          title: 'Empty Sequence Test',
          steps: [],
        },
        userA
      );
      createdSequenceIds.push(emptySequence.id);

      await expect(
        sequencesService.publishSequence(tenantA, emptySequence.id, {}, userA)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Version Immutability (Forking Published Sequences on Edit)', () => {
    it('forks into a new DRAFT version 2 when editing a published sequence, keeping version 1 intact', async () => {
      const updated = await sequencesService.updateSequence(
        tenantA,
        createdSequenceA.id,
        {
          title: 'Moksha Morning Solar Flow (Revised)',
          description: 'Updated with extended cooling phase',
        },
        userA
      );

      // Sequence active version incremented to 2 and reverted to DRAFT
      expect(updated.activeVersion).toBe(2);
      expect(updated.status).toBe(SequenceStatus.DRAFT);
      expect(updated.title).toBe('Moksha Morning Solar Flow (Revised)');

      // Verify that version 1 remains PUBLISHED in the database
      const v1 = await prisma.sequenceVersion.findUnique({
        where: {
          tenantId_sequenceId_versionNumber: {
            tenantId: tenantA,
            sequenceId: createdSequenceA.id,
            versionNumber: 1,
          },
        },
      });
      expect(v1?.status).toBe(SequenceStatus.PUBLISHED);

      // Verify that version 2 exists in DRAFT
      const v2 = await prisma.sequenceVersion.findUnique({
        where: {
          tenantId_sequenceId_versionNumber: {
            tenantId: tenantA,
            sequenceId: createdSequenceA.id,
            versionNumber: 2,
          },
        },
      });
      expect(v2?.status).toBe(SequenceStatus.DRAFT);
    });
  });

  describe('5. Duplicate Sequence Workflow', () => {
    it('creates a fresh DRAFT sequence copy with cloned steps and resets version to 1', async () => {
      const duplicated = await sequencesService.duplicateSequence(
        tenantA,
        createdSequenceA.id,
        userA
      );

      expect(duplicated.id).toBeDefined();
      expect(duplicated.id).not.toBe(createdSequenceA.id);
      expect(duplicated.title).toBe('Moksha Morning Solar Flow (Revised) (Copy)');
      expect(duplicated.status).toBe(SequenceStatus.DRAFT);
      expect(duplicated.activeVersion).toBe(1);
      createdSequenceIds.push(duplicated.id);

      // Verify steps were cloned
      const detailedCopy = await sequencesService.getSequence(tenantA, duplicated.id);
      expect(detailedCopy.activeVersionDetails.steps.length).toBe(2);
    });
  });

  describe('6. Cross-Tenant Resource Association Prevention', () => {
    it('strictly forbids Tenant B from referencing Tenant A custom asana in a sequence step', async () => {
      await expect(
        sequencesService.createSequence(
          tenantB,
          {
            title: 'Unauthorized Sequence with Tenant A Asana',
            steps: [
              {
                stepOrder: 1,
                asanaId: customAsanaA.id, // Belongs to Tenant A!
                durationSeconds: 30,
              },
            ],
          },
          userB
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('strictly forbids Tenant B from referencing Tenant A media asset in a sequence step', async () => {
      await expect(
        sequencesService.createSequence(
          tenantB,
          {
            title: 'Unauthorized Sequence with Tenant A Media',
            steps: [
              {
                stepOrder: 1,
                asanaId: classicalAsana1.id,
                durationSeconds: 30,
                voiceAudioMediaId: mediaAssetA1.id, // Belongs to Tenant A!
              },
            ],
          },
          userB
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('7. Archival & Historical Integrity Retention', () => {
    it('archives sequence while preserving historical versions and step snapshots', async () => {
      const archiveRes = await sequencesService.archiveSequence(
        tenantA,
        createdSequenceA.id,
        userA
      );

      expect(archiveRes.success).toBe(true);

      const archivedInDb = await prisma.sequence.findUnique({
        where: { id: createdSequenceA.id },
      });
      expect(archivedInDb?.status).toBe(SequenceStatus.ARCHIVED);
      expect(archivedInDb?.deletedAt).not.toBeNull();

      // Historical steps still retain snapshots
      const stepsInDb = await prisma.sequenceStep.findMany({
        where: { tenantId: tenantA },
      });
      expect(stepsInDb.some((s) => s.asanaNameSnapshot === 'Moksha Signature Opener')).toBe(true);
    });
  });
});
