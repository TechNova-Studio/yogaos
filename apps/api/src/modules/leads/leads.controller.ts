import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateLeadRequest,
  CreateLeadSchema,
  UpdateLeadRequest,
  UpdateLeadSchema,
  ConvertLeadRequest,
  ConvertLeadSchema,
  LeadListQuerySchema,
} from '@yogaos/contracts';
import { LeadsService } from './leads.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('leads')
@UseGuards(AuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = LeadListQuerySchema.parse(query);
    const result = await this.leadsService.getLeads(user.activeTenantId, validated);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const lead = await this.leadsService.getLead(user.activeTenantId, id);
    return {
      success: true,
      data: lead,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateLeadRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateLeadSchema.parse(body);
    const lead = await this.leadsService.createLead(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: lead,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLeadRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateLeadSchema.parse(body);
    const updated = await this.leadsService.updateLead(
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

  @Post(':id/convert')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async convert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ConvertLeadRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = ConvertLeadSchema.parse(body);
    const result = await this.leadsService.convertLead(
      user.activeTenantId,
      id,
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
