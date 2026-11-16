import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'node:crypto';
import {
  prisma,
  UserRole,
  MemberStatus,
  MembershipStatus,
  MembershipRenewalStatus,
  PaymentGatewayProvider,
  ReconciliationStatus,
  NotificationDeliveryStatus,
  InvoiceStatus,
  PaymentStatus,
} from '@yogaos/database';
import { TaxSettingsService } from '../src/modules/billing/tax-settings.service.js';
import { NumberingService } from '../src/modules/billing/numbering.service.js';
import { InvoicesService } from '../src/modules/billing/invoices.service.js';
import { PaymentsService } from '../src/modules/billing/payments.service.js';
import { RenewalsService } from '../src/modules/billing/renewals.service.js';
import { RemindersService } from '../src/modules/billing/reminders.service.js';
import { GatewaysService } from '../src/modules/billing/gateways.service.js';
import { CreditLedgerService } from '../src/modules/student-plans/credit-ledger.service.js';
import { StudentMembershipsService } from '../src/modules/student-plans/student-memberships.service.js';
import { PlansService } from '../src/modules/student-plans/plans.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('P13 Real Database Integration Tests (Renewals, Reminders, Payment Gateways & Reconciliation)', () => {
  let auditService: AuditService;
  let taxSettingsService: TaxSettingsService;
  let numberingService: NumberingService;
  let invoicesService: InvoicesService;
  let paymentsService: PaymentsService;
  let renewalsService: RenewalsService;
  let remindersService: RemindersService;
  let gatewaysService: GatewaysService;
  let creditLedgerService: CreditLedgerService;
  let studentMembershipsService: StudentMembershipsService;
  let plansService: PlansService;

  // Cleanup tracking
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];

  // Tenants & entities
  let tenantA: string;
  let tenantB: string;
  let staffA: string;
  let staffB: string;
  let branchA: string;
  let branchB: string;

  let studentA1: string;
  let studentA2: string;
  let studentB1: string;

  let planA: any;
  let planUnlimitedA: any;
  let planB: any;

  let membershipExpiringA: any;
  let membershipExpiredA: any;
  let membershipB: any;

  const razorpaySecret = 'rzp_sec_test_12345';

  beforeAll(async () => {
    auditService = new AuditService();
    taxSettingsService = new TaxSettingsService(auditService);
    numberingService = new NumberingService();
    creditLedgerService = new CreditLedgerService(auditService);
    studentMembershipsService = new StudentMembershipsService(auditService, creditLedgerService);
    plansService = new PlansService(auditService);
    invoicesService = new InvoicesService(numberingService, taxSettingsService, auditService);
    paymentsService = new PaymentsService(numberingService, auditService);
    renewalsService = new RenewalsService(invoicesService, paymentsService, auditService);
    remindersService = new RemindersService(auditService);
    gatewaysService = new GatewaysService(auditService);

    // 1. Create Tenant A
    const orgA = await prisma.organization.create({
      data: {
        name: 'Ashtanga Yoga Shala A (P13 Test)',
        slug: `ashtanga-p13-a-${Date.now()}`,
        legalEntityName: 'Ashtanga Shala Private Limited',
        isGstRegistered: true,
        gstin: '07AAAAA0000A1Z5',
        settings: {
          defaultTaxRatePercent: 18.0,
          defaultSacCode: '9992',
          supplierStateCode: 'DL',
        },
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    // 2. Create Tenant B (for multi-tenant isolation verification)
    const orgB = await prisma.organization.create({
      data: {
        name: 'Sivananda Yoga Center B (P13 Test)',
        slug: `sivananda-p13-b-${Date.now()}`,
        legalEntityName: 'Sivananda Yoga Center LLP',
        isGstRegistered: false,
        settings: {
          defaultTaxRatePercent: 0,
          defaultSacCode: '9992',
          supplierStateCode: 'MH',
        },
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 3. Create Branches
    const bA = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'Connaught Place Shala',
        slug: `cp-shala-${Date.now()}`,
        streetAddress: 'A-45 Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        stateCode: 'DL',
        postalCode: '110001',
        phone: '+919911122334',
        email: 'cp@ashtanga.test',
      },
    });
    branchA = bA.id;

    const bB = await prisma.branch.create({
      data: {
        tenantId: tenantB,
        name: 'Bandra Center',
        slug: `bandra-${Date.now()}`,
        streetAddress: '12 Hill Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: 'MH',
        postalCode: '400050',
        phone: '+919922233445',
        email: 'bandra@sivananda.test',
      },
    });
    branchB = bB.id;

    // 4. Create Staff Users
    const uA = await prisma.user.create({
      data: {
        email: `staff.p13.a.${Date.now()}@yogaos.dev`,
        fullName: 'Staff Owner A',
      },
    });
    staffA = uA.id;
    createdUserIds.push(staffA);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: staffA,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });

    const uB = await prisma.user.create({
      data: {
        email: `staff.p13.b.${Date.now()}@yogaos.dev`,
        fullName: 'Staff Owner B',
      },
    });
    staffB = uB.id;
    createdUserIds.push(staffB);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: staffB,
        role: UserRole.OWNER,
        status: MemberStatus.ACTIVE,
      },
    });

    // 5. Create Students
    const stA1 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        fullName: 'Vikram Seth',
        email: `vikram.p13.${Date.now()}@yogaos.dev`,
        mobilePhone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'ACTIVE',
        homeBranchId: branchA,
        emergencyContactName: 'Aarti Seth',
        emergencyContactPhone: '+919876543202',
        emergencyContactRelation: 'Spouse',
        billingStateCode: 'DL',
      },
    });
    studentA1 = stA1.id;
    createdStudentIds.push(studentA1);

    const stA2 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        fullName: 'Meera Rajput',
        email: `meera.p13.${Date.now()}@yogaos.dev`,
        mobilePhone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'ACTIVE',
        homeBranchId: branchA,
        emergencyContactName: 'Rajesh Rajput',
        emergencyContactPhone: '+919876543204',
        emergencyContactRelation: 'Father',
        billingStateCode: 'DL',
      },
    });
    studentA2 = stA2.id;
    createdStudentIds.push(studentA2);

    const stB1 = await prisma.student.create({
      data: {
        tenantId: tenantB,
        fullName: 'Rohan Sharma',
        email: `rohan.p13.${Date.now()}@yogaos.dev`,
        mobilePhone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'ACTIVE',
        homeBranchId: branchB,
        emergencyContactName: 'Sunita Sharma',
        emergencyContactPhone: '+919876543206',
        emergencyContactRelation: 'Mother',
        billingStateCode: 'MH',
      },
    });
    studentB1 = stB1.id;
    createdStudentIds.push(studentB1);

    // 6. Create Membership Plans
    planA = await plansService.createPlan(
      tenantA,
      {
        name: 'Monthly 10 Class Pass',
        planType: 'CLASS_PACK',
        price: 4500,
        creditCount: 10,
        validityDays: 30,
        durationDays: 30,
        isMultiBranchValid: true,
      },
      staffA
    );

    planUnlimitedA = await plansService.createPlan(
      tenantA,
      {
        name: 'Quarterly Unlimited Ashtanga',
        planType: 'TIME_UNLIMITED',
        price: 12000,
        validityDays: 90,
        durationDays: 90,
        isMultiBranchValid: true,
      },
      staffA
    );

    planB = await plansService.createPlan(
      tenantB,
      {
        name: 'Mumbai 10 Class Pass',
        planType: 'CLASS_PACK',
        price: 5000,
        creditCount: 10,
        validityDays: 30,
        durationDays: 30,
        isMultiBranchValid: true,
      },
      staffB
    );

    // 7. Create Existing Memberships:
    // (a) One expiring in 3 days
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const start30DaysAgo = new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000);

    membershipExpiringA = await prisma.studentMembership.create({
      data: {
        tenantId: tenantA,
        studentId: studentA1,
        membershipPlanId: planA.id,
        homeBranchId: branchA,
        planNameSnapshot: planA.name,
        planTypeSnapshot: planA.planType,
        priceSnapshot: planA.price,
        isMultiBranchSnapshot: true,
        status: MembershipStatus.ACTIVE,
        startDate: start30DaysAgo,
        expiryDate: in3Days,
        totalCredits: 10,
        remainingCredits: 2,
        renewalStatus: MembershipRenewalStatus.UPCOMING,
      },
    });

    // (b) One already expired (expired 5 days ago)
    const start40DaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    const expired5DaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    membershipExpiredA = await prisma.studentMembership.create({
      data: {
        tenantId: tenantA,
        studentId: studentA2,
        membershipPlanId: planUnlimitedA.id,
        homeBranchId: branchA,
        planNameSnapshot: planUnlimitedA.name,
        planTypeSnapshot: planUnlimitedA.planType,
        priceSnapshot: planUnlimitedA.price,
        isMultiBranchSnapshot: true,
        status: MembershipStatus.ACTIVE,
        startDate: start40DaysAgo,
        expiryDate: expired5DaysAgo,
        totalCredits: null,
        remainingCredits: null,
        renewalStatus: MembershipRenewalStatus.UPCOMING,
      },
    });

    // (c) Tenant B membership
    membershipB = await prisma.studentMembership.create({
      data: {
        tenantId: tenantB,
        studentId: studentB1,
        membershipPlanId: planB.id,
        homeBranchId: branchB,
        planNameSnapshot: planB.name,
        planTypeSnapshot: planB.planType,
        priceSnapshot: planB.price,
        isMultiBranchSnapshot: true,
        status: MembershipStatus.ACTIVE,
        startDate: start30DaysAgo,
        expiryDate: in3Days,
        totalCredits: 10,
        remainingCredits: 4,
        renewalStatus: MembershipRenewalStatus.UPCOMING,
      },
    });
  });

  afterAll(async () => {
    // Teardown test orgs and associated cascade records
    for (const orgId of createdOrgIds) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
    for (const userId of createdUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // 1. Membership Renewal Workflows
  // --------------------------------------------------------------------------
  describe('Membership Renewal Workflows', () => {
    it('detects upcoming expiries (3 days ahead) and expired memberships in Tenant A', async () => {
      const result = await renewalsService.getUpcomingRenewals(tenantA, {
        daysAhead: 7,
        includeExpired: true,
      });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      const foundExpiring = result.items.find((i) => i.id === membershipExpiringA.id);
      expect(foundExpiring).toBeDefined();
      expect(foundExpiring?.studentName).toBe('Vikram Seth');
      expect(foundExpiring?.isExpired).toBe(false);
      expect(foundExpiring?.daysRemaining).toBeLessThanOrEqual(4);

      const foundExpired = result.items.find((i) => i.id === membershipExpiredA.id);
      expect(foundExpired).toBeDefined();
      expect(foundExpired?.studentName).toBe('Meera Rajput');
      expect(foundExpired?.isExpired).toBe(true);
      expect(foundExpired?.daysRemaining).toBeLessThan(0);
    });

    it('performs staff-assisted renewal with snapshot preservation, credit allocation, and invoicing', async () => {
      const renewalResult = await renewalsService.renewMembership(
        tenantA,
        {
          studentMembershipId: membershipExpiringA.id,
          collectPaymentNow: true,
          paymentMode: 'UPI',
          utrReference: 'UPI-RENEW-12345',
        },
        staffA
      );

      expect(renewalResult.newMembershipId).toBeDefined();
      expect(renewalResult.previousMembershipId).toBe(membershipExpiringA.id);
      expect(renewalResult.totalCredits).toBe(10);
      expect(renewalResult.invoiceId).toBeDefined();
      expect(renewalResult.paymentTransactionId).toBeDefined();

      // Verify previous membership status is updated to RENEWED
      const oldMembership = await prisma.studentMembership.findUnique({
        where: { id: membershipExpiringA.id },
      });
      expect(oldMembership?.renewalStatus).toBe(MembershipRenewalStatus.RENEWED);

      // Verify new membership is linked to previous membership
      const newMembership = await prisma.studentMembership.findUnique({
        where: { id: renewalResult.newMembershipId },
      });
      expect(newMembership?.renewedFromMembershipId).toBe(membershipExpiringA.id);
      expect(newMembership?.status).toBe(MembershipStatus.ACTIVE);
      expect(newMembership?.remainingCredits).toBe(10);

      // Verify Credit Ledger has INITIAL_ALLOCATION
      const ledgerEntries = await prisma.membershipCreditLedger.findMany({
        where: { studentMembershipId: renewalResult.newMembershipId },
      });
      expect(ledgerEntries.length).toBe(1);
      expect(ledgerEntries[0].creditsDelta).toBe(10);
      expect(ledgerEntries[0].entryType).toBe('INITIAL_ALLOCATION');

      // Verify invoice & payment were created and linked
      const invoice = await prisma.taxInvoice.findUnique({
        where: { id: renewalResult.invoiceId },
      });
      expect(invoice).toBeDefined();
      expect(invoice?.status).toBe(InvoiceStatus.PAID);
      expect(Number(invoice?.balanceDue)).toBe(0);

      const payment = await prisma.paymentTransaction.findUnique({
        where: { id: renewalResult.paymentTransactionId },
      });
      expect(payment?.status).toBe(PaymentStatus.COMPLETED);
      expect(payment?.utrReference).toBe('UPI-RENEW-12345');
    });

    it('prevents duplicate renewal of the same membership cycle (ConflictException)', async () => {
      await expect(
        renewalsService.renewMembership(
          tenantA,
          {
            studentMembershipId: membershipExpiringA.id,
          },
          staffA
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Billing Reminders & Notifications
  // --------------------------------------------------------------------------
  describe('Billing Reminders & Notifications', () => {
    let reminderId: string;

    it('creates an expiry approaching reminder for a student', async () => {
      const reminder = await remindersService.createReminder(
        tenantA,
        {
          studentId: studentA1,
          studentMembershipId: membershipExpiringA.id,
          reminderType: 'EXPIRY_APPROACHING',
          channel: 'EMAIL',
          subject: 'Your Yoga Pass is Expiring Soon!',
          messageBody: 'Namaste Vikram, your pass expires in 3 days. Renew now.',
        },
        staffA
      );

      expect(reminder.id).toBeDefined();
      expect(reminder.studentId).toBe(studentA1);
      expect(reminder.status).toBe(NotificationDeliveryStatus.DELIVERED); // Auto-dispatched because scheduled for now
      reminderId = reminder.id;
    });

    it('deduplicates identical reminders within 24 hours', async () => {
      const duplicateReminder = await remindersService.createReminder(
        tenantA,
        {
          studentId: studentA1,
          studentMembershipId: membershipExpiringA.id,
          reminderType: 'EXPIRY_APPROACHING',
          channel: 'EMAIL',
          subject: 'Your Yoga Pass is Expiring Soon! (Again)',
          messageBody: 'Namaste Vikram, duplicate message.',
        },
        staffA
      );

      expect(duplicateReminder.id).toBe(reminderId);
      expect(duplicateReminder.deduplicated).toBe(true);
    });

    it('scans and generates automated reminders for expiring memberships and overdue invoices', async () => {
      const scanResult = await remindersService.scanAndGenerateReminders(tenantA);
      expect(scanResult.scannedExpiringMemberships).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Payment Gateway Integrations & Checkout
  // --------------------------------------------------------------------------
  describe('Payment Gateways & Webhooks', () => {
    let testInvoice: any;
    let checkoutSession: any;

    beforeAll(async () => {
      // Create gateway config for Tenant A
      await gatewaysService.upsertConfig(
        tenantA,
        {
          provider: 'RAZORPAY',
          isEnabled: true,
          isTestMode: true,
          apiKey: 'rzp_test_yogaos_key',
          apiSecret: 'rzp_test_yogaos_secret',
          webhookSecret: razorpaySecret,
        },
        staffA
      );

      // Create an open invoice to checkout
      testInvoice = await invoicesService.createInvoice(
        tenantA,
        {
          studentId: studentA1,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          lineItems: [
            {
              description: 'Drop-In Session Pass',
              sacCode: '9992',
              quantity: 1,
              unitPrice: 1000,
              taxRatePercent: 18,
            },
          ],
        },
        staffA
      );
    });

    it('stores gateway configuration with masked credentials', async () => {
      const configs = await gatewaysService.getConfigs(tenantA);
      expect(configs.length).toBe(1);
      expect(configs[0].provider).toBe(PaymentGatewayProvider.RAZORPAY);
      expect(configs[0].apiKey).toContain('...');
      expect(configs[0].hasSecret).toBe(true);
      expect(configs[0].hasWebhookSecret).toBe(true);
    });

    it('initiates online checkout session and creates PENDING payment transaction', async () => {
      checkoutSession = await gatewaysService.initiateCheckout(
        tenantA,
        {
          invoiceId: testInvoice.id,
          provider: 'RAZORPAY',
        },
        staffA
      );

      expect(checkoutSession.gatewayOrderId).toMatch(/^order_/);
      expect(checkoutSession.amount).toBe(1180);
      expect(checkoutSession.currency).toBe('INR');

      const payment = await prisma.paymentTransaction.findUnique({
        where: { id: checkoutSession.paymentTransactionId },
      });
      expect(payment?.status).toBe(PaymentStatus.PENDING);
      expect(payment?.gatewayOrderId).toBe(checkoutSession.gatewayOrderId);
    });

    it('rejects webhooks with invalid HMAC signatures', async () => {
      const rawBody = JSON.stringify({
        event: 'order.paid',
        event_id: `rzp_evt_invalid_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: 'pay_invalid_123',
              order_id: checkoutSession.gatewayOrderId,
            },
          },
        },
      });

      await expect(
        gatewaysService.processWebhook(
          PaymentGatewayProvider.RAZORPAY,
          rawBody,
          'invalid_bad_signature_hex',
          tenantA
        )
      ).rejects.toThrow(UnauthorizedException);
    });

    it('processes verified Razorpay webhook: marks payment COMPLETED and invoice PAID', async () => {
      const eventId = `rzp_evt_test_${Date.now()}`;
      const payload = {
        event: 'order.paid',
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_mock_success_789',
              order_id: checkoutSession.gatewayOrderId,
              amount: 118000,
              status: 'captured',
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(rawBody)
        .digest('hex');

      const result = await gatewaysService.processWebhook(
        PaymentGatewayProvider.RAZORPAY,
        rawBody,
        signature,
        tenantA
      );

      expect(result.received).toBe(true);
      expect(result.processed).toBe(true);

      // Verify Payment is now COMPLETED
      const payment = await prisma.paymentTransaction.findUnique({
        where: { id: checkoutSession.paymentTransactionId },
      });
      expect(payment?.status).toBe(PaymentStatus.COMPLETED);
      expect(payment?.reconciliationStatus).toBe(ReconciliationStatus.MATCHED);
      expect(payment?.gatewayPaymentId).toBe('pay_rzp_mock_success_789');

      // Verify Invoice is now PAID
      const invoice = await prisma.taxInvoice.findUnique({
        where: { id: testInvoice.id },
      });
      expect(invoice?.status).toBe(InvoiceStatus.PAID);
      expect(Number(invoice?.balanceDue)).toBe(0);
      expect(Number(invoice?.amountPaid)).toBe(1180);
    });

    it('handles idempotent webhook retries safely without duplicate credit', async () => {
      const eventId = `rzp_evt_test_idempotent`;
      const payload = {
        event: 'order.paid',
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_idem_123',
              order_id: checkoutSession.gatewayOrderId,
            },
          },
        },
      };
      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(rawBody)
        .digest('hex');

      // First delivery
      await gatewaysService.processWebhook(
        PaymentGatewayProvider.RAZORPAY,
        rawBody,
        signature,
        tenantA
      );

      // Retry delivery
      const retryResult = await gatewaysService.processWebhook(
        PaymentGatewayProvider.RAZORPAY,
        rawBody,
        signature,
        tenantA
      );

      expect(retryResult.received).toBe(true);
      expect(retryResult.duplicate).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Payment Reconciliation & Multi-Tenant Isolation
  // --------------------------------------------------------------------------
  describe('Reconciliation & Multi-Tenant Isolation', () => {
    it('updates reconciliation status with staff attribution and audit trail', async () => {
      const onlinePayments = await prisma.paymentTransaction.findMany({
        where: { tenantId: tenantA, gatewayOrderId: { not: null } },
      });
      expect(onlinePayments.length).toBeGreaterThan(0);

      const targetPayment = onlinePayments[0];
      const updated = await gatewaysService.reconcilePayment(
        tenantA,
        {
          paymentTransactionId: targetPayment.id,
          reconciliationStatus: 'MANUALLY_RECONCILED',
          notes: 'Bank settlement statement confirmed manually by accounts',
        },
        staffA
      );

      expect(updated.reconciliationStatus).toBe(ReconciliationStatus.MANUALLY_RECONCILED);
      expect(updated.notes).toContain('confirmed manually');
    });

    it('enforces multi-tenant isolation: Tenant B cannot access or renew Tenant A records', async () => {
      // 1. Tenant B cannot query Tenant A expiring memberships
      const renewalsB = await renewalsService.getUpcomingRenewals(tenantB, {
        daysAhead: 30,
        includeExpired: true,
      });
      expect(renewalsB.items.every((i) => i.studentName !== 'Vikram Seth')).toBe(true);

      // 2. Tenant B staff cannot renew Tenant A student membership
      await expect(
        renewalsService.renewMembership(
          tenantB,
          {
            studentMembershipId: membershipExpiringA.id,
          },
          staffB
        )
      ).rejects.toThrow(NotFoundException);

      // 3. Tenant B cannot view or reconcile Tenant A payments
      const tenantBList = await gatewaysService.getReconciliationList(tenantB, {});
      expect(tenantBList.items.every((item) => item.tenantId === tenantB)).toBe(true);
    });
  });
});
