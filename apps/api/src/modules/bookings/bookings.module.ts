import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { WaitlistService } from './waitlist.service.js';
import { AttendanceService } from './attendance.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { AuditService } from '../../common/services/audit.service.js';
import { TenantContextService } from '../../common/context/tenant-context.js';
import { StudentPlansModule } from '../student-plans/student-plans.module.js';

@Module({
  imports: [StudentPlansModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    WaitlistService,
    AttendanceService,
    CryptoService,
    AuditService,
    TenantContextService,
  ],
  exports: [BookingsService, WaitlistService, AttendanceService],
})
export class BookingsModule {}
