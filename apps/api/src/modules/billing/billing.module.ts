import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { RefundsController } from './refunds.controller.js';
import { RefundsService } from './refunds.service.js';
import { BillingCommonController } from './billing-common.controller.js';
import { TaxSettingsService } from './tax-settings.service.js';
import { CollectionsSummaryService } from './collections-summary.service.js';
import { NumberingService } from './numbering.service.js';
import { StudentPlansModule } from '../student-plans/student-plans.module.js';
import { AuditService } from '../../common/services/audit.service.js';

@Module({
  imports: [StudentPlansModule],
  controllers: [
    InvoicesController,
    PaymentsController,
    RefundsController,
    BillingCommonController,
  ],
  providers: [
    InvoicesService,
    PaymentsService,
    RefundsService,
    TaxSettingsService,
    CollectionsSummaryService,
    NumberingService,
    AuditService,
  ],
  exports: [
    InvoicesService,
    PaymentsService,
    RefundsService,
    TaxSettingsService,
    CollectionsSummaryService,
    NumberingService,
  ],
})
export class BillingModule {}
