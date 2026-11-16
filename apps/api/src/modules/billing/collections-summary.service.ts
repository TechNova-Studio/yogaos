import { Injectable } from '@nestjs/common';
import { prisma, PaymentStatus } from '@yogaos/database';
import { DailyCollectionSummary } from '@yogaos/contracts';

@Injectable()
export class CollectionsSummaryService {
  async getDailySummary(tenantId: string, dateStr?: string): Promise<DailyCollectionSummary> {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const payments = await prisma.paymentTransaction.findMany({
      where: {
        tenantId,
        paidAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] },
      },
    });

    const refunds = await prisma.refundRecord.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const byMode: Record<string, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
      ONLINE: 0,
    };

    let totalCollected = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      totalCollected += amt;
      byMode[p.paymentMode] = (byMode[p.paymentMode] || 0) + amt;
    }

    let totalRefunded = 0;
    for (const r of refunds) {
      totalRefunded += Number(r.amount);
    }

    const netCollected = Math.round((totalCollected - totalRefunded) * 100) / 100;

    return {
      date: startOfDay.toISOString().slice(0, 10),
      totalCollected: Math.round(totalCollected * 100) / 100,
      byMode,
      transactionCount: payments.length,
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      netCollected,
    };
  }
}
