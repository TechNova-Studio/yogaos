-- CreateEnum
CREATE TYPE "SequenceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('TIME_HOLD', 'BREATH_COUNT', 'REPETITION');

-- CreateEnum
CREATE TYPE "StepSide" AS ENUM ('NONE', 'RIGHT', 'LEFT');

-- AlterTable
ALTER TABLE "ClassSessionInstance" ADD COLUMN     "attachedSequenceVersionId" TEXT;

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "targetLevel" "SequenceLevel" NOT NULL DEFAULT 'ALL_LEVELS',
    "intendedAudience" TEXT,
    "isStudioTemplate" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFT',
    "activeVersion" INTEGER NOT NULL DEFAULT 1,
    "estimatedTotalDurationSecs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEstimatedDurationSecs" INTEGER NOT NULL DEFAULT 0,
    "mediaManifest" JSONB,
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sequenceVersionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "asanaId" TEXT NOT NULL,
    "asanaNameSnapshot" TEXT,
    "sanskritNameSnapshot" TEXT,
    "executionMode" "ExecutionMode" NOT NULL DEFAULT 'TIME_HOLD',
    "durationSeconds" INTEGER NOT NULL DEFAULT 30,
    "repetitionCount" INTEGER,
    "isBilateral" BOOLEAN NOT NULL DEFAULT false,
    "side" "StepSide" NOT NULL DEFAULT 'NONE',
    "restIntervalSeconds" INTEGER NOT NULL DEFAULT 0,
    "voiceAudioMediaId" TEXT,
    "demoVideoMediaId" TEXT,
    "referenceImageMediaId" TEXT,
    "teacherNotes" TEXT,
    "cues" TEXT,
    "transitionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sequence_tenantId_status_idx" ON "Sequence"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Sequence_tenantId_title_idx" ON "Sequence"("tenantId", "title");

-- CreateIndex
CREATE INDEX "SequenceVersion_sequenceId_versionNumber_idx" ON "SequenceVersion"("sequenceId", "versionNumber");

-- CreateIndex
CREATE INDEX "SequenceVersion_tenantId_status_idx" ON "SequenceVersion"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceVersion_tenantId_sequenceId_versionNumber_key" ON "SequenceVersion"("tenantId", "sequenceId", "versionNumber");

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceVersionId_stepOrder_idx" ON "SequenceStep"("sequenceVersionId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceStep_tenantId_sequenceVersionId_stepOrder_key" ON "SequenceStep"("tenantId", "sequenceVersionId", "stepOrder");

-- AddForeignKey
ALTER TABLE "ClassSessionInstance" ADD CONSTRAINT "ClassSessionInstance_attachedSequenceVersionId_fkey" FOREIGN KEY ("attachedSequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceVersion" ADD CONSTRAINT "SequenceVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceVersion" ADD CONSTRAINT "SequenceVersion_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_asanaId_fkey" FOREIGN KEY ("asanaId") REFERENCES "Asana"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_voiceAudioMediaId_fkey" FOREIGN KEY ("voiceAudioMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_demoVideoMediaId_fkey" FOREIGN KEY ("demoVideoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_referenceImageMediaId_fkey" FOREIGN KEY ("referenceImageMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
