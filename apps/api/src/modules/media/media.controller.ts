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
  CreateMediaAssetSchema,
  UpdateMediaAssetSchema,
  ReplaceMediaAssetSchema,
  MediaListQuerySchema,
} from '@yogaos/contracts';
import { MediaService } from './media.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('media')
@UseGuards(AuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const validated = MediaListQuerySchema.parse(query);
    const result = await this.mediaService.listMedia(user.activeTenantId ?? null, validated);
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
    const media = await this.mediaService.getMedia(user.activeTenantId ?? null, id);
    return {
      success: true,
      data: media,
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
    const validated = CreateMediaAssetSchema.parse(body);
    const media = await this.mediaService.createMedia(
      user.activeTenantId ?? null,
      validated,
      user.id
    );
    return {
      success: true,
      data: media,
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
    const validated = UpdateMediaAssetSchema.parse(body);
    const media = await this.mediaService.updateMedia(
      user.activeTenantId ?? null,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: media,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id/replace')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const validated = ReplaceMediaAssetSchema.parse(body);
    const media = await this.mediaService.replaceMedia(
      user.activeTenantId ?? null,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: media,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const result = await this.mediaService.archiveMedia(
      user.activeTenantId ?? null,
      id,
      user.id
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
