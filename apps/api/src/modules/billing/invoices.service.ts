import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, InvoiceStatus } from '@yogaos/database';
import {
  CreateInvoiceRequest,
  TaxInvoiceDetails,
  InvoiceListQuery,
} from '@yogaos/contracts';
import { TaxCalculator } from './tax-calculator.js';
import { NumberingService } from './numbering.service.js';
import { TaxSettingsService } from './tax-settings.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly taxSettingsService: TaxSettingsService,
    private readonly audit: AuditService
  ) {}

  async createInvoice(
    tenantId: string,
    data: CreateInvoiceRequest,
    userId: string
  ): Promise<TaxInvoiceDetails> {
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, tenantId, deletedAt: null },
      include: { homeBranch: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    let branch = null;
    if (data.branchId) {
      branch = await prisma.branch.findFirst({
        where: { id: data.branchId, tenantId, deletedAt: null },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID ${data.branchId} not found`);
      }
    } else if (student.homeBranch) {
      branch = student.homeBranch;
    }

    if (data.studentMembershipId) {
      const membership = await prisma.studentMembership.findFirst({
        where: { id: data.studentMembershipId, tenantId, deletedAt: null },
      });
      if (!membership) {
        throw new NotFoundException(`Student membership with ID ${data.studentMembershipId} not found`);
      }
    }

    const taxSettings = await this.taxSettingsService.getTaxSettings(tenantId);

    const supplierStateCode = branch?.stateCode || taxSettings.supplierStateCode || 'DL';
    const customerStateCode = (
      data.customerStateCode ||
      student.billingStateCode ||
      branch?.stateCode ||
      supplierStateCode
    ).toUpperCase();

    const calculation = TaxCalculator.calculate(data.lineItems, {
      isGstRegistered: taxSettings.isGstRegistered,
      supplierStateCode,
      customerStateCode,
      defaultTaxRate: taxSettings.defaultTaxRatePercent,
      defaultSacCode: taxSettings.defaultSacCode,
      overallDiscount: data.discountAmount,
    });

    const now = new Date();

    const invoice = await prisma.$transaction(async (tx) => {
      const { invoiceNumber, fiscalYear, sequenceNumber } =
        await this.numberingService.getNextInvoiceNumber(tx, tenantId, now);

      const created = await tx.taxInvoice.create({
        data: {
          tenantId,
          branchId: branch?.id || null,
          studentId: student.id,
          studentMembershipId: data.studentMembershipId || null,
          invoiceNumber,
          fiscalYear,
          sequenceNumber,
          status: InvoiceStatus.ISSUED,
          issueDate: now,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          currency: 'INR',
          subtotal: calculation.subtotal,
          discountAmount: calculation.discountAmount,
          taxableAmount: calculation.taxableAmount,
          cgstAmount: calculation.cgstAmount,
          sgstAmount: calculation.sgstAmount,
          igstAmount: calculation.igstAmount,
          totalTax: calculation.totalTax,
          totalAmount: calculation.totalAmount,
          amountPaid: 0.0,
          balanceDue: calculation.totalAmount,
          supplierGstin: taxSettings.gstin || null,
          supplierLegalName: taxSettings.legalEntityName || 'Yoga Studio',
          supplierStateCode,
          supplierAddress: (taxSettings.billingAddress as any) ?? undefined,
          customerName: student.fullName,
          customerPhone: student.mobilePhone || null,
          customerEmail: student.email || null,
          customerGstin: data.customerGstin || null,
          customerStateCode,
          customerAddress: (student.billingAddress as any) ?? undefined,
          notes: data.notes || null,
          lineItems: {
            create: calculation.lineItems.map((item) => ({
              tenantId,
              description: item.description,
              sacCode: item.sacCode,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount,
              taxableAmount: item.taxableAmount,
              taxRatePercent: item.taxRatePercent,
              cgstAmount: item.cgstAmount,
              sgstAmount: item.sgstAmount,
              igstAmount: item.igstAmount,
              totalAmount: item.totalAmount,
            })),
          },
        },
        include: {
          lineItems: true,
          branch: { select: { name: true } },
          student: { select: { fullName: true, mobilePhone: true, email: true } },
        },
      });

      return created;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'INVOICE_ISSUED',
      resourceType: 'TaxInvoice',
      resourceId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        studentId: student.id,
        totalAmount: Number(invoice.totalAmount),
        taxableAmount: Number(invoice.taxableAmount),
        totalTax: Number(invoice.totalTax),
        isInterState: calculation.isInterState,
      },
    });

    return this.mapToDto(invoice);
  }

  async getInvoices(tenantId: string, query: InvoiceListQuery = {}): Promise<TaxInvoiceDetails[]> {
    const where: any = {
      tenantId,
    };

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate) {
      where.issueDate = { ...where.issueDate, gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.issueDate = { ...where.issueDate, lte: new Date(query.endDate) };
    }

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const invoices = await prisma.taxInvoice.findMany({
      where,
      include: {
        lineItems: true,
        branch: { select: { name: true } },
        student: { select: { fullName: true, mobilePhone: true, email: true } },
      },
      orderBy: { issueDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return invoices.map((inv) => this.mapToDto(inv));
  }

  async getInvoice(tenantId: string, id: string): Promise<TaxInvoiceDetails> {
    const invoice = await prisma.taxInvoice.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: true,
        branch: { select: { name: true } },
        student: { select: { fullName: true, mobilePhone: true, email: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return this.mapToDto(invoice);
  }

  async voidInvoice(
    tenantId: string,
    id: string,
    reason: string,
    userId: string
  ): Promise<TaxInvoiceDetails> {
    const existing = await prisma.taxInvoice.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: true,
        branch: { select: { name: true } },
        student: { select: { fullName: true, mobilePhone: true, email: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (existing.status === InvoiceStatus.VOID) {
      return this.mapToDto(existing);
    }

    if (Number(existing.amountPaid) > 0) {
      throw new BadRequestException(
        'Cannot void an invoice with recorded payments. Issue a refund or credit note instead.'
      );
    }

    const updated = await prisma.taxInvoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOID,
        notes: existing.notes ? `${existing.notes}\n[VOID]: ${reason}` : `[VOID]: ${reason}`,
      },
      include: {
        lineItems: true,
        branch: { select: { name: true } },
        student: { select: { fullName: true, mobilePhone: true, email: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'INVOICE_VOIDED',
      resourceType: 'TaxInvoice',
      resourceId: id,
      details: {
        invoiceNumber: existing.invoiceNumber,
        reason,
      },
    });

    return this.mapToDto(updated);
  }

  private mapToDto(inv: any): TaxInvoiceDetails {
    return {
      id: inv.id,
      tenantId: inv.tenantId,
      branchId: inv.branchId,
      branchName: inv.branch?.name || null,
      studentId: inv.studentId,
      studentName: inv.student?.fullName || inv.customerName,
      studentPhone: inv.student?.mobilePhone || inv.customerPhone,
      studentEmail: inv.student?.email || inv.customerEmail,
      studentMembershipId: inv.studentMembershipId,
      invoiceNumber: inv.invoiceNumber,
      fiscalYear: inv.fiscalYear,
      sequenceNumber: inv.sequenceNumber,
      status: inv.status,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      currency: inv.currency,
      subtotal: Number(inv.subtotal),
      discountAmount: Number(inv.discountAmount),
      taxableAmount: Number(inv.taxableAmount),
      cgstAmount: Number(inv.cgstAmount),
      sgstAmount: Number(inv.sgstAmount),
      igstAmount: Number(inv.igstAmount),
      totalTax: Number(inv.totalTax),
      totalAmount: Number(inv.totalAmount),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.balanceDue),
      supplierGstin: inv.supplierGstin,
      supplierLegalName: inv.supplierLegalName,
      supplierStateCode: inv.supplierStateCode,
      supplierAddress: inv.supplierAddress,
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      customerEmail: inv.customerEmail,
      customerGstin: inv.customerGstin,
      customerStateCode: inv.customerStateCode,
      customerAddress: inv.customerAddress,
      notes: inv.notes,
      lineItems: (inv.lineItems || []).map((li: any) => ({
        id: li.id,
        invoiceId: li.invoiceId,
        description: li.description,
        sacCode: li.sacCode,
        quantity: li.quantity,
        unitPrice: Number(li.unitPrice),
        discountAmount: Number(li.discountAmount),
        taxableAmount: Number(li.taxableAmount),
        taxRatePercent: Number(li.taxRatePercent),
        cgstAmount: Number(li.cgstAmount),
        sgstAmount: Number(li.sgstAmount),
        igstAmount: Number(li.igstAmount),
        totalAmount: Number(li.totalAmount),
      })),
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    };
  }
}
