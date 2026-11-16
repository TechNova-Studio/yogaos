import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  prisma,
  PaymentMode,
  PaymentStatus,
  InvoiceStatus,
} from '@yogaos/database';
import {
  RecordPaymentRequest,
  PaymentTransactionDetails,
  PaymentListQuery,
} from '@yogaos/contracts';
import { NumberingService } from './numbering.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly audit: AuditService
  ) {}

  async recordPayment(
    tenantId: string,
    data: RecordPaymentRequest,
    userId: string
  ): Promise<PaymentTransactionDetails> {
    // 1. Idempotency Check
    if (data.idempotencyKey) {
      const existing = await prisma.paymentTransaction.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: data.idempotencyKey,
          },
        },
        include: {
          invoice: { select: { invoiceNumber: true } },
          student: { select: { fullName: true } },
          branch: { select: { name: true } },
          recordedByUser: { select: { fullName: true } },
        },
      });

      if (existing) {
        return this.mapToDto(existing);
      }
    }

    // 2. Validate Student
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, tenantId, deletedAt: null },
      include: { homeBranch: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // 3. Validate Invoice if linked
    let invoice: any = null;
    if (data.invoiceId) {
      invoice = await prisma.taxInvoice.findFirst({
        where: { id: data.invoiceId, tenantId },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${data.invoiceId} not found`);
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Cannot record payment for a voided invoice');
      }

      const balanceDue = Number(invoice.balanceDue);
      if (data.amount > balanceDue + 0.001) {
        throw new BadRequestException(
          `Payment amount (₹${data.amount}) exceeds invoice balance due (₹${balanceDue})`
        );
      }
    }

    const branchId = data.branchId || invoice?.branchId || student.homeBranchId || null;
    const now = new Date();

    // 4. Record Payment in Transaction
    const transaction = await prisma.$transaction(async (tx) => {
      const receiptNumber = await this.numberingService.getNextReceiptNumber(tx, tenantId, now);

      const payment = await tx.paymentTransaction.create({
        data: {
          tenantId,
          branchId,
          invoiceId: invoice?.id || null,
          studentId: student.id,
          studentMembershipId: data.studentMembershipId || invoice?.studentMembershipId || null,
          receiptNumber,
          amount: data.amount,
          currency: 'INR',
          paymentMode: data.paymentMode as PaymentMode,
          utrReference: data.utrReference || null,
          idempotencyKey: data.idempotencyKey || null,
          status: PaymentStatus.COMPLETED,
          paidAt: now,
          recordedByUserId: userId,
          notes: data.notes || null,
          refundedAmount: 0.0,
        },
        include: {
          invoice: { select: { invoiceNumber: true } },
          student: { select: { fullName: true } },
          branch: { select: { name: true } },
          recordedByUser: { select: { fullName: true } },
        },
      });

      if (invoice) {
        const newPaid = Number(invoice.amountPaid) + data.amount;
        const newBalance = Math.max(0, Number(invoice.totalAmount) - newPaid);
        const newStatus = newBalance <= 0.001 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

        await tx.taxInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newPaid,
            balanceDue: newBalance,
            status: newStatus,
          },
        });
      }

      return payment;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'PAYMENT_RECORDED',
      resourceType: 'PaymentTransaction',
      resourceId: transaction.id,
      details: {
        receiptNumber: transaction.receiptNumber,
        amount: Number(transaction.amount),
        paymentMode: transaction.paymentMode,
        studentId: student.id,
        invoiceId: invoice?.id,
        invoiceNumber: invoice?.invoiceNumber,
      },
    });

    return this.mapToDto(transaction);
  }

  async getPayments(tenantId: string, query: PaymentListQuery = {}): Promise<PaymentTransactionDetails[]> {
    const where: any = {
      tenantId,
    };

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (query.invoiceId) {
      where.invoiceId = query.invoiceId;
    }

    if (query.paymentMode) {
      where.paymentMode = query.paymentMode;
    }

    if (query.status) {
      where.status = query.status;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const payments = await prisma.paymentTransaction.findMany({
      where,
      include: {
        invoice: { select: { invoiceNumber: true } },
        student: { select: { fullName: true } },
        branch: { select: { name: true } },
        recordedByUser: { select: { fullName: true } },
      },
      orderBy: { paidAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return payments.map((p) => this.mapToDto(p));
  }

  async getPayment(tenantId: string, id: string): Promise<PaymentTransactionDetails> {
    const payment = await prisma.paymentTransaction.findFirst({
      where: { id, tenantId },
      include: {
        invoice: { select: { invoiceNumber: true } },
        student: { select: { fullName: true } },
        branch: { select: { name: true } },
        recordedByUser: { select: { fullName: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return this.mapToDto(payment);
  }

  async getStudentPayments(tenantId: string, studentId: string): Promise<PaymentTransactionDetails[]> {
    return this.getPayments(tenantId, { studentId });
  }

  private mapToDto(p: any): PaymentTransactionDetails {
    return {
      id: p.id,
      tenantId: p.tenantId,
      branchId: p.branchId,
      branchName: p.branch?.name || null,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice?.invoiceNumber || null,
      studentId: p.studentId,
      studentName: p.student?.fullName,
      studentMembershipId: p.studentMembershipId,
      receiptNumber: p.receiptNumber,
      amount: Number(p.amount),
      currency: p.currency,
      paymentMode: p.paymentMode,
      utrReference: p.utrReference,
      idempotencyKey: p.idempotencyKey,
      status: p.status,
      paidAt: p.paidAt.toISOString(),
      recordedByUserId: p.recordedByUserId,
      recordedByUserName: p.recordedByUser?.fullName || null,
      gatewayProvider: p.gatewayProvider || null,
      gatewayOrderId: p.gatewayOrderId || null,
      gatewayPaymentId: p.gatewayPaymentId || null,
      reconciliationStatus: p.reconciliationStatus || null,
      notes: p.notes,
      refundedAmount: Number(p.refundedAmount),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
