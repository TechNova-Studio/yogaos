import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  prisma,
  SequenceLevel,
  SequenceStatus,
  ExecutionMode,
  StepSide,
} from '@yogaos/database';
import {
  CreateSequenceInput,
  UpdateSequenceInput,
  SequenceListQuery,
  SequenceStepInput,
  ReorderSequenceStepsInput,
  PublishSequenceInput,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';
import { SequenceCalculator } from './sequence-calculator.js';

@Injectable()
export class SequencesService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Validates that all asanas and media assets referenced in steps exist and belong
   * either to the tenant or to the shared platform library.
   */
  private async validateStepResources(
    tenantId: string,
    steps: SequenceStepInput[]
  ): Promise<Map<string, { englishName: string; sanskritName: string }>> {
    const asanaSnapshots = new Map<string, { englishName: string; sanskritName: string }>();

    for (const step of steps) {
      // 1. Verify Asana ownership
      const asana = await prisma.asana.findFirst({
        where: { id: step.asanaId, deletedAt: null },
      });

      if (!asana) {
        throw new NotFoundException(`Asana with ID ${step.asanaId} not found`);
      }

      if (asana.tenantId && asana.tenantId !== tenantId) {
        throw new ForbiddenException(
          `Cross-tenant Asana association denied: posture belongs to another organization`
        );
      }

      asanaSnapshots.set(asana.id, {
        englishName: asana.englishName,
        sanskritName: asana.sanskritNameIast || asana.sanskritName,
      });

      // 2. Verify Media Assets ownership
      const mediaIds = [
        step.voiceAudioMediaId,
        step.demoVideoMediaId,
        step.referenceImageMediaId,
      ].filter((id): id is string => Boolean(id));

      if (mediaIds.length > 0) {
        const mediaAssets = await prisma.mediaAsset.findMany({
          where: { id: { in: mediaIds }, deletedAt: null },
        });

        if (mediaAssets.length !== mediaIds.length) {
          throw new NotFoundException(`One or more referenced media assets could not be found`);
        }

        for (const media of mediaAssets) {
          if (media.tenantId && media.tenantId !== tenantId) {
            throw new ForbiddenException(
              `Cross-tenant media association denied: media asset ${media.id} belongs to another organization`
            );
          }
        }
      }
    }

    return asanaSnapshots;
  }

  async listSequences(tenantId: string, query: SequenceListQuery) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.targetLevel) {
      where.targetLevel = query.targetLevel as SequenceLevel;
    }

    if (query.status) {
      where.status = query.status as SequenceStatus;
    }

    if (query.isStudioTemplate !== undefined) {
      where.isStudioTemplate = query.isStudioTemplate;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { objective: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.sequence.count({ where }),
      prisma.sequence.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          creatorUser: {
            select: { id: true, fullName: true, email: true },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              _count: {
                select: { steps: true },
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

  async getSequence(tenantId: string, id: string) {
    const sequence = await prisma.sequence.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        creatorUser: {
          select: { id: true, fullName: true, email: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
              include: {
                asana: {
                  select: {
                    id: true,
                    englishName: true,
                    sanskritName: true,
                    sanskritNameIast: true,
                    category: true,
                    difficulty: true,
                    primaryMedia: {
                      select: { id: true, url: true, thumbnailUrl: true, mediaType: true },
                    },
                  },
                },
                voiceAudioMedia: true,
                demoVideoMedia: true,
                referenceImageMedia: true,
              },
            },
          },
        },
      },
    });

    if (!sequence) {
      throw new NotFoundException(`Sequence with ID ${id} not found`);
    }

    // Active version is the latest matching sequence.activeVersion
    const activeVersion =
      sequence.versions.find((v) => v.versionNumber === sequence.activeVersion) ||
      sequence.versions[0];

    return {
      ...sequence,
      activeVersionDetails: activeVersion,
    };
  }

  async createSequence(tenantId: string, data: CreateSequenceInput, userId: string) {
    const steps = data.steps ?? [];
    const asanaSnapshots = await this.validateStepResources(tenantId, steps);
    const validation = SequenceCalculator.calculateAndValidate(steps);

    return prisma.$transaction(async (tx) => {
      const sequence = await tx.sequence.create({
        data: {
          tenantId,
          creatorUserId: userId,
          title: data.title,
          description: data.description,
          objective: data.objective,
          targetLevel: (data.targetLevel as SequenceLevel) ?? SequenceLevel.ALL_LEVELS,
          intendedAudience: data.intendedAudience,
          isStudioTemplate: data.isStudioTemplate ?? false,
          tags: data.tags ?? [],
          status: SequenceStatus.DRAFT,
          activeVersion: 1,
          estimatedTotalDurationSecs: validation.totalDurationSecs,
        },
      });

      const version = await tx.sequenceVersion.create({
        data: {
          tenantId,
          sequenceId: sequence.id,
          versionNumber: 1,
          status: SequenceStatus.DRAFT,
          totalEstimatedDurationSecs: validation.totalDurationSecs,
        },
      });

      if (steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const snapshot = asanaSnapshots.get(step.asanaId);

          await tx.sequenceStep.create({
            data: {
              tenantId,
              sequenceVersionId: version.id,
              stepOrder: step.stepOrder !== undefined ? step.stepOrder : i + 1,
              asanaId: step.asanaId,
              asanaNameSnapshot: snapshot?.englishName,
              sanskritNameSnapshot: snapshot?.sanskritName,
              executionMode: (step.executionMode as ExecutionMode) ?? ExecutionMode.TIME_HOLD,
              durationSeconds: step.durationSeconds,
              repetitionCount: step.repetitionCount,
              isBilateral: step.isBilateral ?? false,
              side: (step.side as StepSide) ?? StepSide.NONE,
              restIntervalSeconds: step.restIntervalSeconds ?? 0,
              voiceAudioMediaId: step.voiceAudioMediaId,
              demoVideoMediaId: step.demoVideoMediaId,
              referenceImageMediaId: step.referenceImageMediaId,
              teacherNotes: step.teacherNotes,
              cues: step.cues,
              transitionNotes: step.transitionNotes,
            },
          });
        }
      }

      await this.audit.log({
        tenantId,
        userId,
        action: 'SEQUENCE_CREATED',
        resourceType: 'SEQUENCE',
        resourceId: sequence.id,
        details: {
          title: sequence.title,
          totalSteps: steps.length,
          estimatedDuration: validation.totalDurationSecs,
        },
      });

      return {
        ...sequence,
        versionId: version.id,
      };
    });
  }

  async updateSequence(
    tenantId: string,
    id: string,
    data: UpdateSequenceInput,
    userId: string
  ) {
    const existing = await this.getSequence(tenantId, id);

    // If sequence is published, we create a new DRAFT version to maintain immutability of historical versions
    if (existing.status === SequenceStatus.PUBLISHED) {
      return this.forkPublishedSequenceVersion(tenantId, existing, data, userId);
    }

    // Existing is DRAFT: Update metadata and active version steps directly
    const steps = data.steps;
    let totalDurationSecs = existing.estimatedTotalDurationSecs;

    return prisma.$transaction(async (tx) => {
      const activeVersion = existing.activeVersionDetails;

      if (steps) {
        const asanaSnapshots = await this.validateStepResources(tenantId, steps);
        const validation = SequenceCalculator.calculateAndValidate(steps);
        totalDurationSecs = validation.totalDurationSecs;

        // Delete existing steps on this draft version and replace with updated steps
        await tx.sequenceStep.deleteMany({
          where: { sequenceVersionId: activeVersion.id },
        });

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const snapshot = asanaSnapshots.get(step.asanaId);

          await tx.sequenceStep.create({
            data: {
              tenantId,
              sequenceVersionId: activeVersion.id,
              stepOrder: step.stepOrder !== undefined ? step.stepOrder : i + 1,
              asanaId: step.asanaId,
              asanaNameSnapshot: snapshot?.englishName,
              sanskritNameSnapshot: snapshot?.sanskritName,
              executionMode: (step.executionMode as ExecutionMode) ?? ExecutionMode.TIME_HOLD,
              durationSeconds: step.durationSeconds,
              repetitionCount: step.repetitionCount,
              isBilateral: step.isBilateral ?? false,
              side: (step.side as StepSide) ?? StepSide.NONE,
              restIntervalSeconds: step.restIntervalSeconds ?? 0,
              voiceAudioMediaId: step.voiceAudioMediaId,
              demoVideoMediaId: step.demoVideoMediaId,
              referenceImageMediaId: step.referenceImageMediaId,
              teacherNotes: step.teacherNotes,
              cues: step.cues,
              transitionNotes: step.transitionNotes,
            },
          });
        }

        await tx.sequenceVersion.update({
          where: { id: activeVersion.id },
          data: { totalEstimatedDurationSecs: totalDurationSecs },
        });
      }

      const updated = await tx.sequence.update({
        where: { id },
        data: {
          title: data.title ?? existing.title,
          description: data.description !== undefined ? data.description : existing.description,
          objective: data.objective !== undefined ? data.objective : existing.objective,
          targetLevel: (data.targetLevel as SequenceLevel) ?? existing.targetLevel,
          intendedAudience: data.intendedAudience !== undefined ? data.intendedAudience : existing.intendedAudience,
          isStudioTemplate: data.isStudioTemplate !== undefined ? data.isStudioTemplate : existing.isStudioTemplate,
          tags: data.tags ?? existing.tags,
          estimatedTotalDurationSecs: totalDurationSecs,
        },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SEQUENCE_UPDATED',
        resourceType: 'SEQUENCE',
        resourceId: id,
        details: { title: updated.title, updatedStepsCount: steps?.length },
      });

      return updated;
    });
  }

  /**
   * Forks a published sequence into a new draft version.
   */
  private async forkPublishedSequenceVersion(
    tenantId: string,
    existing: any,
    data: UpdateSequenceInput,
    userId: string
  ) {
    const newVersionNumber = existing.activeVersion + 1;
    const stepsToApply: SequenceStepInput[] =
      data.steps ??
      existing.activeVersionDetails.steps.map((s: any) => ({
        stepOrder: s.stepOrder,
        asanaId: s.asanaId,
        executionMode: s.executionMode,
        durationSeconds: s.durationSeconds,
        repetitionCount: s.repetitionCount,
        isBilateral: s.isBilateral,
        side: s.side,
        restIntervalSeconds: s.restIntervalSeconds,
        voiceAudioMediaId: s.voiceAudioMediaId,
        demoVideoMediaId: s.demoVideoMediaId,
        referenceImageMediaId: s.referenceImageMediaId,
        teacherNotes: s.teacherNotes,
        cues: s.cues,
        transitionNotes: s.transitionNotes,
      }));

    const asanaSnapshots = await this.validateStepResources(tenantId, stepsToApply);
    const validation = SequenceCalculator.calculateAndValidate(stepsToApply);

    return prisma.$transaction(async (tx) => {
      const newVersion = await tx.sequenceVersion.create({
        data: {
          tenantId,
          sequenceId: existing.id,
          versionNumber: newVersionNumber,
          status: SequenceStatus.DRAFT,
          totalEstimatedDurationSecs: validation.totalDurationSecs,
        },
      });

      for (let i = 0; i < stepsToApply.length; i++) {
        const step = stepsToApply[i];
        const snapshot = asanaSnapshots.get(step.asanaId);

        await tx.sequenceStep.create({
          data: {
            tenantId,
            sequenceVersionId: newVersion.id,
            stepOrder: step.stepOrder !== undefined ? step.stepOrder : i + 1,
            asanaId: step.asanaId,
            asanaNameSnapshot: snapshot?.englishName,
            sanskritNameSnapshot: snapshot?.sanskritName,
            executionMode: (step.executionMode as ExecutionMode) ?? ExecutionMode.TIME_HOLD,
            durationSeconds: step.durationSeconds,
            repetitionCount: step.repetitionCount,
            isBilateral: step.isBilateral ?? false,
            side: (step.side as StepSide) ?? StepSide.NONE,
            restIntervalSeconds: step.restIntervalSeconds ?? 0,
            voiceAudioMediaId: step.voiceAudioMediaId,
            demoVideoMediaId: step.demoVideoMediaId,
            referenceImageMediaId: step.referenceImageMediaId,
            teacherNotes: step.teacherNotes,
            cues: step.cues,
            transitionNotes: step.transitionNotes,
          },
        });
      }

      const updatedSequence = await tx.sequence.update({
        where: { id: existing.id },
        data: {
          title: data.title ?? existing.title,
          description: data.description !== undefined ? data.description : existing.description,
          objective: data.objective !== undefined ? data.objective : existing.objective,
          targetLevel: (data.targetLevel as SequenceLevel) ?? existing.targetLevel,
          intendedAudience: data.intendedAudience !== undefined ? data.intendedAudience : existing.intendedAudience,
          isStudioTemplate: data.isStudioTemplate !== undefined ? data.isStudioTemplate : existing.isStudioTemplate,
          tags: data.tags ?? existing.tags,
          status: SequenceStatus.DRAFT,
          activeVersion: newVersionNumber,
          estimatedTotalDurationSecs: validation.totalDurationSecs,
        },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SEQUENCE_VERSION_FORKED',
        resourceType: 'SEQUENCE',
        resourceId: existing.id,
        details: { newVersionNumber, totalSteps: stepsToApply.length },
      });

      return {
        ...updatedSequence,
        activeVersionDetails: newVersion,
      };
    });
  }

  async duplicateSequence(tenantId: string, id: string, userId: string) {
    const existing = await this.getSequence(tenantId, id);
    const activeVersion = existing.activeVersionDetails;

    return prisma.$transaction(async (tx) => {
      const duplicated = await tx.sequence.create({
        data: {
          tenantId,
          creatorUserId: userId,
          title: `${existing.title} (Copy)`,
          description: existing.description,
          objective: existing.objective,
          targetLevel: existing.targetLevel,
          intendedAudience: existing.intendedAudience,
          isStudioTemplate: existing.isStudioTemplate,
          tags: existing.tags,
          status: SequenceStatus.DRAFT,
          activeVersion: 1,
          estimatedTotalDurationSecs: existing.estimatedTotalDurationSecs,
        },
      });

      const newVersion = await tx.sequenceVersion.create({
        data: {
          tenantId,
          sequenceId: duplicated.id,
          versionNumber: 1,
          status: SequenceStatus.DRAFT,
          totalEstimatedDurationSecs: existing.estimatedTotalDurationSecs,
        },
      });

      for (const step of activeVersion.steps) {
        await tx.sequenceStep.create({
          data: {
            tenantId,
            sequenceVersionId: newVersion.id,
            stepOrder: step.stepOrder,
            asanaId: step.asanaId,
            asanaNameSnapshot: step.asanaNameSnapshot,
            sanskritNameSnapshot: step.sanskritNameSnapshot,
            executionMode: step.executionMode,
            durationSeconds: step.durationSeconds,
            repetitionCount: step.repetitionCount,
            isBilateral: step.isBilateral,
            side: step.side,
            restIntervalSeconds: step.restIntervalSeconds,
            voiceAudioMediaId: step.voiceAudioMediaId,
            demoVideoMediaId: step.demoVideoMediaId,
            referenceImageMediaId: step.referenceImageMediaId,
            teacherNotes: step.teacherNotes,
            cues: step.cues,
            transitionNotes: step.transitionNotes,
          },
        });
      }

      await this.audit.log({
        tenantId,
        userId,
        action: 'SEQUENCE_DUPLICATED',
        resourceType: 'SEQUENCE',
        resourceId: duplicated.id,
        details: { originalSequenceId: id, newTitle: duplicated.title },
      });

      return duplicated;
    });
  }

  async publishSequence(
    tenantId: string,
    id: string,
    data: PublishSequenceInput,
    userId: string
  ) {
    const existing = await this.getSequence(tenantId, id);
    const activeVersion = existing.activeVersionDetails;

    if (!activeVersion.steps || activeVersion.steps.length === 0) {
      throw new BadRequestException('Cannot publish sequence: at least one posture step is required');
    }

    // Verify all steps are valid
    const stepsInput: SequenceStepInput[] = activeVersion.steps.map((s: any) => ({
      stepOrder: s.stepOrder,
      asanaId: s.asanaId,
      executionMode: s.executionMode,
      durationSeconds: s.durationSeconds,
      repetitionCount: s.repetitionCount,
      isBilateral: s.isBilateral,
      side: s.side,
      restIntervalSeconds: s.restIntervalSeconds,
      voiceAudioMediaId: s.voiceAudioMediaId,
      demoVideoMediaId: s.demoVideoMediaId,
      referenceImageMediaId: s.referenceImageMediaId,
      teacherNotes: s.teacherNotes,
      cues: s.cues,
      transitionNotes: s.transitionNotes,
    }));

    await this.validateStepResources(tenantId, stepsInput);
    const validation = SequenceCalculator.calculateAndValidate(stepsInput);
    if (!validation.isValidForPublishing) {
      const errorMsg = validation.issues
        .filter((i) => i.severity === 'ERROR')
        .map((i) => i.message)
        .join('; ');
      throw new BadRequestException(`Cannot publish sequence: ${errorMsg}`);
    }

    // Compile mediaManifest: collect all unique media assets
    const mediaMap = new Map<string, any>();
    for (const step of activeVersion.steps) {
      if (step.voiceAudioMedia) mediaMap.set(step.voiceAudioMedia.id, step.voiceAudioMedia);
      if (step.demoVideoMedia) mediaMap.set(step.demoVideoMedia.id, step.demoVideoMedia);
      if (step.referenceImageMedia) mediaMap.set(step.referenceImageMedia.id, step.referenceImageMedia);
    }

    const mediaManifest = Array.from(mediaMap.values()).map((m) => ({
      assetId: m.id,
      mediaType: m.mediaType,
      url: m.url,
      sha256Hash: m.sha256Hash,
      fileSize: m.fileSize,
      fileName: m.fileName,
    }));

    return prisma.$transaction(async (tx) => {
      const publishedVersion = await tx.sequenceVersion.update({
        where: { id: activeVersion.id },
        data: {
          status: SequenceStatus.PUBLISHED,
          publishedAt: new Date(),
          notes: data.notes,
          mediaManifest,
          totalEstimatedDurationSecs: validation.totalDurationSecs,
        },
      });

      const publishedSequence = await tx.sequence.update({
        where: { id },
        data: {
          status: SequenceStatus.PUBLISHED,
          estimatedTotalDurationSecs: validation.totalDurationSecs,
        },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SEQUENCE_PUBLISHED',
        resourceType: 'SEQUENCE',
        resourceId: id,
        details: {
          versionNumber: publishedVersion.versionNumber,
          stepCount: stepsInput.length,
          totalDuration: validation.totalDurationSecs,
          mediaCount: mediaManifest.length,
        },
      });

      return {
        ...publishedSequence,
        activeVersionDetails: publishedVersion,
      };
    });
  }

  async archiveSequence(tenantId: string, id: string, userId: string) {
    const existing = await this.getSequence(tenantId, id);

    return prisma.$transaction(async (tx) => {
      await tx.sequenceVersion.updateMany({
        where: { sequenceId: id },
        data: { status: SequenceStatus.ARCHIVED },
      });

      const archived = await tx.sequence.update({
        where: { id },
        data: {
          status: SequenceStatus.ARCHIVED,
          deletedAt: new Date(),
        },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SEQUENCE_ARCHIVED',
        resourceType: 'SEQUENCE',
        resourceId: id,
        details: { title: existing.title },
      });

      return { success: true, archived: true };
    });
  }

  async reorderSteps(
    tenantId: string,
    sequenceId: string,
    data: ReorderSequenceStepsInput,
    userId: string
  ) {
    const existing = await this.getSequence(tenantId, idWrapper(sequenceId));
    const activeVersion = existing.activeVersionDetails;

    if (existing.status === SequenceStatus.PUBLISHED) {
      throw new BadRequestException('Cannot reorder steps of a published sequence version; please edit to create a new draft');
    }

    const { stepIds } = data;
    const existingStepIds = new Set(activeVersion.steps.map((s: any) => s.id));

    for (const stepId of stepIds) {
      if (!existingStepIds.has(stepId)) {
        throw new NotFoundException(`Step ${stepId} does not belong to sequence ${sequenceId}`);
      }
    }

    return prisma.$transaction(async (tx) => {
      // Step 1: Temporarily shift to negative values to prevent unique constraint collisions
      for (let order = 0; order < stepIds.length; order++) {
        await tx.sequenceStep.update({
          where: { id: stepIds[order] },
          data: { stepOrder: -(order + 1000) },
        });
      }

      // Step 2: Assign final sequential orders (1, 2, 3...)
      for (let order = 0; order < stepIds.length; order++) {
        await tx.sequenceStep.update({
          where: { id: stepIds[order] },
          data: { stepOrder: order + 1 },
        });
      }

      await this.audit.log({
        tenantId,
        userId,
        action: 'SEQUENCE_STEPS_REORDERED',
        resourceType: 'SEQUENCE',
        resourceId: sequenceId,
        details: { stepCount: stepIds.length },
      });

      return { success: true, reorderedCount: stepIds.length };
    });
  }
}

function idWrapper(id: string): string {
  return id;
}
