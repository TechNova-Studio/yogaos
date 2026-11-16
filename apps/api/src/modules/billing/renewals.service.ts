import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  prisma,
  MembershipStatus,
  MembershipRenewalStatus,
  PaymentMode,
} from '@yogaos/database';
import {
  UpcomingRenewalsQuery,
  RenewMembershipInput,
  MembershipRenewalResult,
} from '@yogaos/contracts';
import { InvoicesService } from './invoices.service.js';
import { PaymentsService } from './payments.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class RenewalsService {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly paymentsService: PaymentsService,
    private readonly audit: AuditService
  ) {}

  async getUpcomingRenewals(tenantId: string, query: UpcomingRenewalsQuery) {
    const now = new Date();
    const futureDate = new Date(
      now.getTime() + (query.daysAhead ?? 7) * 24 * 60 * 60 * 1000
    );

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.branchId) {
      where.homeBranchId = query.branchId;
    }

    if (query.status) {
      where.renewalStatus = query.status;
    }

    if (query.includeExpired) {
      where.expiryDate = { lte: futureDate };
    } else {
      where.expiryDate = { gte: now, lte: futureDate };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.studentMembership.count({ where }),
      prisma.studentMembership.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expiryDate: 'asc' },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              email: true,
              mobilePhone: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              planType: true,
              price: true,
              validityDays: true,
            },
          },
          homeBranch: {
            select: {
              id: true,
              name: true,
            },
          },
          renewals: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
            take: 1,
          },
        },
      }),
    ]);

    const formatted = items.map((m) => {
      const daysRemaining = Math.ceil(
        (new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isExpired = daysRemaining < 0;

      return {
        id: m.id,
        studentId: m.studentId,
        studentName: m.student.fullName,
        studentEmail: m.student.email,
        studentPhone: m.student.mobilePhone,
        planId: m.membershipPlanId,
        planName: m.planNameSnapshot || m.plan.name,
        planPrice: Number(m.priceSnapshot || m.plan.price),
        branchName: m.homeBranch?.name ?? 'All Branches',
        startDate: m.startDate,
        expiryDate: m.expiryDate,
        remainingCredits: m.remainingCredits,
        totalCredits: m.totalCredits,
        status: m.status,
        renewalStatus: m.renewalStatus,
        autoRenewConsent: m.autoRenewConsent,
        daysRemaining,
        isExpired,
        hasBeenRenewed: m.renewals.length > 0 || m.renewalStatus === MembershipRenewalStatus.RENEWED,
      };
    });

    return {
      items: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async renewMembership(
    tenantId: string,
    data: RenewMembershipInput,
    userId: string
  ): Promise<MembershipRenewalResult> {
    const existing = await prisma.studentMembership.findFirst({
      where: {
        id: data.studentMembershipId,
        tenantId,
        deletedAt: null,
      },
      include: {
        plan: true,
        student: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Student membership with ID ${data.studentMembershipId} not found`
      );
    }

    if (existing.renewalStatus === MembershipRenewalStatus.RENEWED) {
      throw new ConflictException(
        `Student membership ${data.studentMembershipId} has already been renewed`
      );
    }

    let targetPlan = existing.plan;
    if (data.targetPlanId && data.targetPlanId !== existing.membershipPlanId) {
      const selectedPlan = await prisma.membershipPlan.findFirst({
        where: {
          id: data.targetPlanId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!selectedPlan) {
        throw new NotFoundException(`Target plan ${data.targetPlanId} not found`);
      }
      targetPlan = selectedPlan;
    }

    const now = new Date();
    let startDate: Date;
    if (data.startDate) {
      startDate = new Date(data.startDate);
    } else if (new Date(existing.expiryDate) > now) {
      // If previous membership is still active, renewal starts seamlessly at its expiry date
      startDate = new Date(existing.expiryDate);
    } else {
      // If expired, renewal starts now
      startDate = now;
    }

    // Calculate expiryDate
    const durationDays = targetPlan.validityDays ?? 30;
    const expiryDate = new Date(
      startDate.getTime() + durationDays * 24 * 60 * 60 * 1000
    );

    const totalCredits =
      targetPlan.planType === 'TIME_UNLIMITED'
        ? null
        : targetPlan.planType === 'SINGLE_DROP_IN'
        ? targetPlan.creditCount || 1
        : targetPlan.creditCount;

    const price =
      data.customPrice !== undefined
        ? data.customPrice
        : Number(targetPlan.price);

    const newMembership = await prisma.$transaction(async (tx) => {
      // 1. Mark existing membership renewed
      await tx.studentMembership.update({
        where: { id: existing.id },
        data: {
          renewalStatus: MembershipRenewalStatus.RENEWED,
        },
      });

      // 2. Create new membership
      const created = await tx.studentMembership.create({
        data: {
          tenantId,
          studentId: existing.studentId,
          membershipPlanId: targetPlan.id,
          homeBranchId: existing.homeBranchId,
          planNameSnapshot: targetPlan.name,
          planTypeSnapshot: targetPlan.planType,
          priceSnapshot: price,
          isMultiBranchSnapshot: targetPlan.isMultiBranchValid,
          status: MembershipStatus.ACTIVE,
          startDate,
          expiryDate,
          totalCredits,
          remainingCredits: totalCredits,
          freezesUsed: 0,
          totalFrozenDays: 0,
          renewedFromMembershipId: existing.id,
          renewalStatus: MembershipRenewalStatus.UPCOMING,
          autoRenewConsent: data.autoRenewConsent ?? existing.autoRenewConsent,
          notes: data.notes ?? `Renewed from membership ${existing.id}`,
        },
      });

      // 3. Allocate credits in ledger if credit-based
      if (totalCredits !== null && totalCredits > 0) {
        await tx.membershipCreditLedger.create({
          data: {
            tenantId,
            studentMembershipId: created.id,
            studentId: existing.studentId,
            entryType: 'INITIAL_ALLOCATION',
            creditsDelta: totalCredits,
            balanceAfter: totalCredits,
            reason: `Renewal allocation for ${targetPlan.name} (from ${existing.id})`,
            performedByUserId: userId,
          },
        });
      }

      return created;
    });

    // 4. Generate invoice
    let invoiceId: string | undefined;
    let paymentTransactionId: string | undefined;

    try {
      const invoice = await this.invoicesService.createInvoice(
        tenantId,
        {
          studentId: existing.studentId,
          studentMembershipId: newMembership.id,
          branchId: existing.homeBranchId ?? undefined,
          dueDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          notes: `Membership Renewal: ${targetPlan.name}`,
          lineItems: [
            {
              description: `Membership Renewal: ${targetPlan.name}`,
              sacCode: '9992',
              quantity: 1,
              unitPrice: price,
              taxRatePercent: 18,
            },
          ],
        },
        userId
      );
      invoiceId = invoice.id;

      // 5. Collect payment immediately if requested
      if (data.collectPaymentNow && invoiceId) {
        const payment = await this.paymentsService.recordPayment(
          tenantId,
          {
            invoiceId,
            studentId: existing.studentId,
            studentMembershipId: newMembership.id,
            branchId: existing.homeBranchId ?? undefined,
            amount: invoice.totalAmount,
            paymentMode: (data.paymentMode as PaymentMode) || PaymentMode.UPI,
            utrReference: data.utrReference,
            notes: `Immediate payment collection for renewal ${newMembership.id}`,
            idempotencyKey: data.idempotencyKey,
          },
          userId
        );
        paymentTransactionId = payment.id;
      }
    } catch (err: any) {
      // Log invoice/payment error without rolling back membership creation
      console.error('Invoice/Payment creation during renewal warning:', err?.message);
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'MEMBERSHIP_RENEWED',
      resourceType: 'STUDENT_MEMBERSHIP',
      resourceId: newMembership.id,
      details: {
        previousMembershipId: existing.id,
        newMembershipId: newMembership.id,
        planId: targetPlan.id,
        planName: targetPlan.name,
        invoiceId,
        paymentTransactionId,
      },
    });

    return {
      newMembershipId: newMembership.id,
      previousMembershipId: existing.id,
      studentId: existing.studentId,
      membershipPlanId: targetPlan.id,
      startDate: newMembership.startDate,
      expiryDate: newMembership.expiryDate,
      totalCredits: newMembership.totalCredits ?? 0,
      invoiceId,
      paymentTransactionId,
      status: newMembership.status,
    };
  }
}
