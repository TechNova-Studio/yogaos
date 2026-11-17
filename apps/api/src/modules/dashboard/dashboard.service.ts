import { Injectable } from '@nestjs/common';
import { prisma, PaymentGatewayProvider, UserRole } from '@yogaos/database';
import {
  DashboardOperationsQuery,
  DashboardOperationsData,
  IntegrationConnectionStatus,
} from '@yogaos/contracts';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Injectable()
export class DashboardService {
  async getOperationsData(
    tenantId: string,
    query: DashboardOperationsQuery,
    user: AuthenticatedUser
  ): Promise<DashboardOperationsData> {
    const now = new Date();
    
    // Determine time range
    const startOfDay = query.startDate
      ? new Date(query.startDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = query.endDate
      ? new Date(query.endDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Role checks
    const activeRole = user.activeRole;
    const isOwnerOrManager = activeRole === UserRole.OWNER || activeRole === UserRole.MANAGER;
    const isInstructor = activeRole === UserRole.INSTRUCTOR;

    // 1. Sessions query
    const sessionWhere: any = {
      tenantId,
      startTimestamp: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (query.branchId) {
      sessionWhere.branchId = query.branchId;
    }

    if (isInstructor && !isOwnerOrManager) {
      sessionWhere.instructorId = user.id;
    }

    const [
      sessions,
      activeMembershipsCount,
      expiringIn7Count,
      expiringIn3Count,
      expiringTodayCount,
      expiredUnrenewedCount,
      expiringMemberships,
      leadCounts,
      gatewayConfigs,
      failedWebhookCount,
      reminderStats,
      failedReminders,
      activeConductorSessions,
      offlineReadyCount,
    ] = await Promise.all([
      // Sessions for the day
      prisma.classSessionInstance.findMany({
        where: sessionWhere,
        orderBy: { startTimestamp: 'asc' },
        include: {
          classType: { select: { name: true } },
          batch: { select: { name: true } },
          branch: { select: { id: true, name: true } },
          room: { select: { id: true, name: true } },
          instructor: { select: { id: true, fullName: true } },
          bookings: {
            select: {
              id: true,
              status: true,
            },
          },
          waitlistEntries: {
            where: { status: 'WAITING' },
            select: { id: true },
          },
          conductorSession: {
            select: { id: true, status: true },
          },
        },
      }),

      // Active memberships
      prisma.studentMembership.count({
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
      }),

      // Expiring in 7 days
      prisma.studentMembership.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          expiryDate: { gte: now, lte: in7Days },
        },
      }),

      // Expiring in 3 days
      prisma.studentMembership.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          expiryDate: { gte: now, lte: in3Days },
        },
      }),

      // Expiring today
      prisma.studentMembership.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          expiryDate: { gte: startOfDay, lte: endOfDay },
        },
      }),

      // Expired unrenewed
      prisma.studentMembership.count({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { status: 'EXPIRED' },
            { status: 'ACTIVE', expiryDate: { lt: now } },
          ],
        },
      }),

      // Recent expiring memberships
      prisma.studentMembership.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          expiryDate: { gte: now, lte: in7Days },
        },
        orderBy: { expiryDate: 'asc' },
        take: 10,
        include: {
          student: { select: { fullName: true } },
        },
      }),

      // Lead breakdown by status
      prisma.lead.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),

      // Gateway configurations
      prisma.paymentGatewayConfig.findMany({
        where: { tenantId },
      }),

      // Failed webhooks
      prisma.webhookEvent.count({
        where: { tenantId, status: 'FAILED' },
      }),

      // Billing reminder stats
      prisma.billingReminder.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),

      // Recent failed reminders for actionable retry
      prisma.billingReminder.findMany({
        where: { tenantId, status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Active conductor sessions
      prisma.conductorSession.findMany({
        where: {
          tenantId,
          status: { in: ['READY', 'RUNNING', 'PAUSED', 'INTERRUPTED'] },
        },
        include: {
          sessionInstance: {
            include: {
              classType: { select: { name: true } },
              instructor: { select: { fullName: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),

      // Offline ready conductor sessions count
      prisma.conductorSession.count({
        where: { tenantId, isOfflineReady: true },
      }),
    ]);

    // Financial calculations (strictly restricted to OWNER and MANAGER)
    let financialSummary = null;
    if (isOwnerOrManager) {
      const [todayPayments, monthPayments, overdueInvoices, pendingInvoicesCount] =
        await Promise.all([
          prisma.paymentTransaction.aggregate({
            _sum: { amount: true },
            where: {
              tenantId,
              status: 'COMPLETED',
              paidAt: { gte: startOfDay, lte: endOfDay },
            },
          }),
          prisma.paymentTransaction.aggregate({
            _sum: { amount: true },
            where: {
              tenantId,
              status: 'COMPLETED',
              paidAt: { gte: startOfMonth, lte: endOfMonth },
            },
          }),
          prisma.taxInvoice.aggregate({
            _sum: { balanceDue: true },
            _count: { _all: true },
            where: {
              tenantId,
              status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
              dueDate: { lt: now },
            },
          }),
          prisma.taxInvoice.count({
            where: {
              tenantId,
              status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
            },
          }),
        ]);

      financialSummary = {
        totalCollectedToday: Number(todayPayments._sum.amount ?? 0),
        totalCollectedMonth: Number(monthPayments._sum.amount ?? 0),
        totalOverdueAmount: Number(overdueInvoices._sum.balanceDue ?? 0),
        overdueInvoicesCount: overdueInvoices._count._all,
        pendingInvoicesCount,
      };
    }

    // Process Sessions
    let totalScheduledToday = sessions.length;
    let totalCapacity = 0;
    let totalBooked = 0;
    let totalAttended = 0;
    let totalNoShow = 0;
    let totalLateCancel = 0;

    const todaySessions = sessions.map((s: any) => {
      totalCapacity += s.capacity;
      
      const activeBookings = s.bookings.filter(
        (b: any) => b.status !== 'CANCELLED'
      );
      const bookedCount = activeBookings.length;
      totalBooked += bookedCount;

      const attendedInSession = s.bookings.filter(
        (b: any) => b.status === 'ATTENDED'
      ).length;
      totalAttended += attendedInSession;

      const noShowInSession = s.bookings.filter(
        (b: any) => b.status === 'NO_SHOW'
      ).length;
      totalNoShow += noShowInSession;

      const lateCancelInSession = s.bookings.filter(
        (b: any) => b.status === 'LATE_CANCEL'
      ).length;
      totalLateCancel += lateCancelInSession;

      return {
        id: s.id,
        classTemplateName: s.classType.name,
        batchName: s.batch?.name,
        branchId: s.branch.id,
        branchName: s.branch.name,
        roomId: s.room.id,
        roomName: s.room.name,
        instructorId: s.instructor.id,
        instructorName: s.instructor.fullName,
        startTime: s.startTimestamp.toISOString(),
        endTime: s.endTimestamp.toISOString(),
        capacity: s.capacity,
        bookedCount,
        waitlistCount: s.waitlistEntries.length,
        attendedCount: attendedInSession,
        status: s.status,
        conductorSessionId: s.conductorSession?.id ?? null,
        conductorStatus: s.conductorSession?.status ?? null,
      };
    });

    const attendanceRatePercentage =
      totalBooked > 0 ? Math.round((totalAttended / totalBooked) * 100) : 0;
    const utilizationPercentage =
      totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

    // Process Leads
    const leadMap: Record<string, number> = {};
    let totalLeads = 0;
    leadCounts.forEach((l: any) => {
      leadMap[l.status] = l._count._all;
      totalLeads += l._count._all;
    });

    const convertedLeads = leadMap['CONVERTED'] || 0;
    const leadPipeline = {
      totalLeads,
      newLeads: leadMap['NEW'] || 0,
      contactedLeads: leadMap['CONTACTED'] || 0,
      trialBookedLeads: leadMap['TRIAL_BOOKED'] || 0,
      convertedLeads,
      lostLeads: leadMap['LOST'] || 0,
      conversionRatePercentage:
        totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
    };

    // Process Integrations Health
    // Never falsely claim LIVE without credentials
    const gateways = [PaymentGatewayProvider.RAZORPAY, PaymentGatewayProvider.STRIPE].map((provider: any) => {
      const cfg = gatewayConfigs.find((c: any) => c.provider === provider);
      let status: IntegrationConnectionStatus = 'UNCONFIGURED';
      let isEnabled = false;

      if (cfg && cfg.isEnabled) {
        isEnabled = true;
        if (cfg.apiKey && cfg.apiKey.trim().length > 0) {
          status = cfg.isTestMode ? 'SANDBOX_CONFIGURED' : 'LIVE_CONFIGURED';
        }
      }

      return {
        provider,
        status,
        isEnabled,
        mode: cfg?.isTestMode ? 'test' : 'live',
      };
    });

    // Reminders
    let totalReminders = 0;
    let pendingReminders = 0;
    let sentReminders = 0;
    let deliveredReminders = 0;
    let failedRemindersCount = 0;

    reminderStats.forEach((r: any) => {
      totalReminders += r._count._all;
      if (r.status === 'PENDING') pendingReminders = r._count._all;
      if (r.status === 'SENT') sentReminders = r._count._all;
      if (r.status === 'DELIVERED') deliveredReminders = r._count._all;
      if (r.status === 'FAILED') failedRemindersCount = r._count._all;
    });

    // Conductor Summary
    const conductorSummary = {
      activeSessions: activeConductorSessions.map((c: any) => ({
        id: c.id,
        sessionInstanceId: c.sessionInstanceId,
        classTitle: c.sessionInstance.classType.name,
        instructorName: c.sessionInstance.instructor.fullName,
        status: c.status,
        currentStepIndex: c.currentStepIndex,
        totalSteps: 1, // baseline
        startedAt: c.actualStartedAt?.toISOString() ?? null,
        isOfflineReady: c.isOfflineReady,
      })),
      unfinishedSessionsCount: activeConductorSessions.length,
      offlineReadySessionsCount: offlineReadyCount,
      unsyncedEventsEstimate: 0,
    };

    return {
      generatedAt: now.toISOString(),
      tenantId,
      branchId: query.branchId ?? null,
      todaySessions,
      attendanceSummary: {
        totalScheduledToday,
        totalBooked,
        totalAttended,
        totalNoShow,
        totalLateCancel,
        attendanceRatePercentage,
      },
      capacityUtilization: {
        totalCapacity,
        totalBooked,
        utilizationPercentage,
      },
      membershipAlerts: {
        activeCount: activeMembershipsCount,
        expiringIn7DaysCount: expiringIn7Count,
        expiringIn3DaysCount: expiringIn3Count,
        expiringTodayCount: expiringTodayCount,
        expiredUnrenewedCount: expiredUnrenewedCount,
        recentExpiring: expiringMemberships.map((m: any) => {
          const diffDays = Math.ceil(
            (new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            id: m.id,
            studentId: m.studentId,
            studentName: m.student.fullName,
            planName: m.planNameSnapshot,
            endDate: m.expiryDate.toISOString(),
            status: m.status,
            daysRemaining: Math.max(0, diffDays),
          };
        }),
      },
      financialSummary,
      leadPipeline,
      conductorSummary,
      integrations: {
        gateways,
        webhookExceptionsCount: failedWebhookCount,
        notifications: {
          totalReminders,
          pendingCount: pendingReminders,
          sentCount: sentReminders,
          deliveredCount: deliveredReminders,
          failedCount: failedRemindersCount,
          failedReminders: failedReminders.map((f: any) => {
            const meta = (f.metadata as Record<string, any>) || {};
            return {
              id: f.id,
              reminderType: f.reminderType,
              channel: f.channel,
              deliveryStatus: f.status,
              recipientContact: f.recipient,
              lastError: f.failureReason,
              createdAt: f.createdAt.toISOString(),
              retryCount: meta.retryCount || 0,
            };
          }),
        },
        workerStatus: 'HEALTHY',
      },
    };
  }
}
