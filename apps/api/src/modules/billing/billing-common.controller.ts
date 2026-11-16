import {
  Controller,
  Get,
  Patch,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  UpdateOrganizationTaxSettingsSchema,
} from '@yogaos/contracts';
import { TaxSettingsService } from './tax-settings.service.js';
import { CollectionsSummaryService } from './collections-summary.service.js';
import { RefundsService } from './refunds.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('billing')
@UseGuards(AuthGuard, RolesGuard)
export class BillingCommonController {
  constructor(
    private readonly taxSettingsService: TaxSettingsService,
    private readonly collectionsSummaryService: CollectionsSummaryService,
    private readonly refundsService: RefundsService
  ) {}

  @Get('credit-notes')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async getCreditNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('invoiceId') invoiceId?: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const notes = await this.refundsService.getCreditNotes(user.activeTenantId, invoiceId);
    return {
      success: true,
      data: notes,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('settings/tax')
  @RequireRoles('OWNER', 'MANAGER')
  async getTaxSettings(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const settings = await this.taxSettingsService.getTaxSettings(user.activeTenantId);
    return {
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('settings/tax')
  @RequireRoles('OWNER', 'MANAGER')
  async updateTaxSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateOrganizationTaxSettingsSchema.parse(body);
    const updated = await this.taxSettingsService.updateTaxSettings(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('summary/daily')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async getDailySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const summary = await this.collectionsSummaryService.getDailySummary(user.activeTenantId, date);
    return {
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    };
  }
}
