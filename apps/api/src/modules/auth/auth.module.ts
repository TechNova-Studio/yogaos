import { Module, Global } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    CryptoService,
    AuditService,
    TenantContextService,
    AuthGuard,
    RateLimitGuard,
    RolesGuard,
    Reflector,
  ],
  exports: [
    AuthService,
    CryptoService,
    AuditService,
    TenantContextService,
    AuthGuard,
    RateLimitGuard,
    RolesGuard,
    Reflector,
  ],
})
export class AuthModule {}
