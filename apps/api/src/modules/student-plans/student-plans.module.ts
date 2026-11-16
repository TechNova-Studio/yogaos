import { Module } from '@nestjs/common';
import { PlansService } from './plans.service.js';
import { PlansController } from './plans.controller.js';
import { StudentMembershipsService } from './student-memberships.service.js';
import { StudentMembershipsController } from './student-memberships.controller.js';
import { CreditLedgerService } from './credit-ledger.service.js';
import { CreditLedgerController } from './credit-ledger.controller.js';
import { EligibilityService } from './eligibility.service.js';
import { EligibilityController } from './eligibility.controller.js';
import { AuditService } from '../../common/services/audit.service.js';

@Module({
  controllers: [
    PlansController,
    StudentMembershipsController,
    CreditLedgerController,
    EligibilityController,
  ],
  providers: [
    PlansService,
    StudentMembershipsService,
    CreditLedgerService,
    EligibilityService,
    AuditService,
  ],
  exports: [
    PlansService,
    StudentMembershipsService,
    CreditLedgerService,
    EligibilityService,
  ],
})
export class StudentPlansModule {}
