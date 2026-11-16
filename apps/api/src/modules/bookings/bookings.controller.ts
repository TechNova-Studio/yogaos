import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateBookingRequest,
  CreateBookingSchema,
  CancelBookingRequest,
  CancelBookingSchema,
  BookingListQuerySchema,
  JoinWaitlistRequest,
  JoinWaitlistSchema,
  MarkAttendanceRequest,
  MarkAttendanceSchema,
} from '@yogaos/contracts';
import { BookingsService } from './bookings.service.js';
import { WaitlistService } from './waitlist.service.js';
import { AttendanceService } from './attendance.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('bookings')
@UseGuards(AuthGuard, RolesGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly waitlistService: WaitlistService,
    private readonly attendanceService: AttendanceService
  ) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = BookingListQuerySchema.parse(query);
    const result = await this.bookingsService.getBookings(user.activeTenantId, validated);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('student/:studentId')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async getStudentBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId') studentId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const bookings = await this.bookingsService.getStudentBookings(user.activeTenantId, studentId);
    return {
      success: true,
      data: bookings,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('roster/:sessionId')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async getSessionRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const roster = await this.attendanceService.getSessionRoster(user.activeTenantId, sessionId);
    return {
      success: true,
      data: roster,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const booking = await this.bookingsService.getBooking(user.activeTenantId, id);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBookingRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateBookingSchema.parse(body);
    const created = await this.bookingsService.createBooking(
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

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CancelBookingRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CancelBookingSchema.parse(body || {});
    const cancelled = await this.bookingsService.cancelBooking(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: cancelled,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('waitlist')
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async joinWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: JoinWaitlistRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = JoinWaitlistSchema.parse(body);
    const entry = await this.waitlistService.joinWaitlist(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: entry,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('waitlist/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async cancelWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    await this.waitlistService.cancelWaitlist(user.activeTenantId, id, user.id);
  }

  @Post('waitlist/:id/promote')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async promoteWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const booking = await this.waitlistService.promoteWaitlistEntry(
      user.activeTenantId,
      id,
      user.id
    );
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/attendance')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async markAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: MarkAttendanceRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = MarkAttendanceSchema.parse(body);
    const result = await this.attendanceService.markAttendance(
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
