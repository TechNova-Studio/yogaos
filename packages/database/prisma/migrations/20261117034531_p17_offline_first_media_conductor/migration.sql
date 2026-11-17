-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConductorEventType" ADD VALUE 'OFFLINE_PREPARATION_STARTED';
ALTER TYPE "ConductorEventType" ADD VALUE 'OFFLINE_READY';
ALTER TYPE "ConductorEventType" ADD VALUE 'OFFLINE_VERIFICATION_FAILED';
ALTER TYPE "ConductorEventType" ADD VALUE 'MEDIA_PLAYBACK_STARTED';
ALTER TYPE "ConductorEventType" ADD VALUE 'MEDIA_PLAYBACK_ERROR';

-- AlterEnum
ALTER TYPE "ConductorSessionStatus" ADD VALUE 'OFFLINE_READY';

-- AlterTable
ALTER TABLE "ConductorSession" ADD COLUMN     "isOfflineReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offlinePreparedAt" TIMESTAMP(3),
ADD COLUMN     "preparationMetadata" JSONB;
