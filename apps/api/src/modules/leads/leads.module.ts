import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, CryptoService, AuditService, TenantContextService],
  exports: [LeadsService],
})
export class LeadsModule {}
