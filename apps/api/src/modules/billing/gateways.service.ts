import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  prisma,
  PaymentGatewayProvider,
  ReconciliationStatus,
  WebhookEventStatus,
  PaymentStatus,
  InvoiceStatus,
  PaymentMode,
} from '@yogaos/database';
import {
  UpsertPaymentGatewayConfigInput,
  InitiateCheckoutInput,
  CheckoutSessionDetails,
  WebhookEventQuery,
  ReconcilePaymentInput,
  ReconciliationQuery,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class GatewaysService {
  constructor(private readonly audit: AuditService) {}

  async getConfigs(tenantId: string) {
    const configs = await prisma.paymentGatewayConfig.findMany({
      where: { tenantId },
    });

    // Return configs with masked secrets
    return configs.map((c) => ({
      id: c.id,
      provider: c.provider,
      isEnabled: c.isEnabled,
      isTestMode: c.isTestMode,
      apiKey: c.apiKey ? `${c.apiKey.substring(0, 8)}...` : null,
      merchantAccount: c.merchantAccount,
      hasSecret: Boolean(c.apiSecret),
      hasWebhookSecret: Boolean(c.webhookSecret),
      settings: c.settings,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async upsertConfig(
    tenantId: string,
    data: UpsertPaymentGatewayConfigInput,
    userId: string
  ) {
    const existing = await prisma.paymentGatewayConfig.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: data.provider as PaymentGatewayProvider,
        },
      },
    });

    let config;
    if (existing) {
      config = await prisma.paymentGatewayConfig.update({
        where: { id: existing.id },
        data: {
          isEnabled: data.isEnabled,
          isTestMode: data.isTestMode,
          apiKey: data.apiKey ?? existing.apiKey,
          apiSecret: data.apiSecret ?? existing.apiSecret,
          webhookSecret: data.webhookSecret ?? existing.webhookSecret,
          merchantAccount: data.merchantAccount ?? existing.merchantAccount,
          settings: data.settings ?? (existing.settings as any),
        },
      });
    } else {
      config = await prisma.paymentGatewayConfig.create({
        data: {
          tenantId,
          provider: data.provider as PaymentGatewayProvider,
          isEnabled: data.isEnabled,
          isTestMode: data.isTestMode,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          webhookSecret: data.webhookSecret,
          merchantAccount: data.merchantAccount,
          settings: data.settings ?? {},
        },
      });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'GATEWAY_CONFIG_UPDATED',
      resourceType: 'PAYMENT_GATEWAY_CONFIG',
      resourceId: config.id,
      details: {
        provider: data.provider,
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
      },
    });

    return {
      id: config.id,
      provider: config.provider,
      isEnabled: config.isEnabled,
      isTestMode: config.isTestMode,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : null,
      merchantAccount: config.merchantAccount,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async initiateCheckout(
    tenantId: string,
    data: InitiateCheckoutInput,
    userId: string
  ): Promise<CheckoutSessionDetails> {
    const invoice = await prisma.taxInvoice.findFirst({
      where: {
        id: data.invoiceId,
        tenantId,
      },
      include: {
        student: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${data.invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const amount = data.amount ?? Number(invoice.balanceDue);
    if (amount <= 0) {
      throw new BadRequestException('Checkout amount must be greater than zero');
    }

    // Check for existing pending checkout session with idempotencyKey
    if (data.idempotencyKey) {
      const existing = await prisma.paymentTransaction.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: data.idempotencyKey,
          },
        },
      });

      if (existing && existing.gatewayOrderId) {
        return {
          paymentTransactionId: existing.id,
          provider: (existing.gatewayProvider as any) || data.provider,
          gatewayOrderId: existing.gatewayOrderId,
          amount: Number(existing.amount),
          currency: existing.currency,
          checkoutUrl: `https://checkout.yogaos.io/pay/${existing.gatewayOrderId}`,
          studentName: invoice.student.fullName,
          studentEmail: invoice.student.email ?? undefined,
          studentPhone: invoice.student.mobilePhone,
          description: `Payment for Invoice ${invoice.invoiceNumber}`,
        };
      }
    }

    // Generate Gateway Order ID
    const provider = data.provider as PaymentGatewayProvider;
    const randomHex = crypto.randomBytes(8).toString('hex');
    const gatewayOrderId =
      provider === PaymentGatewayProvider.RAZORPAY
        ? `order_${randomHex}`
        : `cs_test_${randomHex}`;

    // Create PaymentTransaction with PENDING status
    const payment = await prisma.paymentTransaction.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        studentMembershipId: invoice.studentMembershipId,
        branchId: invoice.branchId,
        amount,
        currency: data.currency ?? 'INR',
        paymentMode: PaymentMode.ONLINE,
        status: PaymentStatus.PENDING,
        gatewayProvider: provider,
        gatewayOrderId,
        reconciliationStatus: ReconciliationStatus.NOT_APPLICABLE,
        idempotencyKey: data.idempotencyKey,
        notes: data.notes ?? `Online gateway checkout order ${gatewayOrderId}`,
        recordedByUserId: userId,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CHECKOUT_INITIATED',
      resourceType: 'PAYMENT_TRANSACTION',
      resourceId: payment.id,
      details: {
        provider,
        gatewayOrderId,
        invoiceId: invoice.id,
        amount,
      },
    });

    return {
      paymentTransactionId: payment.id,
      provider: data.provider || PaymentGatewayProvider.RAZORPAY,
      gatewayOrderId,
      amount,
      currency: data.currency ?? 'INR',
      keyId: provider === 'RAZORPAY' ? 'rzp_test_yogaos' : 'pk_test_yogaos',
      checkoutUrl: `https://checkout.yogaos.io/pay/${gatewayOrderId}`,
      studentName: invoice.student.fullName,
      studentEmail: invoice.student.email ?? undefined,
      studentPhone: invoice.student.mobilePhone,
      description: `Payment for Invoice ${invoice.invoiceNumber}`,
    };
  }

  verifyRazorpaySignature(
    rawBody: string,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !secret) return false;
    try {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      const expectedBuf = Buffer.from(expected, 'utf8');
      const sigBuf = Buffer.from(signature, 'utf8');
      if (expectedBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, sigBuf);
    } catch {
      return false;
    }
  }

  verifyStripeSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string
  ): boolean {
    if (!signatureHeader || !secret) return false;

    // Format: t=1492774577,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
    const parts = signatureHeader.split(',');
    let timestamp: string | undefined;
    const signatures: string[] = [];

    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k === 't') timestamp = v;
      if (k === 'v1') signatures.push(v);
    }

    if (!timestamp || signatures.length === 0) return false;

    // Check 300s replay attack window
    const nowSec = Math.floor(Date.now() / 1000);
    const tsSec = parseInt(timestamp, 10);
    if (isNaN(tsSec) || Math.abs(nowSec - tsSec) > 300) {
      return false; // Stale or future timestamp
    }

    const payloadToSign = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex');

    return signatures.some((sig) => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expected, 'utf8'),
          Buffer.from(sig, 'utf8')
        );
      } catch {
        return false;
      }
    });
  }

  async processWebhook(
    provider: PaymentGatewayProvider,
    rawBody: string,
    signatureHeader: string,
    tenantIdHeader?: string
  ) {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid JSON payload in webhook body');
    }

    // Extract eventId and eventType
    let eventId: string;
    let eventType: string;
    let gatewayOrderId: string | undefined;
    let gatewayPaymentId: string | undefined;

    if (provider === PaymentGatewayProvider.RAZORPAY) {
      eventType = payload.event || 'unknown';
      eventId = payload.event_id || `rzp_${eventType}_${payload.payload?.payment?.entity?.id || Date.now()}`;
      gatewayOrderId = payload.payload?.payment?.entity?.order_id;
      gatewayPaymentId = payload.payload?.payment?.entity?.id;
    } else {
      eventType = payload.type || 'unknown';
      eventId = payload.id || `str_${eventType}_${Date.now()}`;
      gatewayOrderId =
        payload.data?.object?.id ||
        payload.data?.object?.metadata?.gatewayOrderId ||
        payload.data?.object?.payment_intent;
      gatewayPaymentId =
        payload.data?.object?.payment_intent ||
        payload.data?.object?.id;
    }

    // Idempotency check: check if event was already processed
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });

    if (existingEvent && existingEvent.status === WebhookEventStatus.PROCESSED) {
      return {
        received: true,
        duplicate: true,
        eventId,
        status: existingEvent.status,
      };
    }

    // Determine tenant context from matched payment transaction or tenantIdHeader
    let tenantId = tenantIdHeader;
    let matchedPayment = null;

    if (gatewayOrderId) {
      matchedPayment = await prisma.paymentTransaction.findFirst({
        where: { gatewayOrderId },
        include: { invoice: true },
      });
      if (matchedPayment) {
        tenantId = matchedPayment.tenantId;
      }
    }

    if (!tenantId) {
      // Find any organization or first matching tenant for fallback
      const org = await prisma.organization.findFirst({
        where: { deletedAt: null },
      });
      tenantId = org?.id || 'system';
    }

    // Verify signature against tenant's gateway config
    const config = await prisma.paymentGatewayConfig.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider,
        },
      },
    });

    const webhookSecret = config?.webhookSecret || 'test_webhook_secret';
    let isValidSignature = false;

    if (provider === PaymentGatewayProvider.RAZORPAY) {
      isValidSignature = this.verifyRazorpaySignature(
        rawBody,
        signatureHeader,
        webhookSecret
      );
    } else {
      isValidSignature = this.verifyStripeSignature(
        rawBody,
        signatureHeader,
        webhookSecret
      );
    }

    // In development/test sandbox mode only, allow mock signatures for synthetic integration testing
    const isDevOrTest = process.env.NODE_ENV !== 'production';
    if (isDevOrTest && (signatureHeader === 'test_sandbox_signature' || signatureHeader === 'mock_valid_signature')) {
      isValidSignature = true;
    }

    if (!isValidSignature) {
      // Record failed event for audit trail
      try {
        await prisma.webhookEvent.upsert({
          where: { provider_eventId: { provider, eventId } },
          create: {
            tenantId,
            provider,
            eventId,
            eventType,
            signature: signatureHeader,
            payload,
            status: WebhookEventStatus.FAILED,
            errorMessage: 'Invalid webhook signature',
          },
          update: {
            status: WebhookEventStatus.FAILED,
            errorMessage: 'Invalid webhook signature',
          },
        });
      } catch (e) {
        // ignore
      }
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Store WebhookEvent as PROCESSING
    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider, eventId } },
      create: {
        tenantId,
        provider,
        eventId,
        eventType,
        signature: signatureHeader,
        payload,
        status: WebhookEventStatus.PROCESSING,
      },
      update: {
        status: WebhookEventStatus.PROCESSING,
      },
    });

    // Handle payment events
    const isPaymentSuccess =
      eventType === 'order.paid' ||
      eventType === 'payment.captured' ||
      eventType === 'payment_intent.succeeded' ||
      eventType === 'checkout.session.completed';

    const isPaymentFailed =
      eventType === 'payment.failed' ||
      eventType === 'payment_intent.payment_failed';

    if (matchedPayment) {
      if (isPaymentSuccess) {
        await prisma.$transaction(async (tx) => {
          // 1. Mark payment COMPLETED
          await tx.paymentTransaction.update({
            where: { id: matchedPayment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              gatewayPaymentId: gatewayPaymentId ?? matchedPayment.gatewayPaymentId,
              reconciliationStatus: ReconciliationStatus.MATCHED,
              paidAt: new Date(),
              gatewayResponse: payload,
            },
          });

          // 2. Update Invoice balance & status
          if (matchedPayment.invoiceId) {
            const invoice = await tx.taxInvoice.findUnique({
              where: { id: matchedPayment.invoiceId },
            });
            if (invoice) {
              const newAmountPaid =
                Number(invoice.amountPaid) + Number(matchedPayment.amount);
              const newBalanceDue = Math.max(
                0,
                Number(invoice.totalAmount) - newAmountPaid
              );
              const newStatus =
                newBalanceDue === 0
                  ? InvoiceStatus.PAID
                  : InvoiceStatus.PARTIALLY_PAID;

              await tx.taxInvoice.update({
                where: { id: invoice.id },
                data: {
                  amountPaid: newAmountPaid,
                  balanceDue: newBalanceDue,
                  status: newStatus,
                },
              });
            }
          }

          // 3. Update WebhookEvent
          await tx.webhookEvent.update({
            where: { id: webhookEvent.id },
            data: {
              status: WebhookEventStatus.PROCESSED,
              paymentTransactionId: matchedPayment.id,
              processedAt: new Date(),
            },
          });
        });

        await this.audit.log({
          tenantId,
          userId: null,
          action: 'WEBHOOK_PAYMENT_COMPLETED',
          resourceType: 'PAYMENT_TRANSACTION',
          resourceId: matchedPayment.id,
          details: {
            provider,
            eventId,
            gatewayOrderId,
            gatewayPaymentId,
          },
        });
      } else if (isPaymentFailed) {
        await prisma.$transaction(async (tx) => {
          await tx.paymentTransaction.update({
            where: { id: matchedPayment.id },
            data: {
              status: PaymentStatus.FAILED,
              reconciliationStatus: ReconciliationStatus.DISCREPANCY,
              gatewayResponse: payload,
            },
          });

          await tx.webhookEvent.update({
            where: { id: webhookEvent.id },
            data: {
              status: WebhookEventStatus.PROCESSED,
              paymentTransactionId: matchedPayment.id,
              processedAt: new Date(),
              errorMessage: 'Payment marked as failed by gateway webhook',
            },
          });
        });
      } else {
        // Ignored or other event
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: WebhookEventStatus.IGNORED,
            processedAt: new Date(),
          },
        });
      }
    } else {
      // No matching payment order found
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          errorMessage: 'No matching payment transaction found for gateway order',
        },
      });
    }

    return {
      received: true,
      processed: true,
      eventId,
      matchedPaymentId: matchedPayment?.id ?? null,
    };
  }

  async getWebhookEvents(tenantId: string, query: WebhookEventQuery) {
    const where: any = { tenantId };
    if (query.provider) where.provider = query.provider;
    if (query.status) where.status = query.status;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.webhookEvent.count({ where }),
      prisma.webhookEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          paymentTransaction: {
            select: {
              id: true,
              receiptNumber: true,
              amount: true,
              status: true,
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

  async reconcilePayment(
    tenantId: string,
    data: ReconcilePaymentInput,
    userId: string
  ) {
    const payment = await prisma.paymentTransaction.findFirst({
      where: { id: data.paymentTransactionId, tenantId },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment transaction ${data.paymentTransactionId} not found`
      );
    }

    const updated = await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        reconciliationStatus: data.reconciliationStatus as ReconciliationStatus,
        gatewayPaymentId: data.gatewayPaymentId ?? payment.gatewayPaymentId,
        notes: data.notes
          ? `${payment.notes ? `${payment.notes} | ` : ''}${data.notes}`
          : payment.notes,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'PAYMENT_RECONCILED',
      resourceType: 'PAYMENT_TRANSACTION',
      resourceId: payment.id,
      details: {
        reconciliationStatus: data.reconciliationStatus,
        gatewayPaymentId: data.gatewayPaymentId,
        previousStatus: payment.reconciliationStatus,
      },
    });

    return updated;
  }

  async getReconciliationList(tenantId: string, query: ReconciliationQuery) {
    const where: any = {
      tenantId,
      gatewayOrderId: { not: null },
    };

    if (query.status) where.reconciliationStatus = query.status;
    if (query.provider) where.gatewayProvider = query.provider;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.paymentTransaction.count({ where }),
      prisma.paymentTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true,
              balanceDue: true,
            },
          },
          student: {
            select: {
              fullName: true,
              mobilePhone: true,
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
}
