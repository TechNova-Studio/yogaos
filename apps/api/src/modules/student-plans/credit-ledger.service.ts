import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, Prisma } from '@yogaos/database';
import {
  CreditLedgerEntryDetails,
  CreditLedgerListQuery,
  ManualCreditAdjustmentRequest,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class CreditLedgerService {
  constructor(private readonly audit: AuditService) {}

  async manualAdjustment(
    tenantId: string,
    studentMembershipId: string,
    data: ManualCreditAdjustmentRequest,
    userId: string
  ): Promise<CreditLedgerEntryDetails> {
    const entry = await prisma.$transaction(async (tx) => {
      const membership = await tx.studentMembership.findFirst({
        where: { id: studentMembershipId, tenantId, deletedAt: null },
      });

      if (!membership) {
        throw new NotFoundException(`Student membership with ID ${studentMembershipId} not found`);
      }

      if (membership.remainingCredits === null) {
        throw new BadRequestException('Cannot adjust credits for an unlimited time-based membership');
      }

      const balanceAfter = membership.remainingCredits + data.creditsDelta;
      if (balanceAfter < 0) {
        throw new BadRequestException(
          `Adjustment of ${data.creditsDelta} would result in a negative credit balance (${balanceAfter})`
        );
      }

      await tx.studentMembership.update({
        where: { id: studentMembershipId },
        data: { remainingCredits: balanceAfter },
      });

      const ledgerRecord = await tx.membershipCreditLedger.create({
        data: {
          tenantId,
          studentMembershipId,
          studentId: membership.studentId,
          entryType: 'MANUAL_ADJUSTMENT',
          creditsDelta: data.creditsDelta,
          balanceAfter,
          reason: data.reason,
          performedByUserId: userId,
        },
        include: {
          performedByUser: { select: { fullName: true } },
        },
      });

      return ledgerRecord;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREDIT_LEDGER_ADJUSTMENT',
      resourceType: 'MembershipCreditLedger',
      resourceId: entry.id,
      details: {
        studentMembershipId,
        creditsDelta: data.creditsDelta,
        balanceAfter: entry.balanceAfter,
        reason: data.reason,
      },
    });

    return this.mapToDto(entry);
  }

  async redeemCredit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentMembershipId: string,
    bookingId: string,
    userId: string
  ): Promise<{ remainingCredits: number | null }> {
    const membership = await tx.studentMembership.findFirst({
      where: { id: studentMembershipId, tenantId, deletedAt: null },
    });

    if (!membership) {
      throw new NotFoundException(`Student membership with ID ${studentMembershipId} not found`);
    }

    if (membership.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot redeem credits from a membership with status ${membership.status}`);
    }

    if (new Date() > membership.expiryDate) {
      throw new BadRequestException('Cannot redeem credits from an expired membership');
    }

    // Unlimited membership does not debit numeric credits
    if (membership.remainingCredits === null) {
      return { remainingCredits: null };
    }

    if (membership.remainingCredits < 1) {
      throw new BadRequestException('Insufficient credits remaining on this pass/membership');
    }

    const balanceAfter = membership.remainingCredits - 1;

    await tx.studentMembership.update({
      where: { id: studentMembershipId },
      data: { remainingCredits: balanceAfter },
    });

    await tx.membershipCreditLedger.create({
      data: {
        tenantId,
        studentMembershipId,
        studentId: membership.studentId,
        bookingId,
        entryType: 'REDEMPTION',
        creditsDelta: -1,
        balanceAfter,
        reason: 'Class attendance check-in redemption',
        performedByUserId: userId,
      },
    });

    return { remainingCredits: balanceAfter };
  }

  async refundCredit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentMembershipId: string,
    bookingId: string,
    userId: string,
    reason = 'Booking cancellation credit refund'
  ): Promise<{ remainingCredits: number | null }> {
    const membership = await tx.studentMembership.findFirst({
      where: { id: studentMembershipId, tenantId, deletedAt: null },
    });

    if (!membership) {
      return { remainingCredits: null };
    }

    // Unlimited plan doesn't track remaining count
    if (membership.remainingCredits === null) {
      return { remainingCredits: null };
    }

    const balanceAfter = membership.remainingCredits + 1;

    await tx.studentMembership.update({
      where: { id: studentMembershipId },
      data: { remainingCredits: balanceAfter },
    });

    await tx.membershipCreditLedger.create({
      data: {
        tenantId,
        studentMembershipId,
        studentId: membership.studentId,
        bookingId,
        entryType: 'REFUND_RESTORE',
        creditsDelta: 1,
        balanceAfter,
        reason,
        performedByUserId: userId,
      },
    });

    return { remainingCredits: balanceAfter };
  }

  async getLedgerEntries(
    tenantId: string,
    query: CreditLedgerListQuery = {}
  ): Promise<CreditLedgerEntryDetails[]> {
    const where: any = {
      tenantId,
    };

    if (query.studentMembershipId) {
      where.studentMembershipId = query.studentMembershipId;
    }

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const entries = await prisma.membershipCreditLedger.findMany({
      where,
      include: {
        performedByUser: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return entries.map((e) => this.mapToDto(e));
  }

  private mapToDto(e: any): CreditLedgerEntryDetails {
    return {
      id: e.id,
      tenantId: e.tenantId,
      studentMembershipId: e.studentMembershipId,
      studentId: e.studentId,
      bookingId: e.bookingId,
      entryType: e.entryType,
      creditsDelta: e.creditsDelta,
      balanceAfter: e.balanceAfter,
      reason: e.reason,
      performedByUserId: e.performedByUserId,
      performedByUserName: e.performedByUser?.fullName || null,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
