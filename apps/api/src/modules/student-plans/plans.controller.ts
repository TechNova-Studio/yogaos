import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateMembershipPlanRequest,
  CreateMembershipPlanSchema,
  UpdateMembershipPlanRequest,
  UpdateMembershipPlanSchema,
  MembershipPlanListQuerySchema,
} from '@yogaos/contracts';
import { PlansService } from './plans.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('memberships/plans')
@UseGuards(AuthGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = MembershipPlanListQuerySchema.parse(query);
    const plans = await this.plansService.getPlans(user.activeTenantId, validated);
    return {
      success: true,
      data: plans,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const plan = await this.plansService.getPlan(user.activeTenantId, id);
    return {
      success: true,
      data: plan,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequireRoles('OWNER', 'MANAGER')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateMembershipPlanRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateMembershipPlanSchema.parse(body);
    const plan = await this.plansService.createPlan(user.activeTenantId, validated, user.id);
    return {
      success: true,
      data: plan,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateMembershipPlanRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateMembershipPlanSchema.parse(body);
    const plan = await this.plansService.updatePlan(user.activeTenantId, id, validated, user.id);
    return {
      success: true,
      data: plan,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequireRoles('OWNER', 'MANAGER')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const result = await this.plansService.archivePlan(user.activeTenantId, id, user.id);
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }
}
