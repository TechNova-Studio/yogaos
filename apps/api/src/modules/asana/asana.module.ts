import { Module } from '@nestjs/common';
import { AsanaController } from './asana.controller.js';
import { AsanaService } from './asana.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Module({
  controllers: [AsanaController],
  providers: [AsanaService, AuditService],
  exports: [AsanaService],
})
export class AsanaModule {}
