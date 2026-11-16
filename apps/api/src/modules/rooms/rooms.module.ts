import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, CryptoService, AuditService, TenantContextService],
  exports: [RoomsService],
})
export class RoomsModule {}
