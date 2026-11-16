import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, CryptoService, AuditService, TenantContextService],
  exports: [StudentsService],
})
export class StudentsModule {}
