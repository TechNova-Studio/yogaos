import { Module } from '@nestjs/common';
import { ConductorController } from './conductor.controller.js';
import { ConductorService } from './conductor.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Module({
  controllers: [ConductorController],
  providers: [ConductorService, AuditService],
  exports: [ConductorService],
})
export class ConductorModule {}
