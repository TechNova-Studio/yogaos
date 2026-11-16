import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { AuditService } from '../../common/services/audit.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, AuditService],
  exports: [MediaService],
})
export class MediaModule {}
