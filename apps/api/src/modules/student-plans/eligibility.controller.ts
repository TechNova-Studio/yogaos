import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CheckBookingEligibilityQuerySchema } from '@yogaos/contracts';
import { EligibilityService } from './eligibility.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequireRoles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('memberships/eligibility')
@UseGuards(AuthGuard, RolesGuard)
export class EligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @Get()
  @RequireRoles('OWNER', 'MANAGER', 'RECEPTIONIST', 'INSTRUCTOR')
  async checkEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    if (!user.activeTenantId) {
      throw new BadRequestException('No active organization context selected');
    }
    const validated = CheckBookingEligibilityQuerySchema.parse(query);
    const result = await this.eligibilityService.checkEligibility(
      user.activeTenantId,
      validated.studentId,
      validated.sessionInstanceId
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
