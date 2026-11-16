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
  AssignStudentMembershipRequest,
  AssignStudentMembershipSchema,
  FreezeMembershipRequest,
  FreezeMembershipSchema,
  CancelMembershipRequest,
  CancelMembershipSchema,
  StudentMembershipListQuerySchema,
  ManualCreditAdjustmentRequest,
  ManualCreditAdjustmentSchema,
} from '@yogaos/contracts';
import { StudentMembershipsService } from './student-memberships.service.js';
import { CreditLedgerService } from './credit-ledger.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('memberships/student-memberships')
@UseGuards(AuthGuard, RolesGuard)
export class StudentMembershipsController {
  constructor(
    private readonly membershipsService: StudentMembershipsService,
    private readonly creditLedgerService: CreditLedgerService
  ) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = StudentMembershipListQuerySchema.parse(query);
    const memberships = await this.membershipsService.getMemberships(user.activeTenantId, validated);
    return {
      success: true,
      data: memberships,
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
    const membership = await this.membershipsService.getMembership(user.activeTenantId, id);
    return {
      success: true,
      data: membership,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssignStudentMembershipRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = AssignStudentMembershipSchema.parse(body);
    const membership = await this.membershipsService.assignMembership(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: membership,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/freeze')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async freeze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: FreezeMembershipRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = FreezeMembershipSchema.parse(body);
    const membership = await this.membershipsService.freezeMembership(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: membership,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/unfreeze')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async unfreeze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const membership = await this.membershipsService.unfreezeMembership(
      user.activeTenantId,
      id,
      user.id
    );
    return {
      success: true,
      data: membership,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/cancel')
  @RequireRoles('OWNER', 'MANAGER')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CancelMembershipRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CancelMembershipSchema.parse(body);
    const membership = await this.membershipsService.cancelMembership(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: membership,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/adjust-credits')
  @RequireRoles('OWNER', 'MANAGER')
  async adjustCredits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ManualCreditAdjustmentRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = ManualCreditAdjustmentSchema.parse(body);
    const ledgerEntry = await this.creditLedgerService.manualAdjustment(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: ledgerEntry,
      timestamp: new Date().toISOString(),
    };
  }
}
