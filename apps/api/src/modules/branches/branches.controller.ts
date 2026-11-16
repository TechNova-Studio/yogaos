import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateBranchRequest,
  CreateBranchSchema,
  UpdateBranchRequest,
  UpdateBranchSchema,
} from '@yogaos/contracts';
import { BranchesService } from './branches.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('branches')
@UseGuards(AuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const branches = await this.branchesService.getBranches(user.activeTenantId);
    return {
      success: true,
      data: branches,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const branch = await this.branchesService.getBranch(user.activeTenantId, id);
    return {
      success: true,
      data: branch,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBranchRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateBranchSchema.parse(body);
    const branch = await this.branchesService.createBranch(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: branch,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateBranchRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateBranchSchema.parse(body);
    const updated = await this.branchesService.updateBranch(
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
  @RequireRoles('OWNER')
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    await this.branchesService.deleteBranch(user.activeTenantId, id, user.id);
  }
}
