import { z } from 'zod';

export const IntegrationConnectionStatusEnum = z.enum([
  'SANDBOX_CONFIGURED',
  'LIVE_CONFIGURED',
  'UNCONFIGURED',
]);
export type IntegrationConnectionStatus = z.infer<typeof IntegrationConnectionStatusEnum>;

export const DashboardOperationsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type DashboardOperationsQuery = z.infer<typeof DashboardOperationsQuerySchema>;

export const DashboardSessionOverviewSchema = z.object({
  id: z.string().uuid(),
  classTemplateName: z.string(),
  batchName: z.string().optional(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  roomId: z.string().uuid(),
  roomName: z.string(),
  instructorId: z.string().uuid(),
  instructorName: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  capacity: z.number(),
  bookedCount: z.number(),
  waitlistCount: z.number(),
  attendedCount: z.number(),
  status: z.string(),
  conductorSessionId: z.string().uuid().optional().nullable(),
  conductorStatus: z.string().optional().nullable(),
});
export type DashboardSessionOverview = z.infer<typeof DashboardSessionOverviewSchema>;

export const DashboardAttendanceSummarySchema = z.object({
  totalScheduledToday: z.number(),
  totalBooked: z.number(),
  totalAttended: z.number(),
  totalNoShow: z.number(),
  totalLateCancel: z.number(),
  attendanceRatePercentage: z.number(),
});
export type DashboardAttendanceSummary = z.infer<typeof DashboardAttendanceSummarySchema>;

export const DashboardCapacityUtilizationSchema = z.object({
  totalCapacity: z.number(),
  totalBooked: z.number(),
  utilizationPercentage: z.number(),
});
export type DashboardCapacityUtilization = z.infer<typeof DashboardCapacityUtilizationSchema>;

export const DashboardMembershipAlertItemSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  studentName: z.string(),
  planName: z.string(),
  endDate: z.string(),
  status: z.string(),
  daysRemaining: z.number(),
});
export type DashboardMembershipAlertItem = z.infer<typeof DashboardMembershipAlertItemSchema>;

export const DashboardMembershipAlertsSchema = z.object({
  activeCount: z.number(),
  expiringIn7DaysCount: z.number(),
  expiringIn3DaysCount: z.number(),
  expiringTodayCount: z.number(),
  expiredUnrenewedCount: z.number(),
  recentExpiring: z.array(DashboardMembershipAlertItemSchema),
});
export type DashboardMembershipAlerts = z.infer<typeof DashboardMembershipAlertsSchema>;

export const DashboardFinancialSummarySchema = z.object({
  totalCollectedToday: z.number(),
  totalCollectedMonth: z.number(),
  totalOverdueAmount: z.number(),
  overdueInvoicesCount: z.number(),
  pendingInvoicesCount: z.number(),
});
export type DashboardFinancialSummary = z.infer<typeof DashboardFinancialSummarySchema>;

export const DashboardLeadPipelineSchema = z.object({
  totalLeads: z.number(),
  newLeads: z.number(),
  contactedLeads: z.number(),
  trialBookedLeads: z.number(),
  convertedLeads: z.number(),
  lostLeads: z.number(),
  conversionRatePercentage: z.number(),
});
export type DashboardLeadPipeline = z.infer<typeof DashboardLeadPipelineSchema>;

export const DashboardConductorAlertItemSchema = z.object({
  id: z.string().uuid(),
  sessionInstanceId: z.string().uuid(),
  classTitle: z.string(),
  instructorName: z.string(),
  status: z.string(),
  currentStepIndex: z.number(),
  totalSteps: z.number(),
  startedAt: z.string().optional().nullable(),
  isOfflineReady: z.boolean(),
});
export type DashboardConductorAlertItem = z.infer<typeof DashboardConductorAlertItemSchema>;

export const DashboardConductorSummarySchema = z.object({
  activeSessions: z.array(DashboardConductorAlertItemSchema),
  unfinishedSessionsCount: z.number(),
  offlineReadySessionsCount: z.number(),
  unsyncedEventsEstimate: z.number(),
});
export type DashboardConductorSummary = z.infer<typeof DashboardConductorSummarySchema>;

export const DashboardGatewayStatusSchema = z.object({
  provider: z.string(),
  status: IntegrationConnectionStatusEnum,
  isEnabled: z.boolean(),
  mode: z.string().optional(),
});
export type DashboardGatewayStatus = z.infer<typeof DashboardGatewayStatusSchema>;

export const DashboardFailedReminderItemSchema = z.object({
  id: z.string().uuid(),
  reminderType: z.string(),
  channel: z.string(),
  deliveryStatus: z.string(),
  recipientContact: z.string(),
  lastError: z.string().optional().nullable(),
  createdAt: z.string(),
  retryCount: z.number(),
});
export type DashboardFailedReminderItem = z.infer<typeof DashboardFailedReminderItemSchema>;

export const DashboardNotificationsSummarySchema = z.object({
  totalReminders: z.number(),
  pendingCount: z.number(),
  sentCount: z.number(),
  deliveredCount: z.number(),
  failedCount: z.number(),
  failedReminders: z.array(DashboardFailedReminderItemSchema),
});
export type DashboardNotificationsSummary = z.infer<typeof DashboardNotificationsSummarySchema>;

export const DashboardIntegrationsSummarySchema = z.object({
  gateways: z.array(DashboardGatewayStatusSchema),
  webhookExceptionsCount: z.number(),
  notifications: DashboardNotificationsSummarySchema,
  workerStatus: z.enum(['HEALTHY', 'DEGRADED', 'INACTIVE']),
});
export type DashboardIntegrationsSummary = z.infer<typeof DashboardIntegrationsSummarySchema>;

export const DashboardOperationsDataSchema = z.object({
  generatedAt: z.string(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  todaySessions: z.array(DashboardSessionOverviewSchema),
  attendanceSummary: DashboardAttendanceSummarySchema,
  capacityUtilization: DashboardCapacityUtilizationSchema,
  membershipAlerts: DashboardMembershipAlertsSchema,
  financialSummary: DashboardFinancialSummarySchema.optional().nullable(), // Nullable for restricted roles (e.g. Receptionist)
  leadPipeline: DashboardLeadPipelineSchema,
  conductorSummary: DashboardConductorSummarySchema,
  integrations: DashboardIntegrationsSummarySchema,
});
export type DashboardOperationsData = z.infer<typeof DashboardOperationsDataSchema>;
