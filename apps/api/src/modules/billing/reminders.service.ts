import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  prisma,
  ReminderType,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '@yogaos/database';
import {
  CreateBillingReminderInput,
  BillingReminderQuery,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class RemindersService {
  constructor(private readonly audit: AuditService) {}

  async createReminder(
    tenantId: string,
    data: CreateBillingReminderInput,
    userId?: string
  ) {
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, tenantId, deletedAt: null },
    });

    if (!student) {
      throw new NotFoundException(`Student ${data.studentId} not found`);
    }

    let recipient = data.recipient;
    if (!recipient) {
      if (data.channel === NotificationChannel.EMAIL) {
        recipient = student.email ?? undefined;
      } else {
        recipient = student.mobilePhone;
      }
    }

    if (!recipient) {
      throw new BadRequestException(
        `No valid ${data.channel} contact information available for student`
      );
    }

    // Deduplication check: check if an identical reminder was scheduled/sent within the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.billingReminder.findFirst({
      where: {
        tenantId,
        studentId: data.studentId,
        reminderType: data.reminderType as ReminderType,
        channel: data.channel as NotificationChannel,
        createdAt: { gte: oneDayAgo },
        status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED] },
      },
    });

    if (existing) {
      return {
        ...existing,
        deduplicated: true,
      };
    }

    const scheduledFor = data.scheduledFor
      ? new Date(data.scheduledFor)
      : new Date();

    const reminder = await prisma.billingReminder.create({
      data: {
        tenantId,
        studentId: data.studentId,
        studentMembershipId: data.studentMembershipId,
        invoiceId: data.invoiceId,
        paymentTransactionId: data.paymentTransactionId,
        reminderType: data.reminderType as ReminderType,
        channel: data.channel as NotificationChannel,
        recipient,
        templateName: data.templateName ?? 'DEFAULT_TEMPLATE',
        subject: data.subject ?? `Important Notification from YogaOS`,
        messageBody: data.messageBody,
        status: NotificationDeliveryStatus.PENDING,
        scheduledFor,
        metadata: data.metadata ?? {},
      },
      include: {
        student: { select: { fullName: true } },
      },
    });

    if (userId) {
      await this.audit.log({
        tenantId,
        userId,
        action: 'BILLING_REMINDER_CREATED',
        resourceType: 'BILLING_REMINDER',
        resourceId: reminder.id,
        details: {
          studentId: data.studentId,
          reminderType: data.reminderType,
          channel: data.channel,
        },
      });
    }

    // If scheduled for now, auto-dispatch
    if (scheduledFor <= new Date()) {
      return this.dispatchReminder(tenantId, reminder.id, userId);
    }

    return reminder;
  }

  async dispatchReminder(
    tenantId: string,
    reminderId: string,
    userId?: string
  ) {
    const reminder = await prisma.billingReminder.findFirst({
      where: { id: reminderId, tenantId },
      include: { student: true },
    });

    if (!reminder) {
      throw new NotFoundException(`Reminder ${reminderId} not found`);
    }

    if (reminder.status === NotificationDeliveryStatus.DELIVERED) {
      return reminder;
    }

    // Safe provider sandbox abstraction
    // In sandbox / test environment, simulate delivery and capture tracking timestamps
    const now = new Date();
    const isMockSuccess = Boolean(reminder.recipient && reminder.recipient.length > 3);

    const updated = await prisma.billingReminder.update({
      where: { id: reminder.id },
      data: {
        sentAt: now,
        deliveredAt: isMockSuccess ? new Date(now.getTime() + 100) : null,
        failedAt: isMockSuccess ? null : now,
        status: isMockSuccess
          ? NotificationDeliveryStatus.DELIVERED
          : NotificationDeliveryStatus.FAILED,
        failureReason: isMockSuccess
          ? null
          : 'Invalid or unreachable recipient address in sandbox',
      },
    });

    if (userId) {
      await this.audit.log({
        tenantId,
        userId,
        action: 'BILLING_REMINDER_DISPATCHED',
        resourceType: 'BILLING_REMINDER',
        resourceId: reminder.id,
        details: {
          channel: reminder.channel,
          recipient: reminder.recipient,
          status: updated.status,
        },
      });
    }

    return updated;
  }

  async retryReminder(
    tenantId: string,
    reminderId: string,
    userId?: string
  ) {
    const reminder = await prisma.billingReminder.findFirst({
      where: { id: reminderId, tenantId },
    });

    if (!reminder) {
      throw new NotFoundException(`Reminder ${reminderId} not found`);
    }

    const currentMeta = (reminder.metadata as Record<string, any>) || {};
    const retryCount = (currentMeta.retryCount || 0) + 1;

    await prisma.billingReminder.update({
      where: { id: reminder.id },
      data: {
        status: NotificationDeliveryStatus.PENDING,
        scheduledFor: new Date(),
        failureReason: null,
        failedAt: null,
        metadata: {
          ...currentMeta,
          retryCount,
          retriedAt: new Date().toISOString(),
          retriedBy: userId,
        },
      },
    });

    if (userId) {
      await this.audit.log({
        tenantId,
        userId,
        action: 'BILLING_REMINDER_RETRIED',
        resourceType: 'BILLING_REMINDER',
        resourceId: reminder.id,
        details: {
          previousStatus: reminder.status,
          retryCount,
        },
      });
    }

    return this.dispatchReminder(tenantId, reminder.id, userId);
  }

  async getReminders(tenantId: string, query: BillingReminderQuery) {
    const where: any = { tenantId };

    if (query.studentId) where.studentId = query.studentId;
    if (query.studentMembershipId) where.studentMembershipId = query.studentMembershipId;
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.reminderType) where.reminderType = query.reminderType;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.billingReminder.count({ where }),
      prisma.billingReminder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              email: true,
              mobilePhone: true,
            },
          },
          studentMembership: {
            select: {
              id: true,
              planNameSnapshot: true,
              expiryDate: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              balanceDue: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async scanAndGenerateReminders(tenantId: string) {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const results: any[] = [];

    // 1. Memberships approaching expiry (next 7 days)
    const expiringMemberships = await prisma.studentMembership.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        expiryDate: { gte: now, lte: in7Days },
      },
      include: {
        student: true,
      },
    });

    for (const m of expiringMemberships) {
      const daysLeft = Math.ceil(
        (new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      try {
        const created = await this.createReminder(tenantId, {
          studentId: m.studentId,
          studentMembershipId: m.id,
          reminderType: 'EXPIRY_APPROACHING',
          channel: 'EMAIL',
          subject: `Your yoga membership expires in ${daysLeft} days!`,
          messageBody: `Namaste ${m.student.fullName}, your membership (${m.planNameSnapshot}) will expire in ${daysLeft} days on ${new Date(m.expiryDate).toLocaleDateString()}. Renew today to keep your practice uninterrupted.`,
        });
        results.push(created);
      } catch (err: any) {
        // Ignored or deduplicated
      }
    }

    // 2. Overdue invoices
    const overdueInvoices = await prisma.taxInvoice.findMany({
      where: {
        tenantId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
        dueDate: { lt: now },
      },
      include: {
        student: true,
      },
    });

    for (const inv of overdueInvoices) {
      try {
        const created = await this.createReminder(tenantId, {
          studentId: inv.studentId,
          invoiceId: inv.id,
          reminderType: 'INVOICE_OVERDUE',
          channel: 'EMAIL',
          subject: `Payment Reminder: Invoice ${inv.invoiceNumber} is overdue`,
          messageBody: `Namaste ${inv.customerName}, payment for invoice ${inv.invoiceNumber} (amount due: ₹${inv.balanceDue}) was due on ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'recently'}. Please complete payment at your earliest convenience.`,
        });
        results.push(created);
      } catch (err: any) {
        // Ignored or deduplicated
      }
    }

    return {
      scannedExpiringMemberships: expiringMemberships.length,
      scannedOverdueInvoices: overdueInvoices.length,
      remindersCreated: results.length,
    };
  }
}
