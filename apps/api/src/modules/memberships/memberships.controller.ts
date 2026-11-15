import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  InviteMemberRequest,
  InviteMemberRequestSchema,
  AcceptInviteRequest,
  AcceptInviteRequestSchema,
  UpdateMemberStatusRequest,
  UpdateMemberStatusRequestSchema,
} from '@yogaos/contracts';
import { UserRole } from '@yogaos/database';
import { MembershipsService } from './memberships.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('organizations/members')
@UseGuards(AuthGuard, RolesGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async getMembers(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Active organization context required');
    }
    const members = await this.membershipsService.getMembers(user.activeTenantId);
    return {
      success: true,
      data: members,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('invite')
  @RequireRoles(UserRole.OWNER, UserRole.MANAGER)
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InviteMemberRequest,
    @Req() req: FastifyRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Active organization context required');
    }
    const validated = InviteMemberRequestSchema.parse(body);
    const result = await this.membershipsService.inviteMember(
      user.activeTenantId,
      user.id,
      validated,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('accept-invite')
  async acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AcceptInviteRequest,
    @Req() req: FastifyRequest
  ) {
    const validated = AcceptInviteRequestSchema.parse(body);
    const result = await this.membershipsService.acceptInvitation(user.id, validated.token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles(UserRole.OWNER, UserRole.MANAGER)
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') memberId: string,
    @Body() body: UpdateMemberStatusRequest,
    @Req() req: FastifyRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Active organization context required');
    }
    const validated = UpdateMemberStatusRequestSchema.parse(body);
    await this.membershipsService.updateMemberStatus(
      user.activeTenantId,
      memberId,
      user.id,
      validated,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    return {
      success: true,
      message: 'Member status updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequireRoles(UserRole.OWNER)
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') memberId: string,
    @Req() req: FastifyRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Active organization context required');
    }
    await this.membershipsService.removeMember(user.activeTenantId, memberId, user.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Member removed from organization',
      timestamp: new Date().toISOString(),
    };
  }
}
