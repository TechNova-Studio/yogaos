import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { prisma, AsanaCategory, AsanaDifficulty, AsanaStatus } from '@yogaos/database';
import {
  CreateAsanaInput,
  UpdateAsanaInput,
  AsanaListQuery,
  AssociateAsanaMediaInput,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class AsanaService {
  constructor(private readonly audit: AuditService) {}

  async getAsanas(tenantId: string | null, query: AsanaListQuery) {
    const where: any = {
      deletedAt: null,
    };

    // Filter scope: tenant custom vs shared reference poses
    if (query.onlyCustom) {
      if (!tenantId) {
        throw new BadRequestException('Organization context is required for custom asana filtering');
      }
      where.tenantId = tenantId;
      where.isSharedReference = false;
    } else if (query.includeShared !== false) {
      if (tenantId) {
        where.OR = [
          { tenantId },
          { isSharedReference: true },
          { tenantId: null },
        ];
      } else {
        where.OR = [{ isSharedReference: true }, { tenantId: null }];
      }
    } else {
      if (tenantId) {
        where.tenantId = tenantId;
      }
    }

    if (query.category) {
      where.category = query.category as AsanaCategory;
    }

    if (query.difficulty) {
      where.difficulty = query.difficulty as AsanaDifficulty;
    }

    if (query.status) {
      where.status = query.status as AsanaStatus;
    }

    if (query.search) {
      const search = query.search.trim();
      const searchConditions = [
        { sanskritName: { contains: search, mode: 'insensitive' } },
        { sanskritNameIast: { contains: search, mode: 'insensitive' } },
        { englishName: { contains: search, mode: 'insensitive' } },
        { commonName: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];

      if (where.OR) {
        where.AND = [{ OR: searchConditions }];
      } else {
        where.OR = searchConditions;
      }
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.asana.count({ where }),
      prisma.asana.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isSharedReference: 'asc' }, { englishName: 'asc' }],
        include: {
          primaryMedia: {
            select: {
              id: true,
              title: true,
              url: true,
              thumbnailUrl: true,
              mediaType: true,
            },
          },
          mediaList: {
            take: 3,
            orderBy: { sortOrder: 'asc' },
            include: {
              mediaAsset: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  thumbnailUrl: true,
                  mediaType: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAsana(tenantId: string | null, id: string) {
    const asana = await prisma.asana.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: tenantId
          ? [{ tenantId }, { isSharedReference: true }, { tenantId: null }]
          : [{ isSharedReference: true }, { tenantId: null }],
      },
      include: {
        primaryMedia: true,
        mediaList: {
          orderBy: { sortOrder: 'asc' },
          include: {
            mediaAsset: true,
          },
        },
        createdByUser: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!asana) {
      throw new NotFoundException(`Asana with ID ${id} not found`);
    }

    return asana;
  }

  async createAsana(tenantId: string, data: CreateAsanaInput, userId: string) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required to create custom asana');
    }

    // If primary media is provided, verify it belongs to this tenant or is shared reference
    if (data.primaryMediaId) {
      const media = await prisma.mediaAsset.findFirst({
        where: { id: data.primaryMediaId, deletedAt: null },
      });

      if (!media) {
        throw new NotFoundException(`Primary media asset with ID ${data.primaryMediaId} not found`);
      }

      if (media.tenantId && media.tenantId !== tenantId) {
        throw new ForbiddenException('Cross-tenant media association denied: media belongs to another organization');
      }
    }

    const asana = await prisma.asana.create({
      data: {
        tenantId,
        createdByUserId: userId,
        sanskritName: data.sanskritName,
        sanskritNameIast: data.sanskritNameIast,
        englishName: data.englishName,
        commonName: data.commonName,
        description: data.description,
        instructions: data.instructions,
        alignmentCues: data.alignmentCues,
        category: data.category as AsanaCategory,
        difficulty: (data.difficulty as AsanaDifficulty) ?? AsanaDifficulty.BEGINNER,
        status: (data.status as AsanaStatus) ?? AsanaStatus.PUBLISHED,
        isSharedReference: false,
        anatomicalFocus: data.anatomicalFocus ?? [],
        benefits: data.benefits ?? [],
        contraindications: data.contraindications ?? [],
        cautions: data.cautions,
        prepPoses: data.prepPoses ?? [],
        followUpPoses: data.followUpPoses ?? [],
        variations: data.variations ?? [],
        tags: data.tags ?? [],
        primaryMediaId: data.primaryMediaId,
      },
      include: {
        primaryMedia: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ASANA_CREATED',
      resourceType: 'ASANA',
      resourceId: asana.id,
      details: {
        englishName: asana.englishName,
        sanskritName: asana.sanskritName,
        category: asana.category,
      },
    });

    return asana;
  }

  async updateAsana(tenantId: string, id: string, data: UpdateAsanaInput, userId: string) {
    const existing = await prisma.asana.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Asana with ID ${id} not found`);
    }

    if (existing.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: cannot modify shared reference library or another studio’s posture');
    }

    if (data.primaryMediaId && data.primaryMediaId !== existing.primaryMediaId) {
      const media = await prisma.mediaAsset.findFirst({
        where: { id: data.primaryMediaId, deletedAt: null },
      });

      if (!media) {
        throw new NotFoundException(`Media asset with ID ${data.primaryMediaId} not found`);
      }

      if (media.tenantId && media.tenantId !== tenantId) {
        throw new ForbiddenException('Cross-tenant media association denied: media belongs to another organization');
      }
    }

    const updated = await prisma.asana.update({
      where: { id },
      data: {
        sanskritName: data.sanskritName ?? existing.sanskritName,
        sanskritNameIast: data.sanskritNameIast !== undefined ? data.sanskritNameIast : existing.sanskritNameIast,
        englishName: data.englishName ?? existing.englishName,
        commonName: data.commonName !== undefined ? data.commonName : existing.commonName,
        description: data.description !== undefined ? data.description : existing.description,
        instructions: data.instructions !== undefined ? data.instructions : existing.instructions,
        alignmentCues: data.alignmentCues !== undefined ? data.alignmentCues : existing.alignmentCues,
        category: (data.category as AsanaCategory) ?? existing.category,
        difficulty: (data.difficulty as AsanaDifficulty) ?? existing.difficulty,
        status: (data.status as AsanaStatus) ?? existing.status,
        anatomicalFocus: data.anatomicalFocus ?? existing.anatomicalFocus,
        benefits: data.benefits ?? existing.benefits,
        contraindications: data.contraindications ?? existing.contraindications,
        cautions: data.cautions !== undefined ? data.cautions : existing.cautions,
        prepPoses: data.prepPoses ?? existing.prepPoses,
        followUpPoses: data.followUpPoses ?? existing.followUpPoses,
        variations: data.variations ?? existing.variations,
        tags: data.tags ?? existing.tags,
        primaryMediaId: data.primaryMediaId !== undefined ? data.primaryMediaId : existing.primaryMediaId,
      },
      include: {
        primaryMedia: true,
        mediaList: {
          include: { mediaAsset: true },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ASANA_UPDATED',
      resourceType: 'ASANA',
      resourceId: updated.id,
      details: {
        englishName: updated.englishName,
        status: updated.status,
      },
    });

    return updated;
  }

  async archiveAsana(tenantId: string, id: string, userId: string) {
    const existing = await prisma.asana.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Asana with ID ${id} not found`);
    }

    if (existing.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: cannot archive shared reference library or another studio’s posture');
    }

    const archived = await prisma.asana.update({
      where: { id },
      data: {
        status: AsanaStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ASANA_ARCHIVED',
      resourceType: 'ASANA',
      resourceId: archived.id,
      details: {
        englishName: archived.englishName,
      },
    });

    return { success: true, archived: true };
  }

  async associateMedia(
    tenantId: string,
    asanaId: string,
    data: AssociateAsanaMediaInput,
    userId: string
  ) {
    const asana = await prisma.asana.findFirst({
      where: { id: asanaId, deletedAt: null },
    });

    if (!asana) {
      throw new NotFoundException(`Asana with ID ${asanaId} not found`);
    }

    // Shared library poses cannot have studio media attached unless customized
    if (asana.tenantId && asana.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: cannot modify another studio’s asana');
    }

    const media = await prisma.mediaAsset.findFirst({
      where: { id: data.mediaAssetId, deletedAt: null },
    });

    if (!media) {
      throw new NotFoundException(`Media asset with ID ${data.mediaAssetId} not found`);
    }

    if (media.tenantId && media.tenantId !== tenantId) {
      throw new ForbiddenException('Cross-tenant media association denied: media belongs to another organization');
    }

    const association = await prisma.asanaMedia.upsert({
      where: {
        asanaId_mediaAssetId: {
          asanaId,
          mediaAssetId: data.mediaAssetId,
        },
      },
      create: {
        tenantId,
        asanaId,
        mediaAssetId: data.mediaAssetId,
        caption: data.caption,
        isFeatured: data.isFeatured ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
      update: {
        caption: data.caption,
        isFeatured: data.isFeatured ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
      include: {
        mediaAsset: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ASANA_MEDIA_ASSOCIATED',
      resourceType: 'ASANA',
      resourceId: asanaId,
      details: {
        mediaAssetId: data.mediaAssetId,
        caption: data.caption,
        sortOrder: data.sortOrder,
      },
    });

    return association;
  }

  async removeMedia(tenantId: string, asanaId: string, mediaAssetId: string, userId: string) {
    const asana = await prisma.asana.findFirst({
      where: { id: asanaId, deletedAt: null },
    });

    if (!asana) {
      throw new NotFoundException(`Asana with ID ${asanaId} not found`);
    }

    if (asana.tenantId && asana.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: cannot modify another studio’s asana');
    }

    const existingAssociation = await prisma.asanaMedia.findUnique({
      where: {
        asanaId_mediaAssetId: {
          asanaId,
          mediaAssetId,
        },
      },
    });

    if (!existingAssociation) {
      throw new NotFoundException(`Media association not found for asana ${asanaId} and media ${mediaAssetId}`);
    }

    await prisma.asanaMedia.delete({
      where: {
        asanaId_mediaAssetId: {
          asanaId,
          mediaAssetId,
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'ASANA_MEDIA_REMOVED',
      resourceType: 'ASANA',
      resourceId: asanaId,
      details: { mediaAssetId },
    });

    return { success: true, removed: true };
  }

  async seedClassicalAsanas() {
    const classicalPoses: Array<{
      sanskritName: string;
      sanskritNameIast: string;
      englishName: string;
      commonName?: string;
      category: AsanaCategory;
      difficulty: AsanaDifficulty;
      description: string;
      instructions: string;
      alignmentCues: string;
      anatomicalFocus: string[];
      benefits: string[];
      contraindications: string[];
      cautions?: string;
      tags: string[];
    }> = [
      {
        sanskritName: 'अधोमुखश्वानासन',
        sanskritNameIast: 'Adho Mukha Śvānāsana',
        englishName: 'Downward-Facing Dog',
        category: AsanaCategory.INVERSION,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'An inverted V-shape posture that energizes the body while stretching the hamstrings and strengthening shoulders.',
        instructions: 'From hands and knees, tuck toes and lift hips upward and backward. Press firmly into finger knuckles and lengthen spine.',
        alignmentCues: 'Spread fingers wide. Press chest toward thighs. Rotate upper arms outward. Soften knees if hamstrings are tight.',
        anatomicalFocus: ['Shoulders', 'Hamstrings', 'Calves', 'Spine'],
        benefits: ['Calms the nervous system', 'Stretches the back of the body', 'Strengthens arms and legs'],
        contraindications: ['Carpal tunnel syndrome', 'Late-term pregnancy', 'Severe high blood pressure'],
        cautions: 'Use blocks under hands or bend knees generously if wrists or hamstrings are strained.',
        tags: ['classical', 'foundation', 'inversion', 'standing', 'warmup'],
      },
      {
        sanskritName: 'त्रिकोणासन',
        sanskritNameIast: 'Trikoṇāsana',
        englishName: 'Triangle Pose',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'A standing lateral posture creating geometric stability through open hips, extended spine, and grounded feet.',
        instructions: 'Step feet 3.5 to 4 feet apart. Turn right foot 90 degrees out. Inhale extend arms parallel to floor, exhale hinge at right hip and reach forward before placing hand on shin, block, or floor.',
        alignmentCues: 'Anchor through outer heel of back foot. Keep both sides of waist long. Stack top shoulder over bottom shoulder.',
        anatomicalFocus: ['Hips', 'Hamstrings', 'Chest', 'Spine'],
        benefits: ['Improves digestion', 'Increases pelvic mobility', 'Strengthens ankles and knees'],
        contraindications: ['Low blood pressure', 'Neck issues (keep gaze forward or down)'],
        cautions: 'Avoid hyperextending front knee; use a slight micro-bend if hypermobile.',
        tags: ['classical', 'standing', 'lateral', 'hip-opening'],
      },
      {
        sanskritName: 'वीरभद्रासन १',
        sanskritNameIast: 'Vīrabhadrāsana I',
        englishName: 'Warrior I',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'A dynamic standing lunge embodying vigor, groundedness, and heart opening.',
        instructions: 'Step back foot 3-4 feet at a 45-degree angle. Square hips forward. Bend front knee to 90 degrees. Sweep arms overhead with palms facing each other.',
        alignmentCues: 'Track front knee directly over ankle. Ground through outer back heel. Draw front ribs gently in.',
        anatomicalFocus: ['Quadriceps', 'Hip flexors', 'Chest', 'Shoulders'],
        benefits: ['Builds focus and stamina', 'Opens hip flexors and chest', 'Strengthens back and legs'],
        contraindications: ['Recent knee injuries', 'Uncontrolled hypertension (keep hands on hips)'],
        tags: ['warrior', 'standing', 'strength', 'classical'],
      },
      {
        sanskritName: 'वीरभद्रासन २',
        sanskritNameIast: 'Vīrabhadrāsana II',
        englishName: 'Warrior II',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'A powerful lateral standing posture cultivating stamina, mental resilience, and hip abduction.',
        instructions: 'Wide stance 4 feet apart. Turn front toes 90 degrees, back foot parallel to back edge. Bend front knee to 90 degrees. Extend arms shoulder-height and gaze over front middle finger.',
        alignmentCues: 'Torso vertical over hips, not leaning forward. Front knee tracks toward second toe. Shoulders relaxed down.',
        anatomicalFocus: ['Inner thighs', 'Groin', 'Shoulders', 'Glutes'],
        benefits: ['Builds endurance', 'Enhances hip flexibility', 'Stimulates abdominal organs'],
        contraindications: ['Chronic hip issues', 'Diarrhea'],
        tags: ['warrior', 'standing', 'strength', 'classical'],
      },
      {
        sanskritName: 'वृक्षासन',
        sanskritNameIast: 'Vṛkṣāsana',
        englishName: 'Tree Pose',
        category: AsanaCategory.STANDING,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'A balancing posture that develops equilibrium, root-to-crown alignment, and steady concentration.',
        instructions: 'Shift weight onto standing leg. Place opposite foot against inner calf or inner thigh (never directly on knee). Bring hands to heart in Anjali Mudra or reach overhead.',
        alignmentCues: 'Press foot into thigh and thigh back into foot equally. Fix gaze on a drishti point.',
        anatomicalFocus: ['Ankles', 'Calves', 'Pelvic floor', 'Spine'],
        benefits: ['Improves balance and proprioception', 'Strengthens thighs and spine', 'Calms the mind'],
        contraindications: ['Vertigo', 'Acute ankle sprain'],
        tags: ['balance', 'standing', 'focus', 'classical'],
      },
      {
        sanskritName: 'पश्चिमोत्तानासन',
        sanskritNameIast: 'Paścimottānāsana',
        englishName: 'Seated Forward Bend',
        category: AsanaCategory.FORWARD_BEND,
        difficulty: AsanaDifficulty.INTERMEDIATE,
        description: 'A classic calming seated fold lengthening the entire posterior chain from heels to crown.',
        instructions: 'Sit in Dandasana. Inhale reach arms upward lengthening spine. Exhale hinge at hip creases and fold over legs holding shins, ankles, or feet.',
        alignmentCues: 'Lead with sternum, not forehead. Keep spine elongated before softening into fold.',
        anatomicalFocus: ['Hamstrings', 'Lower back', 'Spine'],
        benefits: ['Soothes the nervous system', 'Aids digestion', 'Reduces fatigue and mild anxiety'],
        contraindications: ['Lumbar disc herniation', 'Acute asthma flare'],
        cautions: 'Use a strap around feet or a folded blanket under sit bones to maintain pelvic tilt.',
        tags: ['seated', 'forward-bend', 'calming', 'classical'],
      },
      {
        sanskritName: 'भुजङ्गासन',
        sanskritNameIast: 'Bhujaṅgāsana',
        englishName: 'Cobra Pose',
        category: AsanaCategory.BACKBEND,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'A prone backbend opening the chest and stimulating abdominal organs while strengthening the spine.',
        instructions: 'Lie prone with legs extended. Place hands under shoulders with elbows hugging the ribs. Inhale press tops of feet into mat and lift chest using back musculature.',
        alignmentCues: 'Keep elbows slightly bent. Roll shoulders back and down. Keep neck in neutral extension.',
        anatomicalFocus: ['Erector spinae', 'Chest', 'Abdomen', 'Glutes'],
        benefits: ['Strengthens vertebral column', 'Expands lung capacity', 'Stimulates endocrine system'],
        contraindications: ['Pregnancy', 'Carpal tunnel syndrome', 'Severe back injury'],
        tags: ['prone', 'backbend', 'heart-opening', 'classical'],
      },
      {
        sanskritName: 'शवासन',
        sanskritNameIast: 'Śavāsana',
        englishName: 'Corpse Pose',
        category: AsanaCategory.RESTORATIVE,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'The definitive posture of conscious relaxation, integrating practice benefits and restorative stillness.',
        instructions: 'Lie flat on back with legs apart, feet flopping open naturally. Arms by sides with palms turned upward. Close eyes and release all muscular effort.',
        alignmentCues: 'Release jaw, brow, and tongue. Allow the breath to flow without manipulation.',
        anatomicalFocus: ['Full body', 'Autonomic nervous system'],
        benefits: ['Activates parasympathetic relaxation response', 'Reduces blood pressure', 'Integrates somatic imprint'],
        contraindications: ['Third trimester pregnancy (substitute side-lying with bolster)'],
        tags: ['restorative', 'relaxation', 'meditation', 'supine', 'essential'],
      },
      {
        sanskritName: 'सेतुबन्धासन',
        sanskritNameIast: 'Setu Bandhāsana',
        englishName: 'Bridge Pose',
        category: AsanaCategory.BACKBEND,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'A versatile supine backbend and mild inversion opening the heart and strengthening legs.',
        instructions: 'Lie on back, bend knees placing feet hip-width flat on mat. Exhale press feet and arms down, lifting pelvis toward ceiling.',
        alignmentCues: 'Keep thighs parallel. Interlace fingers beneath back if comfortable and roll outer shoulders underneath.',
        anatomicalFocus: ['Glutes', 'Hamstrings', 'Chest', 'Quadriceps'],
        benefits: ['Rejuvenates tired legs', 'Relieves backache', 'Stimulates thyroid gland'],
        contraindications: ['Neck injury (do not turn head while lifted)'],
        tags: ['backbend', 'supine', 'chest-opener', 'classical'],
      },
      {
        sanskritName: 'बालासन',
        sanskritNameIast: 'Bālāsana',
        englishName: 'Child’s Pose',
        category: AsanaCategory.RESTORATIVE,
        difficulty: AsanaDifficulty.BEGINNER,
        description: 'A restorative resting posture that gently releases the lower back, hips, and shoulders.',
        instructions: 'Kneel with big toes touching and knees wide apart. Fold forward resting forehead on mat or block, extending arms forward or alongside body.',
        alignmentCues: 'Sink hips toward heels. Breathe into posterior ribcage.',
        anatomicalFocus: ['Hips', 'Thighs', 'Ankles', 'Back'],
        benefits: ['Releases spinal tension', 'Calms nervous system', 'Serves as an intuitive resting sanctuary'],
        contraindications: ['Severe knee inflammation', 'Diarrhea'],
        tags: ['restorative', 'grounding', 'resting', 'classical'],
      },
    ];

    let createdCount = 0;
    for (const pose of classicalPoses) {
      const existing = await prisma.asana.findFirst({
        where: {
          sanskritNameIast: pose.sanskritNameIast,
          isSharedReference: true,
          deletedAt: null,
        },
      });

      if (!existing) {
        await prisma.asana.create({
          data: {
            sanskritName: pose.sanskritName,
            sanskritNameIast: pose.sanskritNameIast,
            englishName: pose.englishName,
            category: pose.category,
            difficulty: pose.difficulty,
            status: AsanaStatus.PUBLISHED,
            isSharedReference: true,
            tenantId: null,
            description: pose.description,
            instructions: pose.instructions,
            alignmentCues: pose.alignmentCues,
            anatomicalFocus: pose.anatomicalFocus,
            benefits: pose.benefits,
            contraindications: pose.contraindications,
            cautions: pose.cautions,
            tags: pose.tags,
          },
        });
        createdCount++;
      }
    }

    return { success: true, seededCount: createdCount };
  }
}
