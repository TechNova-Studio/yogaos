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
  ConductorBatchSyncInput,
  ConductorBatchSyncResponse,
  ConductorRecoveryResponse,
  ConductorRecoverSessionInput,
  ConductorSessionHistoryFilter,
  ConductorSessionHistoryResponse,
  ConductorSessionHistoryItem,
  ConductorExecutionEventDetail,
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
   * Idempotently ingest a batch of locally queued offline execution events.
   */
  async syncEvents(
    tenantId: string,
    sessionInstanceId: string,
    input: ConductorBatchSyncInput,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorBatchSyncResponse> {
    const { events, sessionStateSnapshot } = input;

    // 1. Fetch ConductorSession with tenant isolation
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

    // 2. Authorization: OWNER, MANAGER, or assigned INSTRUCTOR
    if (
      userRole === UserRole.INSTRUCTOR &&
      conductorSession.conductorInstructorId !== userId &&
      conductorSession.sessionInstance.instructorId !== userId
    ) {
      throw new ForbiddenException('Instructors can only sync their own class conductor sessions.');
    }

    // 3. Collect clientEventUuids and check existing events for idempotency
    const eventUuids = events.map((e) => e.clientEventUuid);
    const existingEvents = await prisma.conductorExecutionEvent.findMany({
      where: { clientEventUuid: { in: eventUuids } },
      select: { clientEventUuid: true },
    });
    const existingUuidSet = new Set(existingEvents.map((e) => e.clientEventUuid));

    const alreadyProcessedEventUuids: string[] = [];
    const newEventsToInsert: typeof events = [];

    for (const evt of events) {
      if (existingUuidSet.has(evt.clientEventUuid)) {
        alreadyProcessedEventUuids.push(evt.clientEventUuid);
      } else {
        newEventsToInsert.push(evt);
      }
    }

    // 4. Sanitize payloads: ensure student clinical health data never enters payloads
    const sanitizedInserts = newEventsToInsert.map((e) => {
      const payload = e.payload ? { ...e.payload } : {};
      delete (payload as any).healthNotes;
      delete (payload as any).medicalHistory;
      delete (payload as any).injuries;
      return {
        tenantId,
        conductorSessionId: conductorSession.id,
        clientEventUuid: e.clientEventUuid,
        eventType: e.eventType as ConductorEventType,
        stepOrder: e.stepOrder ?? null,
        clientTimestamp: new Date(e.clientTimestamp),
        serverReceivedAt: new Date(),
        payload: payload as any,
        isOfflineSync: true,
      };
    });

    // 5. Reconcile progress using ConductorStateMachine
    const serverSnapshot = {
      status: conductorSession.status,
      currentStepIndex: conductorSession.currentStepIndex,
      currentPhase: conductorSession.currentPhase,
      totalElapsedSeconds: conductorSession.totalElapsedSeconds,
      completedStepsCount: conductorSession.completedStepsCount,
      skippedStepsCount: conductorSession.skippedStepsCount,
      addedTimeSeconds: conductorSession.addedTimeSeconds,
    };

    const reconciled = ConductorStateMachine.reconcileProgress(
      serverSnapshot,
      sessionStateSnapshot
    );

    const now = new Date();

    // 6. Execute in transaction
    const updated = await prisma.$transaction(async (tx) => {
      if (sanitizedInserts.length > 0) {
        await tx.conductorExecutionEvent.createMany({
          data: sanitizedInserts,
          skipDuplicates: true,
        });
      }

      const session = await tx.conductorSession.update({
        where: { id: conductorSession.id },
        data: {
          status: reconciled.status,
          currentStepIndex: reconciled.currentStepIndex,
          currentPhase: reconciled.currentPhase,
          completedStepsCount: reconciled.completedStepsCount,
          skippedStepsCount: reconciled.skippedStepsCount,
          totalElapsedSeconds: reconciled.totalElapsedSeconds,
          addedTimeSeconds: reconciled.addedTimeSeconds,
          lastSyncAt: now,
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

      return session;
    });

    const acknowledgedEventUuids = [
      ...alreadyProcessedEventUuids,
      ...newEventsToInsert.map((e) => e.clientEventUuid),
    ];

    await this.audit.log({
      tenantId,
      userId,
      action: 'CONDUCTOR_EVENTS_SYNCED',
      resourceType: 'CONDUCTOR_SESSION',
      resourceId: conductorSession.id,
      details: {
        totalReceived: events.length,
        newlyInserted: newEventsToInsert.length,
        alreadyProcessed: alreadyProcessedEventUuids.length,
      },
    });

    return {
      acknowledgedEventUuids,
      alreadyProcessedEventUuids,
      failedEventUuids: [],
      currentState: this.mapToState(updated),
      syncedAt: now.toISOString(),
    };
  }

  /**
   * Get recovery diagnostic information for a conductor session.
   */
  async getRecoveryState(
    tenantId: string,
    sessionInstanceId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorRecoveryResponse> {
    const sessionState = await this.getSession(tenantId, sessionInstanceId, userId, userRole);

    const isUnfinished =
      sessionState.status === 'RUNNING' ||
      sessionState.status === 'PAUSED' ||
      sessionState.status === 'INTERRUPTED';

    const isInterrupted = sessionState.status === 'INTERRUPTED';
    const isAbandoned = sessionState.status === 'INTERRUPTED_ABANDONED';
    const canResume = isUnfinished && !isAbandoned;

    // Latest event
    const lastEvent = await prisma.conductorExecutionEvent.findFirst({
      where: { conductorSessionId: sessionState.id, tenantId },
      orderBy: { clientTimestamp: 'desc' },
      select: { clientTimestamp: true },
    });

    return {
      session: sessionState,
      isUnfinished,
      isInterrupted,
      isAbandoned,
      canResume,
      serverLastEventAt: lastEvent ? lastEvent.clientTimestamp.toISOString() : sessionState.lastHeartbeatAt,
      lastSyncAt: sessionState.lastSyncAt,
    };
  }

  /**
   * Explicit instructor action to resume or abandon an interrupted or paused session.
   */
  async recoverSession(
    tenantId: string,
    sessionInstanceId: string,
    input: ConductorRecoverSessionInput,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorSessionState> {
    const { action, reason, clientEventUuid, clientTimestamp } = input;

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

    if (
      userRole === UserRole.INSTRUCTOR &&
      conductorSession.conductorInstructorId !== userId &&
      conductorSession.sessionInstance.instructorId !== userId
    ) {
      throw new ForbiddenException('Instructors can only recover their own class conductor sessions.');
    }

    // Terminal state invariant
    if (ConductorStateMachine.isTerminal(conductorSession.status)) {
      throw new BadRequestException(
        `Cannot recover session in terminal state '${conductorSession.status}'.`
      );
    }

    // Idempotency
    const existing = await prisma.conductorExecutionEvent.findUnique({
      where: { clientEventUuid },
    });
    if (existing) {
      return this.mapToState(conductorSession);
    }

    const now = new Date();
    const eventTime = clientTimestamp ? new Date(clientTimestamp) : now;
    let newStatus: ConductorSessionStatus = conductorSession.status;
    let eventType: ConductorEventType = 'SESSION_RECOVERED';

    if (action === 'RESUME') {
      ConductorStateMachine.assertValidTransition(conductorSession.status, 'RUNNING');
      newStatus = 'RUNNING';
      eventType = 'SESSION_RESUMED';
    } else if (action === 'ABANDON') {
      ConductorStateMachine.assertValidTransition(conductorSession.status, 'INTERRUPTED_ABANDONED');
      newStatus = 'INTERRUPTED_ABANDONED';
      eventType = 'SESSION_ABANDONED';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const session = await tx.conductorSession.update({
        where: { id: conductorSession.id },
        data: {
          status: newStatus,
          lastHeartbeatAt: now,
          actualConcludedAt: newStatus === 'INTERRUPTED_ABANDONED' ? now : conductorSession.actualConcludedAt,
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
          clientTimestamp: eventTime,
          payload: {
            recoveryAction: action,
            reason: reason || (action === 'RESUME' ? 'Instructor resumed session' : 'Instructor abandoned session'),
          },
        },
      });

      return session;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: action === 'RESUME' ? 'CONDUCTOR_SESSION_RECOVERED' : 'CONDUCTOR_SESSION_ABANDONED',
      resourceType: 'CONDUCTOR_SESSION',
      resourceId: conductorSession.id,
      details: { reason },
    });

    return this.mapToState(updated);
  }

  /**
   * Retrieve past conductor sessions with instructor/branch filtering.
   */
  async getSessionHistory(
    tenantId: string,
    filters: ConductorSessionHistoryFilter,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorSessionHistoryResponse> {
    const where: any = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }

    // Role filtering: INSTRUCTOR sees only their own sessions
    if (userRole === UserRole.INSTRUCTOR) {
      where.conductorInstructorId = userId;
    } else if (filters.instructorId) {
      where.conductorInstructorId = filters.instructorId;
    }

    const [total, sessions] = await Promise.all([
      prisma.conductorSession.count({ where }),
      prisma.conductorSession.findMany({
        where,
        take: filters.limit,
        skip: filters.offset,
        orderBy: { createdAt: 'desc' },
        include: {
          sessionInstance: {
            include: {
              branch: true,
              room: true,
            },
          },
          sequenceVersion: {
            include: {
              sequence: true,
            },
          },
          conductorInstructor: {
            select: {
              id: true,
              fullName: true,
            },
          },
          _count: {
            select: { events: true },
          },
        },
      }),
    ]);

    const items: ConductorSessionHistoryItem[] = sessions.map((s) => ({
      id: s.id,
      sessionInstanceId: s.sessionInstanceId,
      sequenceTitle: s.sequenceVersion?.sequence?.title || 'Yoga Sequence',
      sequenceVersionId: s.sequenceVersionId,
      instructorId: s.conductorInstructorId,
      instructorName: s.conductorInstructor?.fullName || 'Instructor',
      sessionDate: s.sessionInstance.sessionDate.toISOString(),
      branchName: s.sessionInstance.branch?.name,
      roomName: s.sessionInstance.room?.name,
      status: s.status,
      totalSteps: s.completedStepsCount + s.skippedStepsCount,
      completedStepsCount: s.completedStepsCount,
      skippedStepsCount: s.skippedStepsCount,
      totalElapsedSeconds: s.totalElapsedSeconds,
      actualStartedAt: s.actualStartedAt ? s.actualStartedAt.toISOString() : null,
      actualConcludedAt: s.actualConcludedAt ? s.actualConcludedAt.toISOString() : null,
      lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
      eventsCount: s._count.events,
      createdAt: s.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  /**
   * Retrieve execution events timeline for an authorized session.
   */
  async getSessionEvents(
    tenantId: string,
    sessionInstanceId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ConductorExecutionEventDetail[]> {
    const conductorSession = await prisma.conductorSession.findFirst({
      where: { sessionInstanceId, tenantId },
      include: { sessionInstance: true },
    });

    if (!conductorSession) {
      throw new NotFoundException(`Conductor session for class instance '${sessionInstanceId}' not found.`);
    }

    if (
      userRole === UserRole.INSTRUCTOR &&
      conductorSession.conductorInstructorId !== userId &&
      conductorSession.sessionInstance.instructorId !== userId
    ) {
      throw new ForbiddenException('Instructors can only view events for their own class conductor sessions.');
    }

    const events = await prisma.conductorExecutionEvent.findMany({
      where: { conductorSessionId: conductorSession.id, tenantId },
      orderBy: { clientTimestamp: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      clientEventUuid: e.clientEventUuid,
      eventType: e.eventType,
      stepOrder: e.stepOrder,
      clientTimestamp: e.clientTimestamp.toISOString(),
      serverReceivedAt: e.serverReceivedAt.toISOString(),
      payload: (e.payload as Record<string, unknown>) || null,
      isOfflineSync: e.isOfflineSync,
    }));
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
      lastSyncAt: session.lastSyncAt ? session.lastSyncAt.toISOString() : null,
      currentStep,
      nextStep,
      steps,
    };
  }
}
