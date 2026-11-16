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
  CreateClassTypeRequest,
  CreateClassTypeSchema,
  UpdateClassTypeRequest,
  UpdateClassTypeSchema,
  ClassTypeListQuerySchema,
} from '@yogaos/contracts';
import { ClassTypesService } from './class-types.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('classes/types')
@UseGuards(AuthGuard, RolesGuard)
export class ClassTypesController {
  constructor(private readonly classTypesService: ClassTypesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = ClassTypeListQuerySchema.parse(query);
    const result = await this.classTypesService.getClassTypes(user.activeTenantId, validated);
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
    const classType = await this.classTypesService.getClassType(user.activeTenantId, id);
    return {
      success: true,
      data: classType,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateClassTypeRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateClassTypeSchema.parse(body);
    const created = await this.classTypesService.createClassType(
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
    @Body() body: UpdateClassTypeRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateClassTypeSchema.parse(body);
    const updated = await this.classTypesService.updateClassType(
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
    await this.classTypesService.archiveClassType(user.activeTenantId, id, user.id);
  }
}
