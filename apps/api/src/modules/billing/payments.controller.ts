import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  RecordPaymentRequest,
  RecordPaymentSchema,
  PaymentListQuerySchema,
} from '@yogaos/contracts';
import { PaymentsService } from './payments.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('billing/payments')
@UseGuards(AuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = PaymentListQuerySchema.parse(query);
    const payments = await this.paymentsService.getPayments(user.activeTenantId, validated);
    return {
      success: true,
      data: payments,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const payment = await this.paymentsService.getPayment(user.activeTenantId, id);
    return {
      success: true,
      data: payment,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('student/:studentId')
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async getStudentPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId') studentId: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const payments = await this.paymentsService.getStudentPayments(user.activeTenantId, studentId);
    return {
      success: true,
      data: payments,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async record(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordPaymentRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = RecordPaymentSchema.parse(body);
    const payment = await this.paymentsService.recordPayment(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: payment,
      timestamp: new Date().toISOString(),
    };
  }
}
