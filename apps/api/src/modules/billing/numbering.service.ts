import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@yogaos/database';

@Injectable()
export class NumberingService {
  /**
   * Calculates Indian Fiscal Year: April 1 to March 31.
   * e.g., Date in May 2026 -> "2026-27", Date in Feb 2027 -> "2026-27"
   */
  getFiscalYear(date: Date = new Date()): string {
    const month = date.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr
    const year = date.getFullYear();

    if (month >= 3) {
      // April to December
      const nextYearTwoDigits = (year + 1) % 100;
      return `${year}-${nextYearTwoDigits.toString().padStart(2, '0')}`;
    } else {
      // January to March
      const prevYear = year - 1;
      const currentYearTwoDigits = year % 100;
      return `${prevYear}-${currentYearTwoDigits.toString().padStart(2, '0')}`;
    }
  }

  async getNextInvoiceNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    date: Date = new Date()
  ): Promise<{ invoiceNumber: string; fiscalYear: string; sequenceNumber: number }> {
    const fiscalYear = this.getFiscalYear(date);

    // Find the highest sequence number in this tenant & fiscal year
    const latest = await tx.taxInvoice.findFirst({
      where: { tenantId, fiscalYear },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    const nextSeq = (latest?.sequenceNumber || 0) + 1;
    const formattedSeq = nextSeq.toString().padStart(5, '0');
    const invoiceNumber = `INV/${fiscalYear}/${formattedSeq}`;

    return {
      invoiceNumber,
      fiscalYear,
      sequenceNumber: nextSeq,
    };
  }

  async getNextReceiptNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    date: Date = new Date()
  ): Promise<string> {
    const fiscalYear = this.getFiscalYear(date);

    const count = await tx.paymentTransaction.count({
      where: { tenantId },
    });

    const seq = (count + 1).toString().padStart(5, '0');
    return `REC/${fiscalYear}/${seq}`;
  }

  async getNextRefundNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    date: Date = new Date()
  ): Promise<string> {
    const fiscalYear = this.getFiscalYear(date);

    const count = await tx.refundRecord.count({
      where: { tenantId },
    });

    const seq = (count + 1).toString().padStart(5, '0');
    return `REF/${fiscalYear}/${seq}`;
  }

  async getNextCreditNoteNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    date: Date = new Date()
  ): Promise<string> {
    const fiscalYear = this.getFiscalYear(date);

    const count = await tx.creditNote.count({
      where: { tenantId },
    });

    const seq = (count + 1).toString().padStart(5, '0');
    return `CN/${fiscalYear}/${seq}`;
  }
}
