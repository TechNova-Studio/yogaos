import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, CryptoService, AuditService, TenantContextService, AuthGuard],
  exports: [AuthService, CryptoService, AuditService, TenantContextService, AuthGuard],
})
export class AuthModule {}
