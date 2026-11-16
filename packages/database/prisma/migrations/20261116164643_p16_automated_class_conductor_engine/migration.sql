-- CreateEnum
CREATE TYPE "ConductorSessionStatus" AS ENUM ('READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'INTERRUPTED', 'INTERRUPTED_ABANDONED');

-- CreateEnum
CREATE TYPE "ConductorStepPhase" AS ENUM ('POSTURE_HOLD', 'BILATERAL_SIDE_A', 'BILATERAL_SIDE_B', 'REST_INTERVAL', 'TRANSITION');

-- CreateEnum
CREATE TYPE "ConductorEventType" AS ENUM ('SESSION_INITIALIZED', 'SESSION_STARTED', 'STEP_STARTED', 'STEP_COMPLETED', 'STEP_SKIPPED', 'STEP_PREVIOUS', 'TIME_ADJUSTED', 'SESSION_PAUSED', 'SESSION_RESUMED', 'SESSION_COMPLETED', 'SESSION_INTERRUPTED', 'SESSION_ABANDONED');

-- CreateTable
CREATE TABLE "ConductorSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionInstanceId" TEXT NOT NULL,
    "sequenceVersionId" TEXT NOT NULL,
    "conductorInstructorId" TEXT NOT NULL,
    "status" "ConductorSessionStatus" NOT NULL DEFAULT 'READY',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "currentPhase" "ConductorStepPhase" NOT NULL DEFAULT 'POSTURE_HOLD',
    "actualStartedAt" TIMESTAMP(3),
    "actualConcludedAt" TIMESTAMP(3),
    "totalElapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedStepsCount" INTEGER NOT NULL DEFAULT 0,
    "skippedStepsCount" INTEGER NOT NULL DEFAULT 0,
    "addedTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "clientSessionUuid" TEXT NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConductorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConductorExecutionEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conductorSessionId" TEXT NOT NULL,
    "clientEventUuid" TEXT NOT NULL,
    "eventType" "ConductorEventType" NOT NULL,
    "stepOrder" INTEGER,
    "clientTimestamp" TIMESTAMP(3) NOT NULL,
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConductorExecutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConductorSession_sessionInstanceId_key" ON "ConductorSession"("sessionInstanceId");

-- CreateIndex
CREATE INDEX "ConductorSession_tenantId_status_idx" ON "ConductorSession"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ConductorSession_sessionInstanceId_idx" ON "ConductorSession"("sessionInstanceId");

-- CreateIndex
CREATE INDEX "ConductorSession_sequenceVersionId_idx" ON "ConductorSession"("sequenceVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConductorExecutionEvent_clientEventUuid_key" ON "ConductorExecutionEvent"("clientEventUuid");

-- CreateIndex
CREATE INDEX "ConductorExecutionEvent_conductorSessionId_clientTimestamp_idx" ON "ConductorExecutionEvent"("conductorSessionId", "clientTimestamp");

-- CreateIndex
CREATE INDEX "ConductorExecutionEvent_tenantId_eventType_idx" ON "ConductorExecutionEvent"("tenantId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ConductorExecutionEvent_conductorSessionId_clientEventUuid_key" ON "ConductorExecutionEvent"("conductorSessionId", "clientEventUuid");

-- AddForeignKey
ALTER TABLE "ConductorSession" ADD CONSTRAINT "ConductorSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorSession" ADD CONSTRAINT "ConductorSession_sessionInstanceId_fkey" FOREIGN KEY ("sessionInstanceId") REFERENCES "ClassSessionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorSession" ADD CONSTRAINT "ConductorSession_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorSession" ADD CONSTRAINT "ConductorSession_conductorInstructorId_fkey" FOREIGN KEY ("conductorInstructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorExecutionEvent" ADD CONSTRAINT "ConductorExecutionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorExecutionEvent" ADD CONSTRAINT "ConductorExecutionEvent_conductorSessionId_fkey" FOREIGN KEY ("conductorSessionId") REFERENCES "ConductorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
