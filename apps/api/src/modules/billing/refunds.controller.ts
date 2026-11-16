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
  ProcessRefundSchema,
  RefundListQuerySchema,
} from '@yogaos/contracts';
import { RefundsService } from './refunds.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('billing/refunds')
@UseGuards(AuthGuard, RolesGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @RequireRoles('OWNER', 'MANAGER')
  async processRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = ProcessRefundSchema.parse(body);
    const refund = await this.refundsService.processRefund(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: refund,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = RefundListQuerySchema.parse(query);
    const refunds = await this.refundsService.getRefunds(user.activeTenantId, validated);
    return {
      success: true,
      data: refunds,
      timestamp: new Date().toISOString(),
    };
  }
}
