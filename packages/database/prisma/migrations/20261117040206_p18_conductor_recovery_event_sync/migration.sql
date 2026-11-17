-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConductorEventType" ADD VALUE 'SESSION_RECOVERED';
ALTER TYPE "ConductorEventType" ADD VALUE 'OFFLINE_SYNC_COMPLETED';

-- AlterTable
ALTER TABLE "ConductorExecutionEvent" ADD COLUMN     "isOfflineSync" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ConductorSession" ADD COLUMN     "lastSyncAt" TIMESTAMP(3);
