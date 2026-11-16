import { Module } from '@nestjs/common';
import { ClassTypesController } from './class-types.controller.js';
import { ClassTypesService } from './class-types.service.js';
import { BatchesController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { ConflictValidationService } from './conflict-validation.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';

@Module({
  controllers: [ClassTypesController, BatchesController, SessionsController],
  providers: [
    ClassTypesService,
    BatchesService,
    SessionsService,
    ConflictValidationService,
    CryptoService,
    AuditService,
    TenantContextService,
  ],
  exports: [ClassTypesService, BatchesService, SessionsService, ConflictValidationService],
})
export class ClassesModule {}
