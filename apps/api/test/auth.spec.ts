import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoService } from '../src/common/services/crypto.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AuditService } from '../src/common/services/audit.service.js';
import { UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@yogaos/database';

describe('Authentication & Identity Domain', () => {
  let cryptoService: CryptoService;
  let auditService: AuditService;
  let authService: AuthService;

  beforeEach(() => {
    cryptoService = new CryptoService();
    auditService = new AuditService();
    // Spy on audit.log to prevent database errors during mock/unit test runs
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);
    authService = new AuthService(cryptoService, auditService);
  });

  describe('CryptoService', () => {
    it('should securely hash passwords and verify matching passwords', async () => {
      const password = 'StrongPassword123!';
      const hash = await cryptoService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

      const isMatch = await cryptoService.comparePassword(password, hash);
      expect(isMatch).toBe(true);

      const isWrongMatch = await cryptoService.comparePassword('WrongPassword', hash);
      expect(isWrongMatch).toBe(false);
    });

    it('should generate cryptographically secure random session tokens and sha256 hashes', () => {
      const token1 = cryptoService.generateRandomToken();
      const token2 = cryptoService.generateRandomToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes hex = 64 chars

      const hash1 = cryptoService.hashToken(token1);
      const hash2 = cryptoService.hashToken(token1);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex
    });
  });

  describe('AuthService Logic & Invariants', () => {
    it('should reject registration if email already exists', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'existing-uuid',
        email: 'teacher@studio.in',
      } as any);

      await expect(
        authService.register({
          email: 'teacher@studio.in',
          password: 'Password123!',
          fullName: 'Vikram Joshi',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should reject login if user is not found', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@studio.in',
          password: 'Password123!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login if password does not match', async () => {
      const passwordHash = await cryptoService.hashPassword('CorrectPassword123');

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid',
        email: 'teacher@studio.in',
        credentials: [
          {
            type: 'PASSWORD',
            secretHash: passwordHash,
          },
        ],
        memberships: [],
      } as any);

      await expect(
        authService.login({
          email: 'teacher@studio.in',
          password: 'WrongPassword',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login if user account has been deactivated (deletedAt is set)', async () => {
      const passwordHash = await cryptoService.hashPassword('CorrectPassword123');

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid',
        email: 'deactivated@studio.in',
        deletedAt: new Date(),
        credentials: [
          {
            type: 'PASSWORD',
            secretHash: passwordHash,
          },
        ],
        memberships: [],
      } as any);

      await expect(
        authService.login({
          email: 'deactivated@studio.in',
          password: 'CorrectPassword123',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke session on logout', async () => {
      const token = cryptoService.generateRandomToken();
      const tokenHash = cryptoService.hashToken(token);

      const findSessionSpy = vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
        id: 'session-uuid',
        userId: 'user-uuid',
        tokenHash,
        activeTenantId: 'tenant-uuid',
      } as any);

      const updateSessionSpy = vi.spyOn(prisma.session, 'update').mockResolvedValue({} as any);

      await authService.logout(token);

      expect(findSessionSpy).toHaveBeenCalled();
      expect(updateSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-uuid' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        })
      );
    });
  });
});
