import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { DashboardOperationsQuerySchema } from '@yogaos/contracts';
import { DashboardService } from './dashboard.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('operations')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR', 'RECEPTIONIST')
  async getOperations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }

    const validatedQuery = DashboardOperationsQuerySchema.parse(query);
    const data = await this.dashboardService.getOperationsData(
      user.activeTenantId,
      validatedQuery,
      user
    );

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
