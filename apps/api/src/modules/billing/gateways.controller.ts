import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  UpsertPaymentGatewayConfigSchema,
  InitiateCheckoutSchema,
  WebhookEventQuerySchema,
  ReconcilePaymentSchema,
  ReconciliationQuerySchema,
} from '@yogaos/contracts';
import { GatewaysService } from './gateways.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('billing/gateways')
@UseGuards(AuthGuard, RolesGuard)
export class GatewaysController {
  constructor(private readonly gatewaysService: GatewaysService) {}

  @Get('configs')
  @RequireRoles('OWNER', 'MANAGER')
  async getConfigs(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const result = await this.gatewaysService.getConfigs(user.activeTenantId);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('configs')
  @RequireRoles('OWNER')
  async upsertConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpsertPaymentGatewayConfigSchema.parse(body);
    const result = await this.gatewaysService.upsertConfig(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('checkout')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async initiateCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = InitiateCheckoutSchema.parse(body);
    const result = await this.gatewaysService.initiateCheckout(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('webhooks')
  @RequireRoles('OWNER', 'MANAGER')
  async getWebhookEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = WebhookEventQuerySchema.parse(query);
    const result = await this.gatewaysService.getWebhookEvents(
      user.activeTenantId,
      validated
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reconcile')
  @RequireRoles('OWNER', 'MANAGER')
  async reconcilePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = ReconcilePaymentSchema.parse(body);
    const result = await this.gatewaysService.reconcilePayment(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('reconciliation')
  @RequireRoles('OWNER', 'MANAGER')
  async getReconciliationList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = ReconciliationQuerySchema.parse(query);
    const result = await this.gatewaysService.getReconciliationList(
      user.activeTenantId,
      validated
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
