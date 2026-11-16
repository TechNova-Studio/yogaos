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
  UpcomingRenewalsQuerySchema,
  RenewMembershipSchema,
} from '@yogaos/contracts';
import { RenewalsService } from './renewals.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('billing/renewals')
@UseGuards(AuthGuard, RolesGuard)
export class RenewalsController {
  constructor(private readonly renewalsService: RenewalsService) {}

  @Get('upcoming')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async getUpcomingRenewals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpcomingRenewalsQuerySchema.parse(query);
    const result = await this.renewalsService.getUpcomingRenewals(
      user.activeTenantId,
      validated
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async renewMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = RenewMembershipSchema.parse(body);
    const result = await this.renewalsService.renewMembership(
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
}
