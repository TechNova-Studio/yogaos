-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('TIME_UNLIMITED', 'CLASS_PACK', 'SINGLE_DROP_IN');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditLedgerEntryType" AS ENUM ('INITIAL_ALLOCATION', 'REDEMPTION', 'REFUND_RESTORE', 'MANUAL_ADJUSTMENT', 'EXPIRATION');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "studentMembershipId" TEXT;

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planType" "PlanType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "sacCode" TEXT NOT NULL DEFAULT '9992',
    "validityDays" INTEGER NOT NULL,
    "creditCount" INTEGER,
    "maxFreezesAllowed" INTEGER NOT NULL DEFAULT 0,
    "maxFreezeDays" INTEGER NOT NULL DEFAULT 0,
    "isMultiBranchValid" BOOLEAN NOT NULL DEFAULT true,
    "homeBranchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "membershipPlanId" TEXT NOT NULL,
    "homeBranchId" TEXT,
    "planNameSnapshot" TEXT NOT NULL,
    "planTypeSnapshot" "PlanType" NOT NULL,
    "priceSnapshot" DECIMAL(10,2) NOT NULL,
    "isMultiBranchSnapshot" BOOLEAN NOT NULL DEFAULT true,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "totalCredits" INTEGER,
    "remainingCredits" INTEGER,
    "freezesUsed" INTEGER NOT NULL DEFAULT 0,
    "frozenAt" TIMESTAMP(3),
    "freezeReason" TEXT,
    "totalFrozenDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StudentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipCreditLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bookingId" TEXT,
    "entryType" "CreditLedgerEntryType" NOT NULL,
    "creditsDelta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipPlan_tenantId_isActive_idx" ON "MembershipPlan"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "MembershipPlan_tenantId_planType_idx" ON "MembershipPlan"("tenantId", "planType");

-- CreateIndex
CREATE INDEX "StudentMembership_tenantId_studentId_status_idx" ON "StudentMembership"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "StudentMembership_tenantId_expiryDate_idx" ON "StudentMembership"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "StudentMembership_membershipPlanId_idx" ON "StudentMembership"("membershipPlanId");

-- CreateIndex
CREATE INDEX "MembershipCreditLedger_tenantId_studentMembershipId_created_idx" ON "MembershipCreditLedger"("tenantId", "studentMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "MembershipCreditLedger_tenantId_studentId_idx" ON "MembershipCreditLedger"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "MembershipCreditLedger_bookingId_idx" ON "MembershipCreditLedger"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_studentMembershipId_idx" ON "Booking"("studentMembershipId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "StudentMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_homeBranchId_fkey" FOREIGN KEY ("homeBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMembership" ADD CONSTRAINT "StudentMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMembership" ADD CONSTRAINT "StudentMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMembership" ADD CONSTRAINT "StudentMembership_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMembership" ADD CONSTRAINT "StudentMembership_homeBranchId_fkey" FOREIGN KEY ("homeBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCreditLedger" ADD CONSTRAINT "MembershipCreditLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCreditLedger" ADD CONSTRAINT "MembershipCreditLedger_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "StudentMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCreditLedger" ADD CONSTRAINT "MembershipCreditLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCreditLedger" ADD CONSTRAINT "MembershipCreditLedger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCreditLedger" ADD CONSTRAINT "MembershipCreditLedger_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
