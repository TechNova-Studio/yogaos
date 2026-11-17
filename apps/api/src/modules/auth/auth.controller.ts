import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  RegisterRequest,
  RegisterRequestSchema,
  LoginRequest,
  LoginRequestSchema,
  SwitchTenantRequest,
  SwitchTenantRequestSchema,
} from '@yogaos/contracts';
import { AuthService } from './auth.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { RateLimitGuard, RateLimit } from '../../common/guards/rate-limit.guard.js';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('auth')
@UseGuards(RateLimitGuard)
@RateLimit(30, 60)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: RegisterRequest,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply
  ) {
    const validated = RegisterRequestSchema.parse(body);
    const result = await this.authService.register(validated, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.setCookie('yogaos_session', result.token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequest,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply
  ) {
    const validated = LoginRequestSchema.parse(body);
    const result = await this.authService.login(validated, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.setCookie('yogaos_session', result.token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply
  ) {
    const authHeader = req.headers['authorization'];
    const sessionToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.['yogaos_session'];

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }

    res.clearCookie('yogaos_session', { path: '/' });

    return {
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.authService.getProfile(user.id);
    return {
      success: true,
      data: {
        ...profile,
        activeTenantId: user.activeTenantId,
        activeRole: user.activeRole,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('switch-tenant')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async switchTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SwitchTenantRequest,
    @Req() req: FastifyRequest
  ) {
    const validated = SwitchTenantRequestSchema.parse(body);
    const result = await this.authService.switchTenant(
      user.id,
      user.sessionId,
      validated.tenantId,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
