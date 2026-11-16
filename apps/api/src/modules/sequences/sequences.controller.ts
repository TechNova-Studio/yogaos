import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
  CreateSequenceSchema,
  UpdateSequenceSchema,
  SequenceListQuerySchema,
  ReorderSequenceStepsSchema,
  PublishSequenceSchema,
} from '@yogaos/contracts';
import { SequencesService } from './sequences.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('sequences')
@UseGuards(AuthGuard, RolesGuard)
export class SequencesController {
  constructor(private readonly sequencesService: SequencesService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to list sequences');
    }
    const validated = SequenceListQuerySchema.parse(query);
    const result = await this.sequencesService.listSequences(user.activeTenantId, validated);
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
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to get sequence');
    }
    const sequence = await this.sequencesService.getSequence(user.activeTenantId, id);
    return {
      success: true,
      data: sequence,
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
      throw new BadRequestException('Organization context is required to create sequence');
    }
    const validated = CreateSequenceSchema.parse(body);
    const sequence = await this.sequencesService.createSequence(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: sequence,
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
      throw new BadRequestException('Organization context is required to update sequence');
    }
    const validated = UpdateSequenceSchema.parse(body);
    const sequence = await this.sequencesService.updateSequence(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: sequence,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to duplicate sequence');
    }
    const duplicated = await this.sequencesService.duplicateSequence(
      user.activeTenantId,
      id,
      user.id
    );
    return {
      success: true,
      data: duplicated,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/publish')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to publish sequence');
    }
    const validated = PublishSequenceSchema.parse(body ?? {});
    const published = await this.sequencesService.publishSequence(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: published,
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
      throw new BadRequestException('Organization context is required to archive sequence');
    }
    const result = await this.sequencesService.archiveSequence(
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

  @Put(':id/steps/reorder')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async reorderSteps(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('Organization context is required to reorder sequence steps');
    }
    const validated = ReorderSequenceStepsSchema.parse(body);
    const result = await this.sequencesService.reorderSteps(
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
