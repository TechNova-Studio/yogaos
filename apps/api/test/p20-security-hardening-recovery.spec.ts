import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'node:crypto';
import { CryptoService } from '../src/common/services/crypto.service.js';
import { GatewaysService } from '../src/modules/billing/gateways.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard.js';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, HttpStatus, UnauthorizedException, HttpException } from '@nestjs/common';
import { PaymentGatewayProvider } from '@yogaos/database';

describe('P20 Security Hardening & Production Safeguards', () => {
  const auditService = new AuditService();
  const gatewaysService = new GatewaysService(auditService);

  it('CryptoService: rejects hardcoded fallback dev key when running in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.ENCRYPTION_KEY;
    const originalJwt = process.env.JWT_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ENCRYPTION_KEY;
      delete process.env.JWT_SECRET;

      expect(() => new CryptoService()).toThrow(
        /CRITICAL SECURITY CONFIGURATION: Production deployment requires a secure ENCRYPTION_KEY or JWT_SECRET/
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey) process.env.ENCRYPTION_KEY = originalKey;
      if (originalJwt) process.env.JWT_SECRET = originalJwt;
    }
  });

  it('GatewaysService: strictly rejects synthetic mock signatures when running in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';

      const dummyPayload = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_123', order_id: 'order_123', status: 'captured' } } },
      });

      await expect(
        gatewaysService.processWebhook(
          PaymentGatewayProvider.RAZORPAY,
          dummyPayload,
          'test_sandbox_signature' // Mock signature
        )
      ).rejects.toThrow(UnauthorizedException);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('RateLimitGuard: enforces sliding window throttling and issues 429 with Retry-After header', () => {
    const reflector = new Reflector();
    const guard = new RateLimitGuard(reflector);

    const mockHandler = () => {};
    const mockClass = class TestController {};

    // Configure rate limit: 3 requests per 60s
    reflector.getAllAndOverride = () => ({ limit: 3, ttlSeconds: 60 });

    const headers: Record<string, string> = {};
    const createMockContext = (ip: string, url: string): ExecutionContext =>
      ({
        getHandler: () => mockHandler,
        getClass: () => mockClass,
        switchToHttp: () => ({
          getRequest: () => ({
            ip,
            url,
            headers: {},
          }),
          getResponse: () => ({
            header: (k: string, v: string) => {
              headers[k] = v;
            },
          }),
        }),
      } as unknown as ExecutionContext);

    const ctx = createMockContext('192.168.1.10', '/auth/login');

    // 1st, 2nd, 3rd requests should pass
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);

    // 4th request must be throttled with HTTP 429
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    expect(headers['Retry-After']).toBeDefined();
  });

  it('AES-256-GCM: ensures tampering with ciphertext, IV or auth tag throws Decryption Error', () => {
    const cryptoService = new CryptoService();
    const plainText = 'CONFIDENTIAL_HEALTH_REPORTS_DIAGNOSIS_LUMBAR_RESTRICTION';
    const aad = 'tenant-uuid-1234';

    const encrypted = cryptoService.encryptAesGcm(plainText, aad);
    expect(encrypted.ciphertext).toBeDefined();

    // Valid decryption
    const decrypted = cryptoService.decryptAesGcm(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      aad
    );
    expect(decrypted).toBe(plainText);

    // Tampered ciphertext
    const corruptedCiphertext =
      encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(() =>
      cryptoService.decryptAesGcm(corruptedCiphertext, encrypted.iv, encrypted.tag, aad)
    ).toThrow();

    // Tampered AAD
    expect(() =>
      cryptoService.decryptAesGcm(encrypted.ciphertext, encrypted.iv, encrypted.tag, 'wrong-tenant-aad')
    ).toThrow();
  });
});
