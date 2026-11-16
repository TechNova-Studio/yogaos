import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  SessionCalendarQuerySchema,
  UpdateSessionInstanceRequest,
  UpdateSessionInstanceSchema,
  CancelSessionInstanceRequest,
  CancelSessionInstanceSchema,
} from '@yogaos/contracts';
import { SessionsService } from './sessions.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('classes/sessions')
@UseGuards(AuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('instructors')
  async listInstructors(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const instructors = await this.sessionsService.getInstructors(user.activeTenantId);
    return {
      success: true,
      data: instructors,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = SessionCalendarQuerySchema.parse(query);
    const sessions = await this.sessionsService.getSessions(user.activeTenantId, validated);
    return {
      success: true,
      data: sessions,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const session = await this.sessionsService.getSession(user.activeTenantId, id);
    return {
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async updateSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateSessionInstanceRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateSessionInstanceSchema.parse(body);
    const updated = await this.sessionsService.updateSession(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async cancelSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CancelSessionInstanceRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CancelSessionInstanceSchema.parse(body);
    const cancelled = await this.sessionsService.cancelSession(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: cancelled,
      timestamp: new Date().toISOString(),
    };
  }
}
