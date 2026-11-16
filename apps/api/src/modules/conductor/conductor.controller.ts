import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  InitConductorSessionSchema,
  ConductorActionSchema,
} from '@yogaos/contracts';
import { ConductorService } from './conductor.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('conductor')
@UseGuards(AuthGuard, RolesGuard)
export class ConductorController {
  constructor(private readonly conductorService: ConductorService) {}

  @Post('sessions/init')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async initSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const validated = InitConductorSessionSchema.parse(body);
    const session = await this.conductorService.initSession(
      user.activeTenantId,
      validated,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sessions/:sessionInstanceId')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const session = await this.conductorService.getSession(
      user.activeTenantId,
      sessionInstanceId,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sessions/:sessionInstanceId/action')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async executeAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string,
    @Body() body: unknown
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const validated = ConductorActionSchema.parse(body);
    const session = await this.conductorService.executeAction(
      user.activeTenantId,
      sessionInstanceId,
      validated,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sessions/reconcile-abandoned')
  @RequireRoles('OWNER', 'MANAGER')
  async reconcileAbandoned(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const count = await this.conductorService.checkAbandonedSessions(user.activeTenantId);
    return {
      success: true,
      data: { abandonedCount: count },
      timestamp: new Date().toISOString(),
    };
  }
}
