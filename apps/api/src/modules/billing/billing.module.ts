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
import { RenewalsController } from './renewals.controller.js';
import { RenewalsService } from './renewals.service.js';
import { RemindersController } from './reminders.controller.js';
import { RemindersService } from './reminders.service.js';
import { GatewaysController } from './gateways.controller.js';
import { GatewaysService } from './gateways.service.js';
import { WebhooksController } from './webhooks.controller.js';
import { StudentPlansModule } from '../student-plans/student-plans.module.js';
import { AuditService } from '../../common/services/audit.service.js';

@Module({
  imports: [StudentPlansModule],
  controllers: [
    InvoicesController,
    PaymentsController,
    RefundsController,
    BillingCommonController,
    RenewalsController,
    RemindersController,
    GatewaysController,
    WebhooksController,
  ],
  providers: [
    InvoicesService,
    PaymentsService,
    RefundsService,
    TaxSettingsService,
    CollectionsSummaryService,
    NumberingService,
    RenewalsService,
    RemindersService,
    GatewaysService,
    AuditService,
  ],
  exports: [
    InvoicesService,
    PaymentsService,
    RefundsService,
    TaxSettingsService,
    CollectionsSummaryService,
    NumberingService,
    RenewalsService,
    RemindersService,
    GatewaysService,
  ],
})
export class BillingModule {}
