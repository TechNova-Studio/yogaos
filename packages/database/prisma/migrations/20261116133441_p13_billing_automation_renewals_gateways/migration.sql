-- CreateEnum
CREATE TYPE "PaymentGatewayProvider" AS ENUM ('RAZORPAY', 'STRIPE');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('NOT_APPLICABLE', 'MATCHED', 'UNMATCHED', 'MANUALLY_RECONCILED', 'DISCREPANCY');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('EXPIRY_APPROACHING', 'MEMBERSHIP_EXPIRED', 'INVOICE_OVERDUE', 'PAYMENT_REMINDER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MembershipRenewalStatus" AS ENUM ('UPCOMING', 'RENEWED', 'LAPSED', 'OPTED_OUT');

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "gatewayOrderId" TEXT,
ADD COLUMN     "gatewayPaymentId" TEXT,
ADD COLUMN     "gatewayProvider" "PaymentGatewayProvider",
ADD COLUMN     "gatewayResponse" JSONB,
ADD COLUMN     "gatewaySignature" TEXT,
ADD COLUMN     "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- AlterTable
ALTER TABLE "StudentMembership" ADD COLUMN     "autoRenewConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "renewalStatus" "MembershipRenewalStatus" NOT NULL DEFAULT 'UPCOMING',
ADD COLUMN     "renewedFromMembershipId" TEXT;

-- CreateTable
CREATE TABLE "PaymentGatewayConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "webhookSecret" TEXT,
    "merchantAccount" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signature" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "paymentTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingReminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentMembershipId" TEXT,
    "invoiceId" TEXT,
    "paymentTransactionId" TEXT,
    "reminderType" "ReminderType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "templateName" TEXT,
    "subject" TEXT,
    "messageBody" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_tenantId_idx" ON "PaymentGatewayConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayConfig_tenantId_provider_key" ON "PaymentGatewayConfig"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_status_idx" ON "WebhookEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_createdAt_idx" ON "WebhookEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "BillingReminder_tenantId_studentId_reminderType_idx" ON "BillingReminder"("tenantId", "studentId", "reminderType");

-- CreateIndex
CREATE INDEX "BillingReminder_tenantId_status_scheduledFor_idx" ON "BillingReminder"("tenantId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "PaymentTransaction_tenantId_gatewayOrderId_idx" ON "PaymentTransaction"("tenantId", "gatewayOrderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_tenantId_gatewayPaymentId_idx" ON "PaymentTransaction"("tenantId", "gatewayPaymentId");

-- AddForeignKey
ALTER TABLE "StudentMembership" ADD CONSTRAINT "StudentMembership_renewedFromMembershipId_fkey" FOREIGN KEY ("renewedFromMembershipId") REFERENCES "StudentMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGatewayConfig" ADD CONSTRAINT "PaymentGatewayConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReminder" ADD CONSTRAINT "BillingReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReminder" ADD CONSTRAINT "BillingReminder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReminder" ADD CONSTRAINT "BillingReminder_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "StudentMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReminder" ADD CONSTRAINT "BillingReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "TaxInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReminder" ADD CONSTRAINT "BillingReminder_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
