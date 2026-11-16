import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import { GatewaysService } from '../src/modules/billing/gateways.service.js';

describe('Payment Gateway Webhook Verification Unit Tests', () => {
  const mockAudit: any = { logAction: async () => {} };
  const gatewaysService = new GatewaysService(mockAudit);

  describe('Razorpay Signature Verification', () => {
    const webhookSecret = 'test_razorpay_secret_123';
    const payload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_12345',
      event: 'order.paid',
      payload: {
        payment: {
          entity: {
            id: 'pay_123456',
            order_id: 'order_123456',
            amount: 500000,
            status: 'captured',
          },
        },
      },
    });

    it('successfully verifies a valid Razorpay HMAC-SHA256 signature', () => {
      const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const isValid = gatewaysService.verifyRazorpaySignature(
        payload,
        validSignature,
        webhookSecret
      );
      expect(isValid).toBe(true);
    });

    it('rejects an invalid or tampered signature for Razorpay', () => {
      const invalidSignature = 'deadbeef00112233445566778899aabbccddeeff00112233445566778899aabb';
      const isValid = gatewaysService.verifyRazorpaySignature(
        payload,
        invalidSignature,
        webhookSecret
      );
      expect(isValid).toBe(false);
    });

    it('rejects verification if payload was altered after signing', () => {
      const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const tamperedPayload = payload.replace('500000', '100000');
      const isValid = gatewaysService.verifyRazorpaySignature(
        tamperedPayload,
        validSignature,
        webhookSecret
      );
      expect(isValid).toBe(false);
    });
  });

  describe('Stripe Signature & Replay Window Verification', () => {
    const webhookSecret = 'whsec_test_stripe_secret_456';
    const payload = JSON.stringify({
      id: 'evt_test_12345',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_67890',
          amount_total: 450000,
          payment_status: 'paid',
        },
      },
    });

    it('successfully verifies a valid Stripe signature with current timestamp', () => {
      const currentTimestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${currentTimestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const signatureHeader = `t=${currentTimestamp},v1=${signature}`;

      const isValid = gatewaysService.verifyStripeSignature(
        payload,
        signatureHeader,
        webhookSecret
      );
      expect(isValid).toBe(true);
    });

    it('rejects a Stripe signature if the timestamp is older than 300 seconds (replay attack)', () => {
      // 400 seconds ago
      const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const signedPayload = `${staleTimestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const signatureHeader = `t=${staleTimestamp},v1=${signature}`;

      const isValid = gatewaysService.verifyStripeSignature(
        payload,
        signatureHeader,
        webhookSecret
      );
      expect(isValid).toBe(false);
    });

    it('rejects a Stripe signature if timestamp is in the future beyond tolerance', () => {
      // 500 seconds in future
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 500).toString();
      const signedPayload = `${futureTimestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const signatureHeader = `t=${futureTimestamp},v1=${signature}`;

      const isValid = gatewaysService.verifyStripeSignature(
        payload,
        signatureHeader,
        webhookSecret
      );
      expect(isValid).toBe(false);
    });

    it('rejects malformed signature header without timestamp or v1', () => {
      expect(gatewaysService.verifyStripeSignature(payload, 'malformed_header', webhookSecret)).toBe(false);
      expect(gatewaysService.verifyStripeSignature(payload, 't=123456', webhookSecret)).toBe(false);
      expect(gatewaysService.verifyStripeSignature(payload, 'v1=123456', webhookSecret)).toBe(false);
    });
  });
});
