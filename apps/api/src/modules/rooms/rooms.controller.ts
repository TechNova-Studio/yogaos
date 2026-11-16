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
  CreateRoomRequest,
  CreateRoomSchema,
  UpdateRoomRequest,
  UpdateRoomSchema,
} from '@yogaos/contracts';
import { RoomsService } from './rooms.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('rooms')
@UseGuards(AuthGuard, RolesGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const rooms = await this.roomsService.getRooms(user.activeTenantId, branchId);
    return {
      success: true,
      data: rooms,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const room = await this.roomsService.getRoom(user.activeTenantId, id);
    return {
      success: true,
      data: room,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRoomRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateRoomSchema.parse(body);
    const room = await this.roomsService.createRoom(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: room,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRoomRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateRoomSchema.parse(body);
    const updated = await this.roomsService.updateRoom(
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
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    await this.roomsService.deleteRoom(user.activeTenantId, id, user.id);
  }
}
