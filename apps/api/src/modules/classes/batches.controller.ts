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
  CreateBatchRequest,
  CreateBatchSchema,
  UpdateBatchRequest,
  UpdateBatchSchema,
  BatchListQuerySchema,
  GenerateSessionsRequest,
  GenerateSessionsSchema,
} from '@yogaos/contracts';
import { BatchesService } from './batches.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('classes/batches')
@UseGuards(AuthGuard, RolesGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = BatchListQuerySchema.parse(query);
    const result = await this.batchesService.getBatches(user.activeTenantId, validated);
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
    const batch = await this.batchesService.getBatch(user.activeTenantId, id);
    return {
      success: true,
      data: batch,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBatchRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateBatchSchema.parse(body);
    const created = await this.batchesService.createBatch(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateBatchRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateBatchSchema.parse(body);
    const updated = await this.batchesService.updateBatch(
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('OWNER', 'MANAGER')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    await this.batchesService.archiveBatch(user.activeTenantId, id, user.id);
  }

  @Post(':id/generate-sessions')
  @RequireRoles('OWNER', 'MANAGER')
  async generateSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: GenerateSessionsRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = GenerateSessionsSchema.parse({ ...body, batchId: id });
    const result = await this.batchesService.generateSessions(
      user.activeTenantId,
      id,
      validated.upToDate,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
