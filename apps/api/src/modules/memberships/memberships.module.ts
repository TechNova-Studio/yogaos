import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
