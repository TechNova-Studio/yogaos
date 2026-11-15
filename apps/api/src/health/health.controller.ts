import { Controller, Get } from '@nestjs/common';
import { prisma } from '@yogaos/database';
import { HealthCheckResponse } from '@yogaos/contracts';

@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<HealthCheckResponse> {
    let dbStatus: 'connected' | 'disconnected' | 'unreachable' = 'disconnected';

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'unreachable';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: 'unreachable', // In P06 baseline, redis worker connects in apps/workers
      },
    };
  }
}
