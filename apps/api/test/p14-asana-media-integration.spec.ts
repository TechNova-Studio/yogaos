import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'node:crypto';
import {
  prisma,
  UserRole,
  MemberStatus,
  AsanaCategory,
  AsanaDifficulty,
  AsanaStatus,
  MediaType,
  MediaStatus,
} from '@yogaos/database';
import { AsanaService } from '../src/modules/asana/asana.service.js';
import { MediaService } from '../src/modules/media/media.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('P14 Real Database Integration Tests (Asana Library & Media Management)', () => {
  let auditService: AuditService;
  let asanaService: AsanaService;
  let mediaService: MediaService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAsanaIds: string[] = [];
  const createdMediaIds: string[] = [];

  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;

  let mediaAssetA1: any;
  let mediaAssetA2: any;
  let mediaAssetB1: any;
  let customAsanaA: any;

  beforeAll(async () => {
    auditService = new AuditService();
    mediaService = new MediaService(auditService);
    asanaService = new AsanaService(auditService);

    // Setup Tenant A
    const orgA = await prisma.organization.create({
      data: {
        name: `P14 Shanti Yoga Studio ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p14-shanti-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    const uA = await prisma.user.create({
      data: {
        email: `shanti-owner-${crypto.randomUUID().slice(0, 8)}@test.yogaos`,
        fullName: 'Shanti Lead Teacher',
      },
    });
    userA = uA.id;
    createdUserIds.push(userA);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: userA,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });

    // Setup Tenant B
    const orgB = await prisma.organization.create({
      data: {
        name: `P14 Anand Yoga Studio ${crypto.randomUUID().slice(0, 6)}`,
        slug: `p14-anand-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    const uB = await prisma.user.create({
      data: {
        email: `anand-owner-${crypto.randomUUID().slice(0, 8)}@test.yogaos`,
        fullName: 'Anand Lead Teacher',
      },
    });
    userB = uB.id;
    createdUserIds.push(userB);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: userB,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    // Clean up created Asanas and Media
    if (createdAsanaIds.length > 0) {
      await prisma.asanaMedia.deleteMany({ where: { asanaId: { in: createdAsanaIds } } });
      await prisma.asana.deleteMany({ where: { id: { in: createdAsanaIds } } });
    }

    if (createdMediaIds.length > 0) {
      await prisma.asanaMedia.deleteMany({ where: { mediaAssetId: { in: createdMediaIds } } });
      await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
    }

    // Clean up Organizations and Users
    for (const orgId of createdOrgIds) {
      await prisma.organizationMember.deleteMany({ where: { tenantId: orgId } });
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }

    for (const userId of createdUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  describe('1. Classical Reference Library Seeding & Shared Visibility', () => {
    it('seeds classical asana reference library and is idempotent', async () => {
      const seedRes1 = await asanaService.seedClassicalAsanas();
      expect(seedRes1.success).toBe(true);

      // Verify classical poses exist in database
      const poses = await prisma.asana.findMany({
        where: { isSharedReference: true, deletedAt: null },
      });
      expect(poses.length).toBeGreaterThanOrEqual(10);

      // Verify idempotency
      const seedRes2 = await asanaService.seedClassicalAsanas();
      expect(seedRes2.success).toBe(true);
      expect(seedRes2.seededCount).toBe(0);
    });

    it('allows Tenant A and Tenant B to view shared classical postures', async () => {
      const tenantAList = await asanaService.getAsanas(tenantA, {
        includeShared: true,
      });
      expect(tenantAList.items.length).toBeGreaterThanOrEqual(10);

      const tenantBList = await asanaService.getAsanas(tenantB, {
        includeShared: true,
      });
      expect(tenantBList.items.length).toBeGreaterThanOrEqual(10);

      // Both see Downward-Facing Dog
      const adhoA = tenantAList.items.find((p) => p.englishName === 'Downward-Facing Dog');
      const adhoB = tenantBList.items.find((p) => p.englishName === 'Downward-Facing Dog');
      expect(adhoA).toBeDefined();
      expect(adhoB).toBeDefined();
      expect(adhoA?.id).toBe(adhoB?.id);
      expect(adhoA?.isSharedReference).toBe(true);
      expect(adhoA?.tenantId).toBeNull();
    });

    it('searches and filters postures by Sanskrit Devanagari, English, and Category', async () => {
      // Search by Devanagari Sanskrit
      const devanagariSearch = await asanaService.getAsanas(tenantA, {
        search: 'त्रिकोणासन',
      });
      expect(devanagariSearch.items.length).toBeGreaterThanOrEqual(1);
      expect(devanagariSearch.items[0].englishName).toBe('Triangle Pose');

      // Search by English
      const englishSearch = await asanaService.getAsanas(tenantA, {
        search: 'Warrior',
      });
      expect(englishSearch.items.length).toBeGreaterThanOrEqual(2);

      // Filter by Category
      const inversions = await asanaService.getAsanas(tenantA, {
        category: 'INVERSION',
      });
      expect(inversions.items.length).toBeGreaterThanOrEqual(1);
      expect(inversions.items.every((p) => p.category === 'INVERSION')).toBe(true);
    });
  });

  describe('2. Studio Custom Asana & Tenant Isolation', () => {
    it('creates studio custom asana for Tenant A', async () => {
      customAsanaA = await asanaService.createAsana(
        tenantA,
        {
          sanskritName: 'शान्तिप्रवाह',
          sanskritNameIast: 'Śāntipravāha',
          englishName: 'Shanti Studio Signature Flow',
          category: 'STANDING',
          difficulty: 'INTERMEDIATE',
          description: 'Proprietary sequence posture taught exclusively at Shanti Studio.',
          alignmentCues: 'Root through arches, lengthen thoracic spine.',
          anatomicalFocus: ['Hip flexors', 'Shoulder girdle'],
          benefits: ['Grounding', 'Thoracic mobility'],
          contraindications: ['Acute ankle strain'],
          tags: ['signature', 'exclusive'],
        },
        userA
      );

      expect(customAsanaA.id).toBeDefined();
      expect(customAsanaA.tenantId).toBe(tenantA);
      expect(customAsanaA.isSharedReference).toBe(false);
      createdAsanaIds.push(customAsanaA.id);

      // Verify in Tenant A's custom list
      const customListA = await asanaService.getAsanas(tenantA, { onlyCustom: true });
      expect(customListA.items.some((p) => p.id === customAsanaA.id)).toBe(true);
    });

    it('enforces tenant isolation: Tenant B cannot view or find Tenant A custom asana', async () => {
      // Tenant B listing custom poses should NOT see Tenant A custom pose
      const customListB = await asanaService.getAsanas(tenantB, { onlyCustom: true });
      expect(customListB.items.some((p) => p.id === customAsanaA.id)).toBe(false);

      // Tenant B direct get by ID must fail with NotFoundException
      await expect(asanaService.getAsana(tenantB, customAsanaA.id)).rejects.toThrow(
        NotFoundException
      );
    });

    it('enforces tenant isolation: Tenant B cannot update or archive Tenant A custom asana', async () => {
      // Update attempt
      await expect(
        asanaService.updateAsana(
          tenantB,
          customAsanaA.id,
          { englishName: 'Hacked Name by Tenant B' },
          userB
        )
      ).rejects.toThrow(ForbiddenException);

      // Archive attempt
      await expect(
        asanaService.archiveAsana(tenantB, customAsanaA.id, userB)
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents modification or archival of shared reference library poses by tenants', async () => {
      const poses = await prisma.asana.findMany({
        where: { isSharedReference: true, deletedAt: null },
        take: 1,
      });
      const sharedPose = poses[0];

      // Tenant A cannot update shared reference posture
      await expect(
        asanaService.updateAsana(tenantA, sharedPose.id, { englishName: 'Tampered Pose' }, userA)
      ).rejects.toThrow(ForbiddenException);

      // Tenant A cannot archive shared reference posture
      await expect(
        asanaService.archiveAsana(tenantA, sharedPose.id, userA)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Media Asset Management & Validation', () => {
    it('creates and records media assets for Tenant A with metadata tracking', async () => {
      mediaAssetA1 = await mediaService.createMedia(
        tenantA,
        {
          title: 'Shanti Downward Dog Demonstration',
          description: 'High-definition posture alignment photo',
          mediaType: 'IMAGE',
          fileName: 'shanti-adho-mukha.jpg',
          fileSize: 1024 * 750,
          mimeType: 'image/jpeg',
          storageKey: `studios/${tenantA}/images/shanti-adho-mukha.jpg`,
          url: 'https://storage.yogaos.app/shanti/adho-mukha.jpg',
        },
        userA
      );

      expect(mediaAssetA1.id).toBeDefined();
      expect(mediaAssetA1.tenantId).toBe(tenantA);
      expect(mediaAssetA1.mediaStatus).toBe(MediaStatus.READY);
      createdMediaIds.push(mediaAssetA1.id);

      mediaAssetA2 = await mediaService.createMedia(
        tenantA,
        {
          title: 'Shanti Pranayama Breath Guidance',
          description: 'Audio guidance recording for ujjayi breathing',
          mediaType: 'AUDIO',
          fileName: 'shanti-ujjayi.mp3',
          fileSize: 1024 * 1024 * 12,
          mimeType: 'audio/mpeg',
          storageKey: `studios/${tenantA}/audio/shanti-ujjayi.mp3`,
          url: 'https://storage.yogaos.app/shanti/ujjayi.mp3',
          durationSeconds: 600,
        },
        userA
      );

      expect(mediaAssetA2.id).toBeDefined();
      expect(mediaAssetA2.durationSeconds).toBe(600);
      createdMediaIds.push(mediaAssetA2.id);
    });

    it('creates media asset for Tenant B', async () => {
      mediaAssetB1 = await mediaService.createMedia(
        tenantB,
        {
          title: 'Anand Studio Vinyasa Video',
          description: 'Teacher demonstration video',
          mediaType: 'VIDEO',
          fileName: 'anand-vinyasa.mp4',
          fileSize: 1024 * 1024 * 40,
          mimeType: 'video/mp4',
          storageKey: `studios/${tenantB}/video/anand-vinyasa.mp4`,
          url: 'https://storage.yogaos.app/anand/vinyasa.mp4',
          durationSeconds: 1200,
        },
        userB
      );

      expect(mediaAssetB1.id).toBeDefined();
      expect(mediaAssetB1.tenantId).toBe(tenantB);
      createdMediaIds.push(mediaAssetB1.id);
    });

    it('replaces media file without breaking database references', async () => {
      const replaced = await mediaService.replaceMedia(
        tenantA,
        mediaAssetA1.id,
        {
          fileName: 'shanti-adho-mukha-v2.jpg',
          fileSize: 1024 * 850,
          mimeType: 'image/jpeg',
          storageKey: `studios/${tenantA}/images/shanti-adho-mukha-v2.jpg`,
          url: 'https://storage.yogaos.app/shanti/adho-mukha-v2.jpg',
        },
        userA
      );

      expect(replaced.id).toBe(mediaAssetA1.id);
      expect(replaced.fileName).toBe('shanti-adho-mukha-v2.jpg');
      expect(replaced.fileSize).toBe(1024 * 850);
    });

    it('enforces tenant isolation: Tenant B cannot replace or archive Tenant A media', async () => {
      // Tenant B attempting to replace Tenant A's media
      await expect(
        mediaService.replaceMedia(
          tenantB,
          mediaAssetA1.id,
          {
            fileName: 'malicious.jpg',
            fileSize: 1024,
            mimeType: 'image/jpeg',
            storageKey: 'key',
            url: 'url',
          },
          userB
        )
      ).rejects.toThrow(NotFoundException);

      // Tenant B attempting to archive Tenant A's media
      await expect(
        mediaService.archiveMedia(tenantB, mediaAssetA1.id, userB)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Cross-Tenant Media Association Prevention & AsanaMedia Linking', () => {
    it('strictly forbids Tenant B from associating Tenant A media with its asana', async () => {
      // Create custom posture for Tenant B
      const asanaB = await asanaService.createAsana(
        tenantB,
        {
          sanskritName: 'आनन्दप्रवाह',
          englishName: 'Anand Studio Flow',
          category: 'STANDING',
        },
        userB
      );
      createdAsanaIds.push(asanaB.id);

      // Tenant B tries to associate Tenant A's media asset -> FORBIDDEN!
      await expect(
        asanaService.associateMedia(
          tenantB,
          asanaB.id,
          { mediaAssetId: mediaAssetA1.id },
          userB
        )
      ).rejects.toThrow(ForbiddenException);

      // Tenant B tries to create asana setting primaryMediaId to Tenant A's media -> FORBIDDEN!
      await expect(
        asanaService.createAsana(
          tenantB,
          {
            sanskritName: 'चोरीप्रवाह',
            englishName: 'Unauthorized Posture',
            category: 'STANDING',
            primaryMediaId: mediaAssetA1.id,
          },
          userB
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('associates and retrieves multi-media assets on Tenant A posture', async () => {
      // Associate mediaAssetA1 to customAsanaA
      const assoc1 = await asanaService.associateMedia(
        tenantA,
        customAsanaA.id,
        {
          mediaAssetId: mediaAssetA1.id,
          caption: 'Alignment cue: extend arms firmly',
          sortOrder: 1,
          isFeatured: true,
        },
        userA
      );
      expect(assoc1.asanaId).toBe(customAsanaA.id);
      expect(assoc1.mediaAssetId).toBe(mediaAssetA1.id);

      // Associate mediaAssetA2 to customAsanaA
      const assoc2 = await asanaService.associateMedia(
        tenantA,
        customAsanaA.id,
        {
          mediaAssetId: mediaAssetA2.id,
          caption: 'Audio pacing for posture holding',
          sortOrder: 2,
        },
        userA
      );
      expect(assoc2.sortOrder).toBe(2);

      // Retrieve full asana details with media list
      const detailed = await asanaService.getAsana(tenantA, customAsanaA.id);
      expect(detailed.mediaList.length).toBe(2);
      expect(detailed.mediaList[0].mediaAsset.id).toBe(mediaAssetA1.id);
      expect(detailed.mediaList[1].mediaAsset.id).toBe(mediaAssetA2.id);

      // Remove media association
      const removeRes = await asanaService.removeMedia(
        tenantA,
        customAsanaA.id,
        mediaAssetA2.id,
        userA
      );
      expect(removeRes.success).toBe(true);

      const afterRemove = await asanaService.getAsana(tenantA, customAsanaA.id);
      expect(afterRemove.mediaList.length).toBe(1);
      expect(afterRemove.mediaList[0].mediaAsset.id).toBe(mediaAssetA1.id);
    });
  });
});
