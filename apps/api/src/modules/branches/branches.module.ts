import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller.js';
import { BranchesService } from './branches.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService, CryptoService, AuditService, TenantContextService],
  exports: [BranchesService],
})
export class BranchesModule {}
