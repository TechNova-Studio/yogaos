import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  CreateOrganizationRequest,
  CreateOrganizationRequestSchema,
  UpdateOrganizationSettingsSchema,
} from '@yogaos/contracts';
import { OrganizationsService } from './organizations.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('organizations')
@UseGuards(AuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrganizationRequest,
    @Req() req: FastifyRequest
  ) {
    const validated = CreateOrganizationRequestSchema.parse(body);
    const result = await this.orgsService.createOrganization(user.id, validated, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async listUserOrganizations(@CurrentUser() user: AuthenticatedUser) {
    const list = await this.orgsService.getUserOrganizations(user.id);
    return {
      success: true,
      data: list,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('current')
  async getCurrentOrganization(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }

    const org = await this.orgsService.getOrganizationById(user.activeTenantId);
    return {
      success: true,
      data: {
        ...org,
        currentUserRole: user.activeRole,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('settings')
  @RequireRoles('OWNER', 'MANAGER')
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }

    const validated = UpdateOrganizationSettingsSchema.parse(body);
    const updated = await this.orgsService.updateOrganizationSettings(
      user.activeTenantId,
      validated,
      user.id
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }
}
