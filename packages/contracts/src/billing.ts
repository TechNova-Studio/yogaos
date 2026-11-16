import { z } from 'zod';

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------
export const InvoiceStatusEnum = z.enum([
  'DRAFT',
  'ISSUED',
  'PAID',
  'PARTIALLY_PAID',
  'VOID',
  'CREDITED',
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

export const PaymentModeEnum = z.enum([
  'CASH',
  'UPI',
  'CARD',
  'BANK_TRANSFER',
  'ONLINE',
]);
export type PaymentMode = z.infer<typeof PaymentModeEnum>;

export const PaymentStatusEnum = z.enum([
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const RefundStatusEnum = z.enum([
  'PENDING',
  'COMPLETED',
  'FAILED',
]);
export type RefundStatus = z.infer<typeof RefundStatusEnum>;

export const CreditNoteStatusEnum = z.enum([
  'ISSUED',
  'APPLIED',
  'VOID',
]);
export type CreditNoteStatus = z.infer<typeof CreditNoteStatusEnum>;

// ----------------------------------------------------------------------------
// Tax Settings Schemas
// ----------------------------------------------------------------------------
export const OrganizationTaxSettingsSchema = z.object({
  legalEntityName: z.string().trim().max(255).optional().nullable(),
  isGstRegistered: z.boolean().default(false),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian 15-character GSTIN format')
    .optional()
    .nullable(),
  panNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid Indian 10-character PAN format')
    .optional()
    .nullable(),
  defaultTaxRatePercent: z.coerce.number().min(0).max(100).default(18.0),
  defaultSacCode: z.string().trim().default('9992'),
  supplierStateCode: z.string().trim().length(2, 'State code must be 2 characters (e.g. DL, 29)').default('DL'),
  billingAddress: z.any().optional().nullable(),
});

export type OrganizationTaxSettings = z.infer<typeof OrganizationTaxSettingsSchema>;

export const UpdateOrganizationTaxSettingsSchema = OrganizationTaxSettingsSchema.partial();
export type UpdateOrganizationTaxSettingsRequest = z.input<typeof UpdateOrganizationTaxSettingsSchema>;

// ----------------------------------------------------------------------------
// Invoice Line Item Schemas
// ----------------------------------------------------------------------------
export const CreateInvoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(255),
  sacCode: z.string().trim().default('9992'),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  discountAmount: z.coerce.number().min(0).default(0),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
});

export type CreateInvoiceLineItem = z.input<typeof CreateInvoiceLineItemSchema>;

export const InvoiceLineItemDetailsSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  description: z.string(),
  sacCode: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  discountAmount: z.number(),
  taxableAmount: z.number(),
  taxRatePercent: z.number(),
  cgstAmount: z.number(),
  sgstAmount: z.number(),
  igstAmount: z.number(),
  totalAmount: z.number(),
});

export type InvoiceLineItemDetails = z.infer<typeof InvoiceLineItemDetailsSchema>;

// ----------------------------------------------------------------------------
// Invoice Schemas
// ----------------------------------------------------------------------------
export const CreateInvoiceSchema = z.object({
  studentId: z.string().uuid('Valid student ID is required'),
  branchId: z.string().uuid().optional().nullable(),
  studentMembershipId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  customerGstin: z.string().trim().optional().nullable(),
  customerStateCode: z.string().trim().max(2).optional().nullable(),
  discountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  lineItems: z.array(CreateInvoiceLineItemSchema).min(1, 'At least one line item is required'),
});

export type CreateInvoiceRequest = z.input<typeof CreateInvoiceSchema>;

export const TaxInvoiceDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  studentId: z.string().uuid(),
  studentName: z.string(),
  studentPhone: z.string().nullable().optional(),
  studentEmail: z.string().nullable().optional(),
  studentMembershipId: z.string().nullable().optional(),
  invoiceNumber: z.string(),
  fiscalYear: z.string(),
  sequenceNumber: z.number(),
  status: InvoiceStatusEnum,
  issueDate: z.string(),
  dueDate: z.string().nullable().optional(),
  currency: z.string(),
  subtotal: z.number(),
  discountAmount: z.number(),
  taxableAmount: z.number(),
  cgstAmount: z.number(),
  sgstAmount: z.number(),
  igstAmount: z.number(),
  totalTax: z.number(),
  totalAmount: z.number(),
  amountPaid: z.number(),
  balanceDue: z.number(),
  supplierGstin: z.string().nullable().optional(),
  supplierLegalName: z.string(),
  supplierStateCode: z.string(),
  supplierAddress: z.any().nullable().optional(),
  customerName: z.string(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  customerGstin: z.string().nullable().optional(),
  customerStateCode: z.string(),
  customerAddress: z.any().nullable().optional(),
  notes: z.string().nullable().optional(),
  lineItems: z.array(InvoiceLineItemDetailsSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaxInvoiceDetails = z.infer<typeof TaxInvoiceDetailsSchema>;

export const InvoiceListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  status: InvoiceStatusEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type InvoiceListQuery = z.input<typeof InvoiceListQuerySchema>;

// ----------------------------------------------------------------------------
// Payment Transaction Schemas
// ----------------------------------------------------------------------------
export const RecordPaymentSchema = z.object({
  studentId: z.string().uuid('Valid student ID is required'),
  invoiceId: z.string().uuid().optional().nullable(),
  studentMembershipId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  paymentMode: PaymentModeEnum,
  utrReference: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().trim().max(128).optional().nullable(),
});

export type RecordPaymentRequest = z.input<typeof RecordPaymentSchema>;

export const PaymentTransactionDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  studentMembershipId: z.string().nullable().optional(),
  receiptNumber: z.string().nullable().optional(),
  amount: z.number(),
  currency: z.string(),
  paymentMode: PaymentModeEnum,
  utrReference: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  status: PaymentStatusEnum,
  paidAt: z.string(),
  recordedByUserId: z.string().nullable().optional(),
  recordedByUserName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  refundedAmount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PaymentTransactionDetails = z.infer<typeof PaymentTransactionDetailsSchema>;

export const PaymentListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  paymentMode: PaymentModeEnum.optional(),
  status: PaymentStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaymentListQuery = z.input<typeof PaymentListQuerySchema>;

// ----------------------------------------------------------------------------
// Refund Schemas
// ----------------------------------------------------------------------------
export const ProcessRefundSchema = z.object({
  paymentTransactionId: z.string().uuid('Valid payment ID is required'),
  amount: z.coerce.number().positive('Refund amount must be greater than zero'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(255),
  refundMode: PaymentModeEnum.optional().nullable(),
  utrReference: z.string().trim().max(100).optional().nullable(),
  restoreMembershipCredit: z.boolean().default(false),
  idempotencyKey: z.string().trim().max(128).optional().nullable(),
});

export type ProcessRefundRequest = z.input<typeof ProcessRefundSchema>;

export const RefundRecordDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  paymentTransactionId: z.string().uuid(),
  invoiceId: z.string().nullable().optional(),
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  refundNumber: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: RefundStatusEnum,
  reason: z.string(),
  refundMode: PaymentModeEnum,
  utrReference: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  creditRestored: z.boolean(),
  creditNoteId: z.string().nullable().optional(),
  creditNoteNumber: z.string().nullable().optional(),
  processedByUserId: z.string().nullable().optional(),
  processedByUserName: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type RefundRecordDetails = z.infer<typeof RefundRecordDetailsSchema>;

export const RefundListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  paymentTransactionId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type RefundListQuery = z.input<typeof RefundListQuerySchema>;

// ----------------------------------------------------------------------------
// Credit Note Schemas
// ----------------------------------------------------------------------------
export const CreditNoteDetailsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  creditNoteNumber: z.string(),
  reason: z.string(),
  amount: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  status: CreditNoteStatusEnum,
  issuedAt: z.string(),
  issuedByUserId: z.string().nullable().optional(),
  issuedByUserName: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type CreditNoteDetails = z.infer<typeof CreditNoteDetailsSchema>;

// ----------------------------------------------------------------------------
// Financial Summary Schemas
// ----------------------------------------------------------------------------
export const DailyCollectionSummarySchema = z.object({
  date: z.string(),
  totalCollected: z.number(),
  byMode: z.record(z.string(), z.number()),
  transactionCount: z.number(),
  totalRefunded: z.number(),
  netCollected: z.number(),
});

export type DailyCollectionSummary = z.infer<typeof DailyCollectionSummarySchema>;
