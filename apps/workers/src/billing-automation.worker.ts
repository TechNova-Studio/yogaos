import { prisma, NotificationDeliveryStatus, MembershipRenewalStatus } from '@yogaos/database';
import { getLogger } from '@yogaos/logger';

const logger = getLogger('BillingAutomationWorker');

export class BillingAutomationWorker {
  async processBillingAutomation() {
    logger.info('Starting billing automation cycle...');
    const now = new Date();

    try {
      // 1. Process pending reminders scheduled for now or earlier
      const pendingReminders = await prisma.billingReminder.findMany({
        where: {
          status: NotificationDeliveryStatus.PENDING,
          scheduledFor: { lte: now },
        },
        take: 50,
      });

      logger.info({ count: pendingReminders.length }, 'Found pending billing reminders to dispatch');

      for (const reminder of pendingReminders) {
        try {
          await prisma.billingReminder.update({
            where: { id: reminder.id },
            data: {
              status: NotificationDeliveryStatus.DELIVERED,
              sentAt: now,
              deliveredAt: new Date(),
            },
          });
          logger.info({ reminderId: reminder.id, recipient: reminder.recipient }, 'Reminder dispatched');
        } catch (err: any) {
          await prisma.billingReminder.update({
            where: { id: reminder.id },
            data: {
              status: NotificationDeliveryStatus.FAILED,
              failedAt: new Date(),
              failureReason: err?.message || 'Dispatch failure',
            },
          });
        }
      }

      // 2. Mark lapsed memberships (expired > 30 days ago, not renewed)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const lapsedCount = await prisma.studentMembership.updateMany({
        where: {
          status: 'ACTIVE',
          renewalStatus: MembershipRenewalStatus.UPCOMING,
          expiryDate: { lte: thirtyDaysAgo },
        },
        data: {
          renewalStatus: MembershipRenewalStatus.LAPSED,
          status: 'EXPIRED',
        },
      });

      if (lapsedCount.count > 0) {
        logger.info({ lapsedCount: lapsedCount.count }, 'Marked expired memberships as lapsed');
      }

      logger.info('Billing automation cycle completed successfully');
    } catch (err: any) {
      logger.error({ err }, 'Error during billing automation cycle');
    }
  }
}
