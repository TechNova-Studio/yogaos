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
  CreateInvoiceRequest,
  CreateInvoiceSchema,
  InvoiceListQuerySchema,
} from '@yogaos/contracts';
import { InvoicesService } from './invoices.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('billing/invoices')
@UseGuards(AuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = InvoiceListQuerySchema.parse(query);
    const invoices = await this.invoicesService.getInvoices(user.activeTenantId, validated);
    return {
      success: true,
      data: invoices,
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
    const invoice = await this.invoicesService.getInvoice(user.activeTenantId, id);
    return {
      success: true,
      data: invoice,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInvoiceRequest
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CreateInvoiceSchema.parse(body);
    const invoice = await this.invoicesService.createInvoice(
      user.activeTenantId,
      validated,
      user.id
    );
    return {
      success: true,
      data: invoice,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/void')
  @RequireRoles('OWNER', 'MANAGER')
  async void(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('reason') reason: string
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reason of at least 3 characters is required to void an invoice');
    }
    const invoice = await this.invoicesService.voidInvoice(
      user.activeTenantId,
      id,
      reason.trim(),
      user.id
    );
    return {
      success: true,
      data: invoice,
      timestamp: new Date().toISOString(),
    };
  }
}
