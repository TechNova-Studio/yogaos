import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  prisma,
  ConductorSessionStatus,
  ConductorStepPhase,
  ConductorEventType,
  UserRole,
} from '@yogaos/database';
import {
  InitConductorSessionInput,
  ConductorActionInput,
  ConductorSessionState,
  ConductorStepView,
  ConductorContentMode,
  ConductorSessionMediaManifest,
  ConductorManifestAsset,
  PrepareConductorSessionInput,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';
import {
  ConductorStateMachine,
  InvalidTransitionError,
  TerminalStateError,
} from './conductor-state-machine.js';
import { randomUUID } from 'crypto';

function determineContentMode(step: any): ConductorContentMode {
  if (step.demoVideoMedia || step.demoVideoMediaId) {
    return 'VIDEO';
  }
  if (
    (step.referenceImageMedia || step.referenceImageMediaId) &&
    (step.voiceAudioMedia || step.voiceAudioMediaId)
  ) {
    return 'IMAGE_WITH_VOICE';
  }
  if (step.referenceImageMedia || step.referenceImageMediaId) {
    return 'IMAGE';
  }
  if (step.voiceAudioMedia || step.voiceAudioMediaId) {
    return 'AUDIO_ONLY';
  }
  return 'NONE';
}

const STEP_MEDIA_INCLUDE = {
  asana: true,
  voiceAudioMedia: true,
  demoVideoMedia: true,
  referenceImageMedia: true,
};

@Injectable()
export class ConductorService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Initialize a conductor session for a scheduled class session instance.
   */
  async initSession(
    tenantId: string,
    input: InitConductorSessionInput,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorSessionState> {
    const { sessionInstanceId, sequenceVersionId, clientSessionUuid } = input;

    // 1. Fetch ClassSessionInstance with tenant isolation
    const sessionInstance = await prisma.classSessionInstance.findFirst({
      where: { id: sessionInstanceId, tenantId },
      include: {
        attachedSequenceVersion: {
          include: {
            sequence: true,
            steps: {
              include: STEP_MEDIA_INCLUDE,
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!sessionInstance) {
      throw new NotFoundException(`Class session instance '${sessionInstanceId}' not found.`);
    }

    if (sessionInstance.status === 'CANCELLED') {
      throw new BadRequestException('Cannot conduct a cancelled class session.');
    }

    // 2. Authorization check: OWNER/MANAGER or the assigned instructor
    if (userRole === UserRole.INSTRUCTOR && sessionInstance.instructorId !== userId) {
      throw new ForbiddenException('Instructors can only launch their own assigned class sessions.');
    }

    // 3. Check if ConductorSession already exists
    const existingConductorSession = await prisma.conductorSession.findUnique({
      where: { sessionInstanceId },
      include: {
        sequenceVersion: {
          include: {
            sequence: true,
            steps: {
              include: STEP_MEDIA_INCLUDE,
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (existingConductorSession) {
      return this.mapToState(existingConductorSession);
    }

    // 4. Resolve SequenceVersion
    let targetVersionId = sequenceVersionId || sessionInstance.attachedSequenceVersionId;

    if (!targetVersionId) {
      throw new BadRequestException('No sequence attached to this class session. Please attach a published sequence.');
    }

    const sequenceVersion = await prisma.sequenceVersion.findFirst({
      where: { id: targetVersionId, tenantId, status: 'PUBLISHED' },
      include: {
        sequence: true,
        steps: {
          include: STEP_MEDIA_INCLUDE,
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!sequenceVersion) {
      throw new BadRequestException(`Sequence version '${targetVersionId}' not found or is not published.`);
    }

    if (sequenceVersion.steps.length === 0) {
      throw new BadRequestException('Cannot conduct a sequence with 0 steps.');
    }

    // 5. Create ConductorSession in database
    const sessionUuid = clientSessionUuid || randomUUID();
    const eventUuid = randomUUID();

    const createdSession = await prisma.$transaction(async (tx) => {
      const conductorSession = await tx.conductorSession.create({
        data: {
          tenantId,
          sessionInstanceId,
          sequenceVersionId: sequenceVersion.id,
          conductorInstructorId: userId,
          status: 'READY',
          currentStepIndex: 0,
          currentPhase: sequenceVersion.steps[0].isBilateral ? 'BILATERAL_SIDE_A' : 'POSTURE_HOLD',
          clientSessionUuid: sessionUuid,
          lastHeartbeatAt: new Date(),
        },
        include: {
          sequenceVersion: {
            include: {
              sequence: true,
              steps: {
                include: STEP_MEDIA_INCLUDE,
                orderBy: { stepOrder: 'asc' },
              },
            },
          },
        },
      });

      await tx.conductorExecutionEvent.create({
        data: {
          tenantId,
          conductorSessionId: conductorSession.id,
          clientEventUuid: eventUuid,
          eventType: 'SESSION_INITIALIZED',
          stepOrder: 0,
          clientTimestamp: new Date(),
          payload: {
            sequenceVersionId: sequenceVersion.id,
            sequenceTitle: sequenceVersion.sequence.title,
            totalSteps: sequenceVersion.steps.length,
          },
        },
      });

      return conductorSession;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CONDUCTOR_SESSION_INITIALIZED',
      resourceType: 'CONDUCTOR_SESSION',
      resourceId: createdSession.id,
    });

    return this.mapToState(createdSession);
  }

  /**
   * Get current state of a conductor session.
   */
  async getSession(
    tenantId: string,
    sessionInstanceId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorSessionState> {
    const conductorSession = await prisma.conductorSession.findFirst({
      where: { sessionInstanceId, tenantId },
      include: {
        sessionInstance: true,
        sequenceVersion: {
          include: {
            sequence: true,
            steps: {
              include: STEP_MEDIA_INCLUDE,
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!conductorSession) {
      throw new NotFoundException(`Conductor session for class instance '${sessionInstanceId}' not found.`);
    }

    // Authorization
    if (
      userRole === UserRole.INSTRUCTOR &&
      conductorSession.conductorInstructorId !== userId &&
      conductorSession.sessionInstance.instructorId !== userId
    ) {
      throw new ForbiddenException('Instructors can only access their own class conductor sessions.');
    }

    return this.mapToState(conductorSession);
  }

  /**
   * Resolve immutable media manifest for a conductor session.
   */
  async getMediaManifest(
    tenantId: string,
    sessionInstanceId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorSessionMediaManifest> {
    // 1. Fetch ClassSessionInstance with tenant check
    const sessionInstance = await prisma.classSessionInstance.findFirst({
      where: { id: sessionInstanceId, tenantId },
      include: {
        conductorSession: true,
        attachedSequenceVersion: {
          include: {
            sequence: true,
            steps: {
              include: STEP_MEDIA_INCLUDE,
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!sessionInstance) {
      throw new NotFoundException(`Class session instance '${sessionInstanceId}' not found.`);
    }

    // 2. Authorization
    if (
      userRole === UserRole.INSTRUCTOR &&
      sessionInstance.instructorId !== userId &&
      sessionInstance.conductorSession?.conductorInstructorId !== userId
    ) {
      throw new ForbiddenException('Instructors can only access media manifests for their assigned sessions.');
    }

    // 3. Resolve attached sequence version
    const version = sessionInstance.attachedSequenceVersion;
    if (!version) {
      throw new BadRequestException('No sequence attached to this session instance.');
    }

    // 4. Resolve and validate all media assets
    const assetMap = new Map<string, ConductorManifestAsset>();

    for (const step of version.steps) {
      const mode = determineContentMode(step);
      const mediaRefs = [
        { media: step.demoVideoMedia, refId: step.demoVideoMediaId },
        { media: step.referenceImageMedia, refId: step.referenceImageMediaId },
        { media: step.voiceAudioMedia, refId: step.voiceAudioMediaId },
      ];

      for (const { media, refId } of mediaRefs) {
        if (!refId) continue;

        if (!media) {
          throw new BadRequestException(`Media reference '${refId}' on step #${step.stepOrder} could not be resolved.`);
        }

        if (media.deletedAt !== null || media.isArchived) {
          throw new BadRequestException(`Media asset '${media.id}' on step #${step.stepOrder} is deleted or archived.`);
        }

        // Cross-tenant verification
        if (media.tenantId !== null && media.tenantId !== tenantId) {
          throw new ForbiddenException(`Cross-tenant media access denied for asset '${media.id}'.`);
        }

        if (!media.sha256Hash) {
          throw new BadRequestException(`Media asset '${media.id}' is missing required SHA-256 integrity checksum.`);
        }

        if (!assetMap.has(media.id)) {
          assetMap.set(media.id, {
            assetId: media.id,
            title: media.title,
            fileName: media.fileName,
            mediaType: media.mediaType as any,
            mimeType: media.mimeType,
            fileSize: media.fileSize,
            sha256Hash: media.sha256Hash,
            url: media.url,
            thumbnailUrl: media.thumbnailUrl,
            durationSeconds: media.durationSeconds,
            stepOrders: [step.stepOrder],
            contentMode: mode,
          });
        } else {
          const existing = assetMap.get(media.id)!;
          if (!existing.stepOrders.includes(step.stepOrder)) {
            existing.stepOrders.push(step.stepOrder);
          }
        }
      }
    }

    const assets = Array.from(assetMap.values());
    const totalBytes = assets.reduce((sum, a) => sum + a.fileSize, 0);

    return {
      sessionInstanceId,
      sequenceVersionId: version.id,
      sequenceTitle: version.sequence.title,
      totalAssetsCount: assets.length,
      totalBytes,
      assets,
    };
  }

  /**
   * Submit offline preparation and integrity verification status.
   */
  async submitPreparation(
    tenantId: string,
    sessionInstanceId: string,
    input: PrepareConductorSessionInput,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorSessionState> {
    const { clientEventUuid, status, verifiedAssetsCount, totalBytesVerified, verificationErrors, storageAvailableBytes } = input;

    // 1. Fetch ConductorSession
    const conductorSession = await prisma.conductorSession.findFirst({
      where: { sessionInstanceId, tenantId },
      include: {
        sessionInstance: true,
        sequenceVersion: {
          include: {
            sequence: true,
            steps: {
              include: STEP_MEDIA_INCLUDE,
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!conductorSession) {
      throw new NotFoundException(`Conductor session for class instance '${sessionInstanceId}' not found.`);
    }

    // 2. Authorization
    if (
      userRole === UserRole.INSTRUCTOR &&
      conductorSession.conductorInstructorId !== userId &&
      conductorSession.sessionInstance.instructorId !== userId
    ) {
      throw new ForbiddenException('Instructors can only prepare their own class sessions.');
    }

    // 3. Idempotency Check
    const existingEvent = await prisma.conductorExecutionEvent.findUnique({
      where: { clientEventUuid },
    });

    if (existingEvent) {
      return this.mapToState(conductorSession);
    }

    // 4. Validation & State Machine Updates
    const now = new Date();
    let newStatus = conductorSession.status;
    let isOfflineReady = conductorSession.isOfflineReady;
    let offlinePreparedAt = conductorSession.offlinePreparedAt;
    let eventType: ConductorEventType = 'OFFLINE_PREPARATION_STARTED';

    if (status === 'OFFLINE_READY') {
      if (verificationErrors && verificationErrors.length > 0) {
        throw new BadRequestException('Cannot mark session OFFLINE_READY with active verification errors.');
      }

      // Assert transition from READY (or existing OFFLINE_READY)
      ConductorStateMachine.assertValidTransition(conductorSession.status, 'OFFLINE_READY');
      newStatus = 'OFFLINE_READY';
      isOfflineReady = true;
      offlinePreparedAt = now;
      eventType = 'OFFLINE_READY';
    } else if (status === 'VERIFICATION_FAILED') {
      isOfflineReady = false;
      eventType = 'OFFLINE_VERIFICATION_FAILED';
    } else {
      eventType = 'OFFLINE_PREPARATION_STARTED';
    }

    const metadata = {
      status,
      verifiedAssetsCount: verifiedAssetsCount ?? 0,
      totalBytesVerified: totalBytesVerified ?? 0,
      storageAvailableBytes: storageAvailableBytes ?? null,
      verificationErrors: verificationErrors ?? [],
      recordedAt: now.toISOString(),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const session = await tx.conductorSession.update({
        where: { id: conductorSession.id },
        data: {
          status: newStatus,
          isOfflineReady,
          offlinePreparedAt,
          preparationMetadata: metadata,
        },
        include: {
          sequenceVersion: {
            include: {
              sequence: true,
              steps: {
                include: STEP_MEDIA_INCLUDE,
                orderBy: { stepOrder: 'asc' },
              },
            },
          },
        },
      });

      await tx.conductorExecutionEvent.create({
        data: {
          tenantId,
          conductorSessionId: conductorSession.id,
          clientEventUuid,
          eventType,
          stepOrder: conductorSession.currentStepIndex,
          clientTimestamp: input.clientTimestamp ? new Date(input.clientTimestamp) : now,
          payload: metadata,
        },
      });

      return session;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: `CONDUCTOR_PREPARATION_${status}`,
      resourceType: 'CONDUCTOR_SESSION',
      resourceId: updated.id,
    });

    return this.mapToState(updated);
  }

  /**
   * Execute an instructor action (START, PAUSE, RESUME, NEXT, PREVIOUS, SKIP, ADJUST_TIME, END_SESSION, HEARTBEAT).
   */
  async executeAction(
    tenantId: string,
    sessionInstanceId: string,
    input: ConductorActionInput,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorSessionState> {
    const { action, clientEventUuid, clientTimestamp, deltaSeconds, currentStepIndex: clientStepIndex } = input;

    // 1. Fetch ConductorSession
    const conductorSession = await prisma.conductorSession.findFirst({
      where: { sessionInstanceId, tenantId },
      include: {
        sessionInstance: true,
        sequenceVersion: {
          include: {
            sequence: true,
            steps: {
              include: STEP_MEDIA_INCLUDE,
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!conductorSession) {
      throw new NotFoundException(`Conductor session for class instance '${sessionInstanceId}' not found.`);
    }

    // 2. Authorization
    if (
      userRole === UserRole.INSTRUCTOR &&
      conductorSession.conductorInstructorId !== userId &&
      conductorSession.sessionInstance.instructorId !== userId
    ) {
      throw new ForbiddenException('Instructors can only control their own class conductor sessions.');
    }

    // 3. Idempotency Check on clientEventUuid
    const existingEvent = await prisma.conductorExecutionEvent.findUnique({
      where: { clientEventUuid },
    });

    if (existingEvent) {
      return this.mapToState(conductorSession);
    }

    // 4. Terminal State Check
    if (ConductorStateMachine.isTerminal(conductorSession.status)) {
      throw new BadRequestException(`Cannot execute '${action}' on session in terminal state '${conductorSession.status}'.`);
    }

    const steps = this.mapSteps(conductorSession.sequenceVersion.steps);
    let newStatus: ConductorSessionStatus = conductorSession.status;
    let newStepIndex = conductorSession.currentStepIndex;
    let newPhase: ConductorStepPhase = conductorSession.currentPhase;
    let newCompletedSteps = conductorSession.completedStepsCount;
    let newSkippedSteps = conductorSession.skippedStepsCount;
    let newAddedTime = conductorSession.addedTimeSeconds;
    let actualStartedAt = conductorSession.actualStartedAt;
    let actualConcludedAt = conductorSession.actualConcludedAt;
    let eventType: ConductorEventType = 'STEP_STARTED';

    const now = new Date();
    const eventTime = clientTimestamp ? new Date(clientTimestamp) : now;

    // 5. State Machine Dispatch
    switch (action) {
      case 'START': {
        ConductorStateMachine.assertValidTransition(conductorSession.status, 'RUNNING');
        newStatus = 'RUNNING';
        if (!actualStartedAt) {
          actualStartedAt = now;
        }
        eventType = 'SESSION_STARTED';
        break;
      }

      case 'PAUSE': {
        ConductorStateMachine.assertValidTransition(conductorSession.status, 'PAUSED');
        newStatus = 'PAUSED';
        eventType = 'SESSION_PAUSED';
        break;
      }

      case 'RESUME': {
        ConductorStateMachine.assertValidTransition(conductorSession.status, 'RUNNING');
        newStatus = 'RUNNING';
        eventType = 'SESSION_RESUMED';
        break;
      }

      case 'NEXT_STEP': {
        if (conductorSession.status !== 'RUNNING' && conductorSession.status !== 'PAUSED') {
          throw new BadRequestException(`Cannot advance step while session is in '${conductorSession.status}' state.`);
        }

        if (clientStepIndex !== undefined && clientStepIndex !== conductorSession.currentStepIndex) {
          return this.mapToState(conductorSession);
        }

        const prog = ConductorStateMachine.computeNextProgression(
          conductorSession.currentStepIndex,
          conductorSession.currentPhase,
          steps
        );

        if (prog.stepCompleted) {
          newCompletedSteps += 1;
        }

        if (prog.isFinished) {
          newStatus = 'COMPLETED';
          actualConcludedAt = now;
          eventType = 'SESSION_COMPLETED';
        } else {
          newStepIndex = prog.nextStepIndex;
          newPhase = prog.nextPhase;
          eventType = prog.stepCompleted ? 'STEP_COMPLETED' : 'STEP_STARTED';
        }
        break;
      }

      case 'SKIP_STEP': {
        if (conductorSession.status !== 'RUNNING' && conductorSession.status !== 'PAUSED') {
          throw new BadRequestException(`Cannot skip step while session is in '${conductorSession.status}' state.`);
        }

        if (clientStepIndex !== undefined && clientStepIndex !== conductorSession.currentStepIndex) {
          return this.mapToState(conductorSession);
        }

        const skipProg = ConductorStateMachine.computeSkipProgression(conductorSession.currentStepIndex, steps);
        newSkippedSteps += 1;

        if (skipProg.isFinished) {
          newStatus = 'COMPLETED';
          actualConcludedAt = now;
          eventType = 'SESSION_COMPLETED';
        } else {
          newStepIndex = skipProg.nextStepIndex;
          newPhase = skipProg.nextPhase;
          eventType = 'STEP_SKIPPED';
        }
        break;
      }

      case 'PREVIOUS_STEP': {
        const prevProg = ConductorStateMachine.computePreviousProgression(
          conductorSession.currentStepIndex,
          conductorSession.currentPhase,
          steps
        );
        newStepIndex = prevProg.prevStepIndex;
        newPhase = prevProg.prevPhase;
        eventType = 'STEP_PREVIOUS';
        break;
      }

      case 'ADJUST_TIME': {
        const delta = deltaSeconds ?? 30;
        newAddedTime += delta;
        eventType = 'TIME_ADJUSTED';
        break;
      }

      case 'END_SESSION': {
        const allStepsCompleted = newCompletedSteps + newSkippedSteps >= steps.length;
        newStatus = allStepsCompleted ? 'COMPLETED' : 'INTERRUPTED';
        ConductorStateMachine.assertValidTransition(conductorSession.status, newStatus);
        actualConcludedAt = now;
        eventType = allStepsCompleted ? 'SESSION_COMPLETED' : 'SESSION_INTERRUPTED';
        break;
      }

      case 'HEARTBEAT': {
        eventType = 'SESSION_STARTED';
        break;
      }

      default:
        throw new BadRequestException(`Unknown conductor action: ${action}`);
    }

    // 6. Elapsed time calculation
    let totalElapsedSeconds = conductorSession.totalElapsedSeconds;
    if (actualStartedAt && (newStatus === 'RUNNING' || newStatus === 'COMPLETED' || newStatus === 'INTERRUPTED')) {
      const wallClockElapsed = Math.floor((now.getTime() - actualStartedAt.getTime()) / 1000) + newAddedTime;
      totalElapsedSeconds = Math.max(totalElapsedSeconds, Math.max(0, wallClockElapsed));
    }

    // 7. Atomic Transaction
    const updated = await prisma.$transaction(async (tx) => {
      const session = await tx.conductorSession.update({
        where: { id: conductorSession.id },
        data: {
          status: newStatus,
          currentStepIndex: newStepIndex,
          currentPhase: newPhase,
          completedStepsCount: newCompletedSteps,
          skippedStepsCount: newSkippedSteps,
          addedTimeSeconds: newAddedTime,
          totalElapsedSeconds,
          actualStartedAt,
          actualConcludedAt,
          lastHeartbeatAt: now,
        },
        include: {
          sequenceVersion: {
            include: {
              sequence: true,
              steps: {
                include: STEP_MEDIA_INCLUDE,
                orderBy: { stepOrder: 'asc' },
              },
            },
          },
        },
      });

      if (action !== 'HEARTBEAT') {
        await tx.conductorExecutionEvent.create({
          data: {
            tenantId,
            conductorSessionId: conductorSession.id,
            clientEventUuid,
            eventType,
            stepOrder: newStepIndex,
            clientTimestamp: eventTime,
            payload: {
              action,
              currentStepIndex: newStepIndex,
              currentPhase: newPhase,
              deltaSeconds,
              completedStepsCount: newCompletedSteps,
              skippedStepsCount: newSkippedSteps,
            },
          },
        });
      }

      return session;
    });

    if (action !== 'HEARTBEAT') {
      await this.audit.log({
        tenantId,
        userId,
        action: `CONDUCTOR_ACTION_${action}`,
        resourceType: 'CONDUCTOR_SESSION',
        resourceId: updated.id,
      });
    }

    return this.mapToState(updated);
  }

  /**
   * Mark stale/abandoned sessions (> 30 mins inactivity without heartbeat) as INTERRUPTED_ABANDONED.
   * Invariant: Abandoned sessions are NEVER marked COMPLETED.
   */
  async checkAbandonedSessions(tenantId: string, timeoutMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const staleSessions = await prisma.conductorSession.findMany({
      where: {
        tenantId,
        status: { in: ['READY', 'OFFLINE_READY', 'RUNNING', 'PAUSED'] },
        OR: [
          { lastHeartbeatAt: { lt: cutoff } },
          { lastHeartbeatAt: null, updatedAt: { lt: cutoff } },
        ],
      },
    });

    let count = 0;
    for (const session of staleSessions) {
      await prisma.$transaction(async (tx) => {
        await tx.conductorSession.update({
          where: { id: session.id },
          data: {
            status: 'INTERRUPTED_ABANDONED',
            actualConcludedAt: new Date(),
          },
        });

        await tx.conductorExecutionEvent.create({
          data: {
            tenantId,
            conductorSessionId: session.id,
            clientEventUuid: randomUUID(),
            eventType: 'SESSION_ABANDONED',
            stepOrder: session.currentStepIndex,
            clientTimestamp: new Date(),
            payload: { reason: 'Heartbeat timeout exceeding threshold' },
          },
        });
      });
      count++;
    }

    return count;
  }

  /**
   * Helper: Map Prisma steps to ConductorStepView.
   */
  private mapSteps(steps: any[]): ConductorStepView[] {
    return steps.map((s) => {
      const mode = determineContentMode(s);
      return {
        id: s.id,
        stepOrder: s.stepOrder,
        asanaId: s.asanaId,
        asanaName: s.asanaNameSnapshot || s.asana?.englishName || 'Unnamed Asana',
        sanskritName: s.sanskritNameSnapshot || s.asana?.sanskritNameIast || '',
        executionMode: s.executionMode,
        durationSeconds: s.durationSeconds,
        repetitionCount: s.repetitionCount,
        isBilateral: s.isBilateral,
        side: s.side,
        restIntervalSeconds: s.restIntervalSeconds,
        teacherNotes: s.teacherNotes,
        cues: s.cues,
        transitionNotes: s.transitionNotes,
        contentMode: mode,
        referenceImageMediaId: s.referenceImageMediaId,
        voiceAudioMediaId: s.voiceAudioMediaId,
        demoVideoMediaId: s.demoVideoMediaId,
        referenceImageUrl: s.referenceImageMedia?.url ?? null,
        voiceAudioUrl: s.voiceAudioMedia?.url ?? null,
        demoVideoUrl: s.demoVideoMedia?.url ?? null,
        referenceImageHash: s.referenceImageMedia?.sha256Hash ?? null,
        voiceAudioHash: s.voiceAudioMedia?.sha256Hash ?? null,
        demoVideoHash: s.demoVideoMedia?.sha256Hash ?? null,
      };
    });
  }

  /**
   * Helper: Map ConductorSession to ConductorSessionState DTO.
   */
  private mapToState(session: any): ConductorSessionState {
    const steps = this.mapSteps(session.sequenceVersion.steps || []);
    const currentStep = steps[session.currentStepIndex] || null;
    const nextStep = steps[session.currentStepIndex + 1] || null;

    return {
      id: session.id,
      tenantId: session.tenantId,
      sessionInstanceId: session.sessionInstanceId,
      sequenceVersionId: session.sequenceVersionId,
      sequenceTitle: session.sequenceVersion?.sequence?.title || 'Yoga Sequence',
      conductorInstructorId: session.conductorInstructorId,
      status: session.status,
      currentStepIndex: session.currentStepIndex,
      currentPhase: session.currentPhase,
      totalSteps: steps.length,
      totalElapsedSeconds: session.totalElapsedSeconds,
      completedStepsCount: session.completedStepsCount,
      skippedStepsCount: session.skippedStepsCount,
      addedTimeSeconds: session.addedTimeSeconds,
      isOfflineReady: session.isOfflineReady ?? false,
      offlinePreparedAt: session.offlinePreparedAt ? session.offlinePreparedAt.toISOString() : null,
      preparationMetadata: session.preparationMetadata ?? null,
      actualStartedAt: session.actualStartedAt ? session.actualStartedAt.toISOString() : null,
      actualConcludedAt: session.actualConcludedAt ? session.actualConcludedAt.toISOString() : null,
      lastHeartbeatAt: session.lastHeartbeatAt ? session.lastHeartbeatAt.toISOString() : null,
      currentStep,
      nextStep,
      steps,
    };
  }
}
