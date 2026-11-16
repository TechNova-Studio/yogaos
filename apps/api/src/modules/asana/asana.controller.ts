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
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateAsanaSchema,
  UpdateAsanaSchema,
  AsanaListQuerySchema,
  AssociateAsanaMediaSchema,
} from '@yogaos/contracts';
import { AsanaService } from './asana.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('asanas')
@UseGuards(AuthGuard, RolesGuard)
export class AsanaController {
  constructor(private readonly asanaService: AsanaService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const validated = AsanaListQuerySchema.parse(query);
    const result = await this.asanaService.getAsanas(user.activeTenantId ?? null, validated);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('seed')
  @RequireRoles('OWNER', 'MANAGER')
  async seedClassicalPoses() {
    const result = await this.asanaService.seedClassicalAsanas();
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR', 'RECEPTIONIST')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const asana = await this.asanaService.getAsana(user.activeTenantId ?? null, id);
    return {
      success: true,
      data: asana,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to create custom postures');
    }
    const validated = CreateAsanaSchema.parse(body);
    const asana = await this.asanaService.createAsana(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: asana,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to update postures');
    }
    const validated = UpdateAsanaSchema.parse(body);
    const asana = await this.asanaService.updateAsana(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: asana,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to archive postures');
    }
    const result = await this.asanaService.archiveAsana(
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

  @Post(':id/media')
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async associateMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to associate media');
    }
    const validated = AssociateAsanaMediaSchema.parse(body);
    const result = await this.asanaService.associateMedia(
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

  @Delete(':id/media/:mediaId')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async removeMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to remove media');
    }
    const result = await this.asanaService.removeMedia(
      user.activeTenantId,
      id,
      mediaId,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
