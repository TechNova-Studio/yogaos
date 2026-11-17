import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateBillingReminderSchema,
  BillingReminderQuerySchema,
} from '@yogaos/contracts';
import { RemindersService } from './reminders.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('billing/reminders')
@UseGuards(AuthGuard, RolesGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = BillingReminderQuerySchema.parse(query);
    const result = await this.remindersService.getReminders(
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
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateBillingReminderSchema.parse(body);
    const result = await this.remindersService.createReminder(
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

  @Post(':id/dispatch')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async dispatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const result = await this.remindersService.dispatchReminder(
      user.activeTenantId,
      id,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/retry')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const result = await this.remindersService.retryReminder(
      user.activeTenantId,
      id,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('scan')
  @RequireRoles('OWNER', 'MANAGER')
  async triggerScan(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const result = await this.remindersService.scanAndGenerateReminders(
      user.activeTenantId
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
