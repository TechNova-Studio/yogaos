import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  InitConductorSessionSchema,
  ConductorActionSchema,
  PrepareConductorSessionSchema,
  ConductorBatchSyncSchema,
  ConductorRecoverSessionSchema,
  ConductorSessionHistoryFilterSchema,
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

  @Get('sessions/:sessionInstanceId/media-manifest')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async getMediaManifest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const manifest = await this.conductorService.getMediaManifest(
      user.activeTenantId,
      sessionInstanceId,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: manifest,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sessions/:sessionInstanceId/prepare')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async submitPreparation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string,
    @Body() body: unknown
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const validated = PrepareConductorSessionSchema.parse(body);
    const session = await this.conductorService.submitPreparation(
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

  @Post('sessions/:sessionInstanceId/events/sync')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async syncEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string,
    @Body() body: unknown
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const validated = ConductorBatchSyncSchema.parse(body);
    const result = await this.conductorService.syncEvents(
      user.activeTenantId,
      sessionInstanceId,
      validated,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sessions/:sessionInstanceId/recovery')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async getRecoveryState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const recovery = await this.conductorService.getRecoveryState(
      user.activeTenantId,
      sessionInstanceId,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: recovery,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sessions/:sessionInstanceId/recover')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async recoverSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string,
    @Body() body: unknown
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const validated = ConductorRecoverSessionSchema.parse(body);
    const session = await this.conductorService.recoverSession(
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

  @Get('history')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async getSessionHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const validated = ConductorSessionHistoryFilterSchema.parse(query);
    const history = await this.conductorService.getSessionHistory(
      user.activeTenantId,
      validated,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: history,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sessions/:sessionInstanceId/events')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async getSessionEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionInstanceId') sessionInstanceId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const events = await this.conductorService.getSessionEvents(
      user.activeTenantId,
      sessionInstanceId,
      user.id,
      user.activeRole!
    );
    return {
      success: true,
      data: events,
      timestamp: new Date().toISOString(),
    };
  }
}
