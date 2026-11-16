-- CreateEnum
CREATE TYPE "AsanaCategory" AS ENUM ('STANDING', 'SEATED', 'PRONE', 'SUPINE', 'INVERSION', 'BACKBEND', 'FORWARD_BEND', 'TWIST', 'ARM_BALANCE', 'RESTORATIVE', 'PRANAYAMA', 'MEDITATION');

-- CreateEnum
CREATE TYPE "AsanaDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "AsanaStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Asana" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "sanskritName" TEXT NOT NULL,
    "sanskritNameIast" TEXT,
    "englishName" TEXT NOT NULL,
    "commonName" TEXT,
    "description" TEXT,
    "instructions" TEXT,
    "alignmentCues" TEXT,
    "category" "AsanaCategory" NOT NULL,
    "difficulty" "AsanaDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "status" "AsanaStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isSharedReference" BOOLEAN NOT NULL DEFAULT false,
    "anatomicalFocus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contraindications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cautions" TEXT,
    "prepPoses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followUpPoses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryMediaId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Asana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "uploadedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaType" "MediaType" NOT NULL,
    "mediaStatus" "MediaStatus" NOT NULL DEFAULT 'READY',
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "sha256Hash" TEXT,
    "metadata" JSONB,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsanaMedia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "asanaId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsanaMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asana_tenantId_category_difficulty_idx" ON "Asana"("tenantId", "category", "difficulty");

-- CreateIndex
CREATE INDEX "Asana_tenantId_status_idx" ON "Asana"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Asana_englishName_sanskritName_idx" ON "Asana"("englishName", "sanskritName");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_mediaType_isArchived_idx" ON "MediaAsset"("tenantId", "mediaType", "isArchived");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_createdAt_idx" ON "MediaAsset"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AsanaMedia_asanaId_sortOrder_idx" ON "AsanaMedia"("asanaId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AsanaMedia_asanaId_mediaAssetId_key" ON "AsanaMedia"("asanaId", "mediaAssetId");

-- AddForeignKey
ALTER TABLE "Asana" ADD CONSTRAINT "Asana_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asana" ADD CONSTRAINT "Asana_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asana" ADD CONSTRAINT "Asana_primaryMediaId_fkey" FOREIGN KEY ("primaryMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsanaMedia" ADD CONSTRAINT "AsanaMedia_asanaId_fkey" FOREIGN KEY ("asanaId") REFERENCES "Asana"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsanaMedia" ADD CONSTRAINT "AsanaMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
