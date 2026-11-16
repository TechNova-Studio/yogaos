import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  UserRole,
  MemberStatus,
  InvoiceStatus,
  PaymentMode,
  PaymentStatus,
  RefundStatus,
  CreditNoteStatus,
} from '@yogaos/database';
import { TaxSettingsService } from '../src/modules/billing/tax-settings.service.js';
import { NumberingService } from '../src/modules/billing/numbering.service.js';
import { InvoicesService } from '../src/modules/billing/invoices.service.js';
import { PaymentsService } from '../src/modules/billing/payments.service.js';
import { RefundsService } from '../src/modules/billing/refunds.service.js';
import { CollectionsSummaryService } from '../src/modules/billing/collections-summary.service.js';
import { CreditLedgerService } from '../src/modules/student-plans/credit-ledger.service.js';
import { StudentMembershipsService } from '../src/modules/student-plans/student-memberships.service.js';
import { PlansService } from '../src/modules/student-plans/plans.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('P12 Real Database Integration Tests (Billing, Payments, Invoices, GST & Refunds)', () => {
  let auditService: AuditService;
  let taxSettingsService: TaxSettingsService;
  let numberingService: NumberingService;
  let invoicesService: InvoicesService;
  let paymentsService: PaymentsService;
  let refundsService: RefundsService;
  let collectionsSummaryService: CollectionsSummaryService;
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

  let membershipA1Id: string;

  beforeAll(async () => {
    auditService = new AuditService();
    taxSettingsService = new TaxSettingsService(auditService);
    numberingService = new NumberingService();
    creditLedgerService = new CreditLedgerService(auditService);
    studentMembershipsService = new StudentMembershipsService(auditService, creditLedgerService);
    plansService = new PlansService(auditService);
    invoicesService = new InvoicesService(numberingService, taxSettingsService, auditService);
    paymentsService = new PaymentsService(numberingService, auditService);
    refundsService = new RefundsService(numberingService, creditLedgerService, auditService);
    collectionsSummaryService = new CollectionsSummaryService();

    // 1. Create Tenant A
    const orgA = await prisma.organization.create({
      data: {
        name: 'Prana Vinyasa Studio A (P12 Test)',
        slug: `prana-p12-a-${Date.now()}`,
        legalEntityName: 'Prana Yoga Wellness LLP',
        isGstRegistered: true,
        gstin: '07AAAAA0000A1Z5',
        panNumber: 'AAAAA0000A',
        settings: {
          defaultTaxRatePercent: 18.0,
          defaultSacCode: '9992',
          supplierStateCode: 'DL',
        },
      },
    });
    tenantA = orgA.id;
    createdOrgIds.push(tenantA);

    // 2. Create Tenant B
    const orgB = await prisma.organization.create({
      data: {
        name: 'Moksha Yoga Studio B (P12 Test)',
        slug: `moksha-p12-b-${Date.now()}`,
        legalEntityName: 'Moksha Yoga LLP',
        isGstRegistered: false,
        settings: {
          defaultTaxRatePercent: 0,
          defaultSacCode: '9992',
          supplierStateCode: 'KA',
        },
      },
    });
    tenantB = orgB.id;
    createdOrgIds.push(tenantB);

    // 3. Create Staff A and Staff B
    const userA = await prisma.user.create({
      data: {
        email: `staff.a.p12.${Date.now()}@yogaos.test`,
        fullName: 'Staff Member A',
      },
    });
    staffA = userA.id;
    createdUserIds.push(staffA);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantA,
        userId: staffA,
        role: UserRole.MANAGER,
        status: MemberStatus.ACTIVE,
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: `staff.b.p12.${Date.now()}@yogaos.test`,
        fullName: 'Staff Member B',
      },
    });
    staffB = userB.id;
    createdUserIds.push(staffB);

    await prisma.organizationMember.create({
      data: {
        tenantId: tenantB,
        userId: staffB,
        role: UserRole.MANAGER,
        status: MemberStatus.ACTIVE,
      },
    });

    // 4. Create Branches
    const brA = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        name: 'South Extension Delhi Branch',
        slug: `south-ext-${Date.now()}`,
        streetAddress: 'B-12 Greater Kailash 1',
        city: 'New Delhi',
        state: 'Delhi',
        stateCode: 'DL',
        postalCode: '110048',
        phone: '+919911122334',
        email: 'delhi@prana.test',
      },
    });
    branchA = brA.id;

    const brB = await prisma.branch.create({
      data: {
        tenantId: tenantB,
        name: 'Indiranagar Bengaluru Branch',
        slug: `indiranagar-${Date.now()}`,
        streetAddress: '100 Feet Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: 'KA',
        postalCode: '560038',
        phone: '+919922233445',
        email: 'bengaluru@moksha.test',
      },
    });
    branchB = brB.id;

    // 5. Create Students
    // Student A1 (Delhi resident -> Intra-state for Tenant A)
    const stA1 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Aarav Sharma (Delhi Intra)',
        email: `aarav.p12.${Date.now()}@yogaos.test`,
        mobilePhone: '+919876543201',
        emergencyContactName: 'Pooja Sharma',
        emergencyContactPhone: '+919876543202',
        emergencyContactRelation: 'Spouse',
        billingStateCode: 'DL',
      },
    });
    studentA1 = stA1.id;
    createdStudentIds.push(studentA1);

    // Student A2 (Mumbai resident -> Inter-state for Tenant A)
    const stA2 = await prisma.student.create({
      data: {
        tenantId: tenantA,
        homeBranchId: branchA,
        fullName: 'Meera Kulkarni (Mumbai Inter)',
        email: `meera.p12.${Date.now()}@yogaos.test`,
        mobilePhone: '+919876543203',
        emergencyContactName: 'Rajesh Kulkarni',
        emergencyContactPhone: '+919876543204',
        emergencyContactRelation: 'Father',
        billingStateCode: 'MH',
      },
    });
    studentA2 = stA2.id;
    createdStudentIds.push(studentA2);

    // Student B1 (Tenant B)
    const stB1 = await prisma.student.create({
      data: {
        tenantId: tenantB,
        homeBranchId: branchB,
        fullName: 'Kiran Rao (Bengaluru)',
        email: `kiran.p12.${Date.now()}@yogaos.test`,
        mobilePhone: '+919876543205',
        emergencyContactName: 'Anand Rao',
        emergencyContactPhone: '+919876543206',
        emergencyContactRelation: 'Brother',
        billingStateCode: 'KA',
      },
    });
    studentB1 = stB1.id;
    createdStudentIds.push(studentB1);

    // 6. Create a class pack plan & membership for Student A1 to test credit adjustments on refund
    const plan = await plansService.createPlan(
      tenantA,
      {
        name: '10 Class Pass Pack',
        planType: 'CLASS_PACK',
        price: 3500,
        validityDays: 30,
        creditCount: 10,
      },
      staffA
    );

    const mem = await studentMembershipsService.assignMembership(
      tenantA,
      {
        studentId: studentA1,
        planId: plan.id,
      },
      staffA
    );
    membershipA1Id = mem.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.refundRecord.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.creditNote.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.invoiceLineItem.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.taxInvoice.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.membershipCreditLedger.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.studentMembership.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.membershipPlan.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.studentActivity.deleteMany({ where: { studentId: { in: createdStudentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } });
    await prisma.room.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.branch.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.organizationMember.deleteMany({ where: { tenantId: { in: createdOrgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  describe('1. Tax Settings Engine', () => {
    it('retrieves organization tax settings with defaults', async () => {
      const settings = await taxSettingsService.getTaxSettings(tenantA);
      expect(settings.isGstRegistered).toBe(true);
      expect(settings.gstin).toBe('07AAAAA0000A1Z5');
      expect(settings.legalEntityName).toBe('Prana Yoga Wellness LLP');
      expect(settings.supplierStateCode).toBe('DL');
      expect(settings.defaultTaxRatePercent).toBe(18.0);
    });

    it('updates tax settings and records audit log', async () => {
      const updated = await taxSettingsService.updateTaxSettings(
        tenantA,
        {
          defaultTaxRatePercent: 18.0,
          defaultSacCode: '9992',
          legalEntityName: 'Prana Yoga Wellness Private Limited',
        },
        staffA
      );

      expect(updated.legalEntityName).toBe('Prana Yoga Wellness Private Limited');

      // Verify audit trail
      const audit = await prisma.auditLog.findFirst({
        where: {
          tenantId: tenantA,
          action: 'UPDATE_TAX_SETTINGS',
        },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('2. Tax Invoices & Place of Supply (GST Engine)', () => {
    let intraStateInvoiceId: string;
    let interStateInvoiceId: string;

    it('creates an intra-state GST invoice with CGST and SGST', async () => {
      const inv = await invoicesService.createInvoice(
        tenantA,
        {
          studentId: studentA1,
          customerStateCode: 'DL',
          lineItems: [
            {
              description: '10 Class Pass',
              sacCode: '9992',
              quantity: 1,
              unitPrice: 5000,
              discountAmount: 500, // Taxable: 4500
            },
          ],
        },
        staffA
      );

      intraStateInvoiceId = inv.id;
      expect(inv.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/\d{5}$/);
      expect(inv.subtotal).toBe(5000);
      expect(inv.discountAmount).toBe(500);
      expect(inv.taxableAmount).toBe(4500);
      expect(inv.cgstAmount).toBe(405); // 9% of 4500
      expect(inv.sgstAmount).toBe(405); // 9% of 4500
      expect(inv.igstAmount).toBe(0);
      expect(inv.totalTax).toBe(810);
      expect(inv.totalAmount).toBe(5310);
      expect(inv.balanceDue).toBe(5310);
      expect(inv.status).toBe(InvoiceStatus.ISSUED);
      expect(inv.lineItems).toHaveLength(1);
    });

    it('creates an inter-state GST invoice with IGST only', async () => {
      const inv = await invoicesService.createInvoice(
        tenantA,
        {
          studentId: studentA2,
          customerStateCode: 'MH', // Customer in Maharashtra, Supplier in Delhi
          lineItems: [
            {
              description: 'Ashtanga Weekend Immersion',
              sacCode: '9992',
              quantity: 1,
              unitPrice: 10000,
              discountAmount: 0,
            },
          ],
        },
        staffA
      );

      interStateInvoiceId = inv.id;
      expect(inv.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/\d{5}$/);
      expect(inv.taxableAmount).toBe(10000);
      expect(inv.cgstAmount).toBe(0);
      expect(inv.sgstAmount).toBe(0);
      expect(inv.igstAmount).toBe(1800); // 18% IGST
      expect(inv.totalTax).toBe(1800);
      expect(inv.totalAmount).toBe(11800);
      expect(inv.balanceDue).toBe(11800);
    });

    it('enforces sequential invoice numbering per financial year', async () => {
      const inv1 = await invoicesService.getInvoice(tenantA, intraStateInvoiceId);
      const inv2 = await invoicesService.getInvoice(tenantA, interStateInvoiceId);

      const seq1 = parseInt(inv1.invoiceNumber.split('/')[2], 10);
      const seq2 = parseInt(inv2.invoiceNumber.split('/')[2], 10);
      expect(seq2).toBe(seq1 + 1);
    });

    it('allows voiding an unpaid invoice with reason', async () => {
      const voidInvoice = await invoicesService.createInvoice(
        tenantA,
        {
          studentId: studentA1,
          lineItems: [{ description: 'Test Accidental Invoice', unitPrice: 1000, quantity: 1 }],
        },
        staffA
      );

      const voided = await invoicesService.voidInvoice(tenantA, voidInvoice.id, 'Created by mistake', staffA);
      expect(voided.status).toBe(InvoiceStatus.VOID);
    });
  });

  describe('3. Payments Collection & Reconciliation', () => {
    let invoiceToPay: any;
    let payment1Id: string;
    let payment2Id: string;

    beforeAll(async () => {
      invoiceToPay = await invoicesService.createInvoice(
        tenantA,
        {
          studentId: studentA1,
          studentMembershipId: membershipA1Id,
          customerStateCode: 'DL',
          lineItems: [{ description: '10 Class Pass Renewal', unitPrice: 3000, quantity: 1 }], // 3000 + 540 tax = 3540
        },
        staffA
      );
    });

    it('records partial payment and transitions invoice to PARTIALLY_PAID', async () => {
      const pay = await paymentsService.recordPayment(
        tenantA,
        {
          invoiceId: invoiceToPay.id,
          studentId: studentA1,
          studentMembershipId: membershipA1Id,
          amount: 2000,
          paymentMode: PaymentMode.UPI,
          utrReference: 'UPI123456789012',
          idempotencyKey: `pay-test-key-1-${Date.now()}`,
        },
        staffA
      );

      payment1Id = pay.id;
      expect(pay.receiptNumber).toMatch(/^REC\/\d{4}-\d{2}\/\d{5}$/);
      expect(pay.amount).toBe(2000);
      expect(pay.paymentMode).toBe(PaymentMode.UPI);
      expect(pay.status).toBe(PaymentStatus.COMPLETED);

      // Verify invoice state
      const updatedInv = await invoicesService.getInvoice(tenantA, invoiceToPay.id);
      expect(updatedInv.amountPaid).toBe(2000);
      expect(updatedInv.balanceDue).toBe(1540); // 3540 - 2000
      expect(updatedInv.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it('idempotency: submitting duplicate payment key returns existing record without duplicating financial entry', async () => {
      const key = `idem-pay-${Date.now()}`;
      const first = await paymentsService.recordPayment(
        tenantA,
        {
          studentId: studentA1,
          amount: 500,
          paymentMode: PaymentMode.CASH,
          idempotencyKey: key,
        },
        staffA
      );

      const duplicate = await paymentsService.recordPayment(
        tenantA,
        {
          studentId: studentA1,
          amount: 500,
          paymentMode: PaymentMode.CASH,
          idempotencyKey: key,
        },
        staffA
      );

      expect(duplicate.id).toBe(first.id);
      expect(duplicate.receiptNumber).toBe(first.receiptNumber);
    });

    it('records second payment settling full balance and transitions invoice to PAID', async () => {
      const pay = await paymentsService.recordPayment(
        tenantA,
        {
          invoiceId: invoiceToPay.id,
          studentId: studentA1,
          amount: 1540,
          paymentMode: PaymentMode.CARD,
          idempotencyKey: `pay-test-key-2-${Date.now()}`,
        },
        staffA
      );

      payment2Id = pay.id;
      expect(pay.amount).toBe(1540);

      // Verify invoice state
      const updatedInv = await invoicesService.getInvoice(tenantA, invoiceToPay.id);
      expect(updatedInv.amountPaid).toBe(3540);
      expect(updatedInv.balanceDue).toBe(0);
      expect(updatedInv.status).toBe(InvoiceStatus.PAID);
    });

    it('rejects payment exceeding invoice balance due', async () => {
      await expect(
        paymentsService.recordPayment(
          tenantA,
          {
            invoiceId: invoiceToPay.id,
            studentId: studentA1,
            amount: 500, // Balance is 0
            paymentMode: PaymentMode.CASH,
          },
          staffA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents voiding an invoice that has payments recorded', async () => {
      await expect(
        invoicesService.voidInvoice(tenantA, invoiceToPay.id, 'Should fail', staffA)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Refunds & Credit Notes', () => {
    let refundPayment: any;
    let refundInvoice: any;

    beforeAll(async () => {
      refundInvoice = await invoicesService.createInvoice(
        tenantA,
        {
          studentId: studentA1,
          studentMembershipId: membershipA1Id,
          customerStateCode: 'DL',
          lineItems: [{ description: 'Drop-in Weekend Special', unitPrice: 2000, quantity: 1 }], // 2000 + 360 tax = 2360
        },
        staffA
      );

      refundPayment = await paymentsService.recordPayment(
        tenantA,
        {
          invoiceId: refundInvoice.id,
          studentId: studentA1,
          studentMembershipId: membershipA1Id,
          amount: 2360,
          paymentMode: PaymentMode.UPI,
        },
        staffA
      );
    });

    it('processes partial refund, generates credit note and updates payment status', async () => {
      const refund = await refundsService.processRefund(
        tenantA,
        {
          paymentTransactionId: refundPayment.id,
          amount: 1000,
          reason: 'Student missed weekend sessions due to travel',
          idempotencyKey: `ref-key-1-${Date.now()}`,
        },
        staffA
      );

      expect(refund.refundNumber).toMatch(/^REF\/\d{4}-\d{2}\/\d{5}$/);
      expect(refund.amount).toBe(1000);
      expect(refund.creditNoteNumber).toMatch(/^CN\/\d{4}-\d{2}\/\d{5}$/);

      // Verify payment status
      const updatedPayment = await paymentsService.getPayment(tenantA, refundPayment.id);
      expect(updatedPayment.refundedAmount).toBe(1000);
      expect(updatedPayment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);

      // Verify credit note record
      const creditNotes = await refundsService.getCreditNotes(tenantA, refundInvoice.id);
      expect(creditNotes.length).toBeGreaterThan(0);
      expect(creditNotes[0].totalAmount).toBe(1000);
    });

    it('rejects refund exceeding remaining refundable amount', async () => {
      // 2360 total - 1000 refunded = 1360 remaining
      await expect(
        refundsService.processRefund(
          tenantA,
          {
            paymentTransactionId: refundPayment.id,
            amount: 1500, // Exceeds 1360
            reason: 'Excessive refund attempt',
          },
          staffA
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('refund idempotency: duplicate refund key returns existing refund record', async () => {
      const key = `idem-ref-${Date.now()}`;
      const first = await refundsService.processRefund(
        tenantA,
        {
          paymentTransactionId: refundPayment.id,
          amount: 200,
          reason: 'Courtesy refund',
          idempotencyKey: key,
        },
        staffA
      );

      const duplicate = await refundsService.processRefund(
        tenantA,
        {
          paymentTransactionId: refundPayment.id,
          amount: 200,
          reason: 'Courtesy refund',
          idempotencyKey: key,
        },
        staffA
      );

      expect(duplicate.id).toBe(first.id);
      expect(duplicate.refundNumber).toBe(first.refundNumber);
    });

    it('processes full remaining refund with entitlement credit restoration', async () => {
      // Check current pass balance before refund
      const memBefore = await prisma.studentMembership.findUnique({
        where: { id: membershipA1Id },
      });
      const creditsBefore = memBefore?.remainingCredits ?? 0;

      // Current refunded: 1000 + 200 = 1200. Remaining: 2360 - 1200 = 1160
      const refund = await refundsService.processRefund(
        tenantA,
        {
          paymentTransactionId: refundPayment.id,
          amount: 1160,
          reason: 'Full cancellation and pass credit adjustment',
          restoreMembershipCredit: true,
        },
        staffA
      );

      expect(refund.status).toBe(RefundStatus.COMPLETED);
      expect(refund.creditRestored).toBe(true);

      // Verify payment transitions to fully REFUNDED
      const updatedPayment = await paymentsService.getPayment(tenantA, refundPayment.id);
      expect(updatedPayment.status).toBe(PaymentStatus.REFUNDED);
      expect(updatedPayment.refundedAmount).toBe(2360);

      // Verify credit ledger recorded the restoration
      const ledger = await prisma.membershipCreditLedger.findFirst({
        where: { studentMembershipId: membershipA1Id, entryType: 'REFUND_RESTORE' },
      });
      expect(ledger).toBeDefined();
      expect(ledger?.creditsDelta).toBe(1);

      const memAfter = await prisma.studentMembership.findUnique({
        where: { id: membershipA1Id },
      });
      expect(memAfter?.remainingCredits).toBe(creditsBefore + 1);
    });
  });

  describe('5. Daily Collections Summary & Reconciliation', () => {
    it('aggregates daily gross, refunds, net collections, and mode breakdown', async () => {
      const summary = await collectionsSummaryService.getDailySummary(tenantA);

      expect(summary.totalCollected).toBeGreaterThan(0);
      expect(summary.totalRefunded).toBeGreaterThan(0);
      expect(summary.netCollected).toBe(
        Math.round((summary.totalCollected - summary.totalRefunded) * 100) / 100
      );
      expect(summary.byMode.UPI).toBeGreaterThan(0);
      expect(summary.transactionCount).toBeGreaterThan(0);
    });
  });

  describe('6. Tenant Isolation & Security Boundary', () => {
    it('Tenant B cannot access Tenant A invoices', async () => {
      const invA = await invoicesService.createInvoice(
        tenantA,
        {
          studentId: studentA1,
          lineItems: [{ description: 'Private Tenant A Invoice', unitPrice: 1000, quantity: 1 }],
        },
        staffA
      );

      await expect(
        invoicesService.getInvoice(tenantB, invA.id)
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot record payment for Tenant A student or invoice', async () => {
      await expect(
        paymentsService.recordPayment(
          tenantB,
          {
            studentId: studentA1, // Student belongs to Tenant A
            amount: 500,
            paymentMode: PaymentMode.CASH,
          },
          staffB
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot refund Tenant A payment transactions', async () => {
      const payA = await paymentsService.recordPayment(
        tenantA,
        {
          studentId: studentA1,
          amount: 500,
          paymentMode: PaymentMode.CASH,
        },
        staffA
      );

      await expect(
        refundsService.processRefund(
          tenantB,
          {
            paymentTransactionId: payA.id,
            amount: 500,
            reason: 'Malicious cross-tenant refund attempt',
          },
          staffB
        )
      ).rejects.toThrow(NotFoundException);
    });
  });
});
