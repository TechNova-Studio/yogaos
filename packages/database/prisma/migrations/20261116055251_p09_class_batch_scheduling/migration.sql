-- CreateEnum
CREATE TYPE "ClassLevel" AS ENUM ('ALL_LEVELS', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "BatchScheduleType" AS ENUM ('RECURRING_WEEKLY', 'FIXED_WORKSHOP');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClassType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Hatha',
    "level" "ClassLevel" NOT NULL DEFAULT 'ALL_LEVELS',
    "defaultDurationMins" INTEGER NOT NULL DEFAULT 60,
    "defaultCapacity" INTEGER NOT NULL DEFAULT 20,
    "intensity" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClassType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teachingStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hourlyRate" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classTypeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduleType" "BatchScheduleType" NOT NULL DEFAULT 'RECURRING_WEEKLY',
    "status" "BatchStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL,
    "sessionDurationMins" INTEGER NOT NULL DEFAULT 60,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClassBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSessionInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT,
    "classTypeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "startTimestamp" TIMESTAMP(3) NOT NULL,
    "endTimestamp" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSessionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassType_tenantId_isActive_idx" ON "ClassType"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ClassType_tenantId_category_idx" ON "ClassType"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ClassType_tenantId_name_key" ON "ClassType"("tenantId", "name");

-- CreateIndex
CREATE INDEX "InstructorProfile_tenantId_userId_idx" ON "InstructorProfile"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorProfile_tenantId_userId_key" ON "InstructorProfile"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ClassBatch_tenantId_status_idx" ON "ClassBatch"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ClassBatch_tenantId_branchId_idx" ON "ClassBatch"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "ClassBatch_tenantId_roomId_idx" ON "ClassBatch"("tenantId", "roomId");

-- CreateIndex
CREATE INDEX "ClassBatch_tenantId_instructorId_idx" ON "ClassBatch"("tenantId", "instructorId");

-- CreateIndex
CREATE INDEX "ClassSessionInstance_tenantId_sessionDate_idx" ON "ClassSessionInstance"("tenantId", "sessionDate");

-- CreateIndex
CREATE INDEX "ClassSessionInstance_tenantId_startTimestamp_idx" ON "ClassSessionInstance"("tenantId", "startTimestamp");

-- CreateIndex
CREATE INDEX "ClassSessionInstance_tenantId_status_idx" ON "ClassSessionInstance"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ClassSessionInstance_roomId_startTimestamp_endTimestamp_idx" ON "ClassSessionInstance"("roomId", "startTimestamp", "endTimestamp");

-- CreateIndex
CREATE INDEX "ClassSessionInstance_instructorId_startTimestamp_endTimesta_idx" ON "ClassSessionInstance"("instructorId", "startTimestamp", "endTimestamp");

-- CreateIndex
CREATE INDEX "ClassSessionInstance_batchId_idx" ON "ClassSessionInstance"("batchId");

-- AddForeignKey
ALTER TABLE "ClassType" ADD CONSTRAINT "ClassType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_classTypeId_fkey" FOREIGN KEY ("classTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionInstance" ADD CONSTRAINT "ClassSessionInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionInstance" ADD CONSTRAINT "ClassSessionInstance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ClassBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionInstance" ADD CONSTRAINT "ClassSessionInstance_classTypeId_fkey" FOREIGN KEY ("classTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionInstance" ADD CONSTRAINT "ClassSessionInstance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionInstance" ADD CONSTRAINT "ClassSessionInstance_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionInstance" ADD CONSTRAINT "ClassSessionInstance_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
