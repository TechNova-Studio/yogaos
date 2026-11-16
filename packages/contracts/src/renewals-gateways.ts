import { z } from 'zod';

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------
export const PaymentGatewayProviderEnum = z.enum(['RAZORPAY', 'STRIPE']);
export type PaymentGatewayProvider = z.infer<typeof PaymentGatewayProviderEnum>;

export const ReconciliationStatusEnum = z.enum([
  'NOT_APPLICABLE',
  'MATCHED',
  'UNMATCHED',
  'MANUALLY_RECONCILED',
  'DISCREPANCY',
]);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatusEnum>;

export const WebhookEventStatusEnum = z.enum([
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED',
]);
export type WebhookEventStatus = z.infer<typeof WebhookEventStatusEnum>;

export const ReminderTypeEnum = z.enum([
  'EXPIRY_APPROACHING',
  'MEMBERSHIP_EXPIRED',
  'INVOICE_OVERDUE',
  'PAYMENT_REMINDER',
]);
export type ReminderType = z.infer<typeof ReminderTypeEnum>;

export const NotificationChannelEnum = z.enum(['EMAIL', 'SMS', 'WHATSAPP']);
export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;

export const NotificationDeliveryStatusEnum = z.enum([
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'SKIPPED',
]);
export type NotificationDeliveryStatus = z.infer<typeof NotificationDeliveryStatusEnum>;

export const MembershipRenewalStatusEnum = z.enum([
  'UPCOMING',
  'RENEWED',
  'LAPSED',
  'OPTED_OUT',
]);
export type MembershipRenewalStatus = z.infer<typeof MembershipRenewalStatusEnum>;

// ----------------------------------------------------------------------------
// Membership Renewal Schemas
// ----------------------------------------------------------------------------
export const UpcomingRenewalsQuerySchema = z.object({
  daysAhead: z.coerce.number().int().min(0).max(90).default(7).optional(),
  status: MembershipRenewalStatusEnum.optional(),
  branchId: z.string().uuid().optional(),
  includeExpired: z.coerce.boolean().default(true).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
export type UpcomingRenewalsQuery = z.infer<typeof UpcomingRenewalsQuerySchema>;

export const RenewMembershipSchema = z.object({
  studentMembershipId: z.string().uuid(),
  targetPlanId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  customPrice: z.number().min(0).optional(),
  collectPaymentNow: z.boolean().default(false).optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE']).default('UPI').optional(),
  utrReference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  autoRenewConsent: z.boolean().optional(),
  idempotencyKey: z.string().max(100).optional(),
});
export type RenewMembershipInput = z.infer<typeof RenewMembershipSchema>;

export const MembershipRenewalResultSchema = z.object({
  newMembershipId: z.string().uuid(),
  previousMembershipId: z.string().uuid(),
  studentId: z.string().uuid(),
  membershipPlanId: z.string().uuid(),
  startDate: z.date().or(z.string()),
  expiryDate: z.date().or(z.string()),
  totalCredits: z.number(),
  invoiceId: z.string().uuid().optional(),
  paymentTransactionId: z.string().uuid().optional(),
  status: z.string(),
});
export type MembershipRenewalResult = z.infer<typeof MembershipRenewalResultSchema>;

// ----------------------------------------------------------------------------
// Billing Reminders & Notifications Schemas
// ----------------------------------------------------------------------------
export const CreateBillingReminderSchema = z.object({
  studentId: z.string().uuid(),
  studentMembershipId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  paymentTransactionId: z.string().uuid().optional(),
  reminderType: ReminderTypeEnum,
  channel: NotificationChannelEnum,
  recipient: z.string().min(3).max(120).optional(),
  templateName: z.string().max(100).optional(),
  subject: z.string().max(200).optional(),
  messageBody: z.string().min(1).max(2000),
  scheduledFor: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});
export type CreateBillingReminderInput = z.infer<typeof CreateBillingReminderSchema>;

export const BillingReminderQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  studentMembershipId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  reminderType: ReminderTypeEnum.optional(),
  channel: NotificationChannelEnum.optional(),
  status: NotificationDeliveryStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
export type BillingReminderQuery = z.infer<typeof BillingReminderQuerySchema>;

export const DispatchReminderSchema = z.object({
  reminderId: z.string().uuid(),
});
export type DispatchReminderInput = z.infer<typeof DispatchReminderSchema>;

// ----------------------------------------------------------------------------
// Payment Gateway Configuration Schemas
// ----------------------------------------------------------------------------
export const UpsertPaymentGatewayConfigSchema = z.object({
  provider: PaymentGatewayProviderEnum,
  isEnabled: z.boolean().default(true).optional(),
  isTestMode: z.boolean().default(true).optional(),
  apiKey: z.string().max(255).optional(),
  apiSecret: z.string().max(255).optional(),
  webhookSecret: z.string().max(255).optional(),
  merchantAccount: z.string().max(255).optional(),
  settings: z.record(z.any()).optional(),
});
export type UpsertPaymentGatewayConfigInput = z.infer<typeof UpsertPaymentGatewayConfigSchema>;

// ----------------------------------------------------------------------------
// Gateway Checkout & Orders Schemas
// ----------------------------------------------------------------------------
export const InitiateCheckoutSchema = z.object({
  invoiceId: z.string().uuid(),
  provider: PaymentGatewayProviderEnum.default('RAZORPAY').optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).default('INR').optional(),
  returnUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional(),
});
export type InitiateCheckoutInput = z.infer<typeof InitiateCheckoutSchema>;

export const CheckoutSessionDetailsSchema = z.object({
  paymentTransactionId: z.string().uuid(),
  provider: PaymentGatewayProviderEnum,
  gatewayOrderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  keyId: z.string().optional(),
  checkoutUrl: z.string().optional(),
  studentName: z.string(),
  studentEmail: z.string().optional(),
  studentPhone: z.string().optional(),
  description: z.string(),
});
export type CheckoutSessionDetails = z.infer<typeof CheckoutSessionDetailsSchema>;

// ----------------------------------------------------------------------------
// Webhooks & Reconciliation Schemas
// ----------------------------------------------------------------------------
export const WebhookEventQuerySchema = z.object({
  provider: PaymentGatewayProviderEnum.optional(),
  status: WebhookEventStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
export type WebhookEventQuery = z.infer<typeof WebhookEventQuerySchema>;

export const ReconcilePaymentSchema = z.object({
  paymentTransactionId: z.string().uuid(),
  reconciliationStatus: ReconciliationStatusEnum,
  gatewayPaymentId: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type ReconcilePaymentInput = z.infer<typeof ReconcilePaymentSchema>;

export const ReconciliationQuerySchema = z.object({
  status: ReconciliationStatusEnum.optional(),
  provider: PaymentGatewayProviderEnum.optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
export type ReconciliationQuery = z.infer<typeof ReconciliationQuerySchema>;
