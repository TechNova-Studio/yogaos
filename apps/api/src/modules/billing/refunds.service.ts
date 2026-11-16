import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  prisma,
  PaymentMode,
  PaymentStatus,
  RefundStatus,
  CreditNoteStatus,
} from '@yogaos/database';
import {
  ProcessRefundRequest,
  RefundRecordDetails,
  RefundListQuery,
  CreditNoteDetails,
} from '@yogaos/contracts';
import { NumberingService } from './numbering.service.js';
import { CreditLedgerService } from '../student-plans/credit-ledger.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class RefundsService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly audit: AuditService
  ) {}

  async processRefund(
    tenantId: string,
    data: ProcessRefundRequest,
    userId: string
  ): Promise<RefundRecordDetails> {
    // 1. Idempotency Check
    if (data.idempotencyKey) {
      const existing = await prisma.refundRecord.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: data.idempotencyKey,
          },
        },
        include: {
          student: { select: { fullName: true } },
          processedByUser: { select: { fullName: true } },
          creditNote: { select: { creditNoteNumber: true } },
        },
      });

      if (existing) {
        return this.mapToDto(existing);
      }
    }

    // 2. Validate Payment Transaction
    const payment = await prisma.paymentTransaction.findFirst({
      where: { id: data.paymentTransactionId, tenantId },
      include: {
        invoice: true,
        student: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment transaction with ID ${data.paymentTransactionId} not found`);
    }

    if (
      payment.status !== PaymentStatus.COMPLETED &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException(
        `Cannot refund a payment with status ${payment.status}`
      );
    }

    const currentRefunded = Number(payment.refundedAmount);
    const originalAmount = Number(payment.amount);
    const refundableBalance = Math.max(0, originalAmount - currentRefunded);

    if (data.amount > refundableBalance + 0.001) {
      throw new BadRequestException(
        `Requested refund amount (₹${data.amount}) exceeds refundable balance (₹${refundableBalance})`
      );
    }

    const now = new Date();
    const refundMode = (data.refundMode as PaymentMode) || payment.paymentMode;

    // 3. Process Refund in Transaction
    const result = await prisma.$transaction(async (tx) => {
      const refundNumber = await this.numberingService.getNextRefundNumber(tx, tenantId, now);

      let creditNoteId: string | null = null;
      let creditNoteNumber: string | null = null;

      // If linked to an invoice, generate an official Credit Note
      if (payment.invoiceId && payment.invoice) {
        creditNoteNumber = await this.numberingService.getNextCreditNoteNumber(tx, tenantId, now);

        const invoice = payment.invoice;
        const totalInvoice = Number(invoice.totalAmount);
        const ratio = totalInvoice > 0 ? data.amount / totalInvoice : 1;
        const proportionalTax = Math.round(Number(invoice.totalTax) * ratio * 100) / 100;
        const taxableAmount = Math.max(0, data.amount - proportionalTax);

        const cn = await tx.creditNote.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            creditNoteNumber,
            reason: data.reason,
            amount: taxableAmount,
            taxAmount: proportionalTax,
            totalAmount: data.amount,
            status: CreditNoteStatus.ISSUED,
            issuedAt: now,
            issuedByUserId: userId,
          },
        });
        creditNoteId = cn.id;

        // Update invoice balance
        const newPaid = Math.max(0, Number(invoice.amountPaid) - data.amount);
        const newBalance = Math.max(0, Number(invoice.totalAmount) - newPaid);

        await tx.taxInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newPaid,
            balanceDue: newBalance,
          },
        });
      }

      // Restore membership credit if requested and linked
      let creditRestored = false;
      if (data.restoreMembershipCredit && payment.studentMembershipId) {
        await this.creditLedgerService.refundCredit(
          tx,
          tenantId,
          payment.studentMembershipId,
          null,
          userId,
          `Monetary refund credit adjustment: ${data.reason}`
        );
        creditRestored = true;
      }

      // Create Refund Record
      const refundRecord = await tx.refundRecord.create({
        data: {
          tenantId,
          paymentTransactionId: payment.id,
          invoiceId: payment.invoiceId,
          studentId: payment.studentId,
          refundNumber,
          amount: data.amount,
          currency: 'INR',
          status: RefundStatus.COMPLETED,
          reason: data.reason,
          refundMode,
          utrReference: data.utrReference || null,
          idempotencyKey: data.idempotencyKey || null,
          creditRestored,
          creditNoteId,
          processedByUserId: userId,
        },
        include: {
          student: { select: { fullName: true } },
          processedByUser: { select: { fullName: true } },
          creditNote: { select: { creditNoteNumber: true } },
        },
      });

      // Update Payment Transaction refunded amount and status
      const updatedRefunded = currentRefunded + data.amount;
      const isFullyRefunded = updatedRefunded >= originalAmount - 0.001;
      const newPaymentStatus = isFullyRefunded
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          refundedAmount: updatedRefunded,
          status: newPaymentStatus,
        },
      });

      return refundRecord;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'REFUND_PROCESSED',
      resourceType: 'RefundRecord',
      resourceId: result.id,
      details: {
        refundNumber: result.refundNumber,
        paymentId: payment.id,
        amount: Number(result.amount),
        reason: data.reason,
        creditRestored: result.creditRestored,
        creditNoteNumber: result.creditNote?.creditNoteNumber,
      },
    });

    return this.mapToDto(result);
  }

  async getRefunds(tenantId: string, query: RefundListQuery = {}): Promise<RefundRecordDetails[]> {
    const where: any = {
      tenantId,
    };

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (query.paymentTransactionId) {
      where.paymentTransactionId = query.paymentTransactionId;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const items = await prisma.refundRecord.findMany({
      where,
      include: {
        student: { select: { fullName: true } },
        processedByUser: { select: { fullName: true } },
        creditNote: { select: { creditNoteNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return items.map((r) => this.mapToDto(r));
  }

  async getCreditNotes(tenantId: string, invoiceId?: string): Promise<CreditNoteDetails[]> {
    const where: any = {
      tenantId,
    };

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const notes = await prisma.creditNote.findMany({
      where,
      include: {
        invoice: { select: { invoiceNumber: true } },
        issuedByUser: { select: { fullName: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return notes.map((cn) => ({
      id: cn.id,
      tenantId: cn.tenantId,
      invoiceId: cn.invoiceId,
      invoiceNumber: cn.invoice?.invoiceNumber,
      creditNoteNumber: cn.creditNoteNumber,
      reason: cn.reason,
      amount: Number(cn.amount),
      taxAmount: Number(cn.taxAmount),
      totalAmount: Number(cn.totalAmount),
      status: cn.status,
      issuedAt: cn.issuedAt.toISOString(),
      issuedByUserId: cn.issuedByUserId,
      issuedByUserName: cn.issuedByUser?.fullName || null,
      createdAt: cn.createdAt.toISOString(),
    }));
  }

  private mapToDto(r: any): RefundRecordDetails {
    return {
      id: r.id,
      tenantId: r.tenantId,
      paymentTransactionId: r.paymentTransactionId,
      invoiceId: r.invoiceId,
      studentId: r.studentId,
      studentName: r.student?.fullName,
      refundNumber: r.refundNumber,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      refundMode: r.refundMode,
      utrReference: r.utrReference,
      idempotencyKey: r.idempotencyKey,
      creditRestored: r.creditRestored,
      creditNoteId: r.creditNoteId,
      creditNoteNumber: r.creditNote?.creditNoteNumber || null,
      processedByUserId: r.processedByUserId,
      processedByUserName: r.processedByUser?.fullName || null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
