import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CreditLedgerListQuerySchema } from '@yogaos/contracts';
import { CreditLedgerService } from './credit-ledger.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('memberships/credit-ledger')
@UseGuards(AuthGuard, RolesGuard)
export class CreditLedgerController {
  constructor(private readonly creditLedgerService: CreditLedgerService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreditLedgerListQuerySchema.parse(query);
    const entries = await this.creditLedgerService.getLedgerEntries(user.activeTenantId, validated);
    return {
      success: true,
      data: entries,
      timestamp: new Date().toISOString(),
    };
  }
}
