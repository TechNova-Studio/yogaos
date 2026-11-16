import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  CreateStudentRequest,
  CreateStudentSchema,
  UpdateStudentRequest,
  UpdateStudentSchema,
  StudentListQuerySchema,
  StudentHealthDisclaimerInput,
  StudentHealthDisclaimerInputSchema,
  StudentConsentInput,
  StudentConsentInputSchema,
  CreateStudentNoteRequest,
  CreateStudentNoteSchema,
} from '@yogaos/contracts';
import { StudentsService } from './students.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = StudentListQuerySchema.parse(query);
    const result = await this.studentsService.getStudents(user.activeTenantId, validated);
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
    const student = await this.studentsService.getStudent(
      user.activeTenantId,
      id,
      user.activeRole || 'RECEPTIONIST',
      user.id
    );
    return {
      success: true,
      data: student,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateStudentRequest,
    @Req() req: FastifyRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateStudentSchema.parse(body);
    const student = await this.studentsService.createStudent(
      user.activeTenantId,
      validated,
      user.id,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return {
      success: true,
      data: student,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateStudentRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = UpdateStudentSchema.parse(body);
    const updated = await this.studentsService.updateStudent(
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

  @Post(':id/health')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR')
  async updateHealth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: StudentHealthDisclaimerInput,
    @Req() req: FastifyRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = StudentHealthDisclaimerInputSchema.parse(body);
    await this.studentsService.updateStudentHealth(
      user.activeTenantId,
      id,
      validated,
      user.id,
      { ip: req.ip }
    );
    return {
      success: true,
      message: 'Student health disclaimer updated and encrypted at rest',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/consent')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: StudentConsentInput,
    @Req() req: FastifyRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = StudentConsentInputSchema.parse(body);
    await this.studentsService.recordStudentConsent(
      user.activeTenantId,
      id,
      validated,
      user.id,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return {
      success: true,
      message: 'Student consent recorded',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/timeline')
  async getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const timeline = await this.studentsService.getStudentTimeline(user.activeTenantId, id);
    return {
      success: true,
      data: timeline,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/notes')
  @RequireRoles('OWNER', 'MANAGER', 'INSTRUCTOR', 'RECEPTIONIST')
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateStudentNoteRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateStudentNoteSchema.parse(body);
    const activity = await this.studentsService.addStudentNote(
      user.activeTenantId,
      id,
      validated,
      user.id
    );
    return {
      success: true,
      data: activity,
      timestamp: new Date().toISOString(),
    };
  }
}
