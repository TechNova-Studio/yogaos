import { Module } from '@nestjs/common';
import { SequencesController } from './sequences.controller.js';
import { SequencesService } from './sequences.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Module({
  controllers: [SequencesController],
  providers: [SequencesService, AuditService],
  exports: [SequencesService],
})
export class SequencesModule {}
