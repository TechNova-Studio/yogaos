-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'ATTENDED', 'LATE_CANCEL', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('FRONT_DESK', 'ONLINE', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'PROMOTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('FRONT_DESK_ROSTER', 'KIOSK', 'MANUAL_OVERRIDE');

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionInstanceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "source" "BookingSource" NOT NULL DEFAULT 'FRONT_DESK',
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "notes" TEXT,
    "isPassCreditDeducted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionInstanceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "priorityRank" INTEGER NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "promotedToBookingId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInByUserId" TEXT NOT NULL,
    "checkInMethod" "CheckInMethod" NOT NULL DEFAULT 'FRONT_DESK_ROSTER',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_tenantId_sessionInstanceId_status_idx" ON "Booking"("tenantId", "sessionInstanceId", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_studentId_idx" ON "Booking"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Booking_sessionInstanceId_status_idx" ON "Booking"("sessionInstanceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_tenantId_sessionInstanceId_studentId_key" ON "Booking"("tenantId", "sessionInstanceId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_promotedToBookingId_key" ON "WaitlistEntry"("promotedToBookingId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_sessionInstanceId_status_priorityRan_idx" ON "WaitlistEntry"("tenantId", "sessionInstanceId", "status", "priorityRank");

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_studentId_idx" ON "WaitlistEntry"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_tenantId_sessionInstanceId_priorityRank_key" ON "WaitlistEntry"("tenantId", "sessionInstanceId", "priorityRank");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_tenantId_sessionInstanceId_studentId_key" ON "WaitlistEntry"("tenantId", "sessionInstanceId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_bookingId_key" ON "AttendanceRecord"("bookingId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_checkedInAt_idx" ON "AttendanceRecord"("tenantId", "checkedInAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_checkedInByUserId_idx" ON "AttendanceRecord"("checkedInByUserId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sessionInstanceId_fkey" FOREIGN KEY ("sessionInstanceId") REFERENCES "ClassSessionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_sessionInstanceId_fkey" FOREIGN KEY ("sessionInstanceId") REFERENCES "ClassSessionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_promotedToBookingId_fkey" FOREIGN KEY ("promotedToBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
