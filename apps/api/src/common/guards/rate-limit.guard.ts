import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest, FastifyReply } from 'fastify';

export const RATE_LIMIT_KEY = 'RATE_LIMIT_CONFIG';

export interface RateLimitConfig {
  limit: number;
  ttlSeconds: number;
}

export const RateLimit = (limit = 15, ttlSeconds = 60) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, ttlSeconds });

interface ClientRecord {
  timestamps: number[];
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly clients = new Map<string, ClientRecord>();
  private readonly reflector: Reflector;

  constructor(reflector?: Reflector) {
    this.reflector = reflector || new Reflector();
  }

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.getAllAndOverride<RateLimitConfig | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()]
    );

    // If no @RateLimit decorator present on route or controller, allow
    if (!config) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const res = http.getResponse<FastifyReply>();

    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-client';
    const clientKey = `${typeof ip === 'string' ? ip : ip[0]}:${req.url}`;
    const now = Date.now();
    const windowStart = now - config.ttlSeconds * 1000;

    let record = this.clients.get(clientKey);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(clientKey, record);
    }

    // Filter out timestamps outside current sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= config.limit) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.ceil((oldest + config.ttlSeconds * 1000 - now) / 1000);
      res.header('Retry-After', String(Math.max(1, retryAfterSeconds)));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many authentication attempts. Please try again later.',
          retryAfter: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    record.timestamps.push(now);

    // Periodic cleanup of stale client keys (every 50 requests)
    if (this.clients.size > 2000) {
      for (const [k, v] of this.clients.entries()) {
        v.timestamps = v.timestamps.filter((ts) => ts > windowStart);
        if (v.timestamps.length === 0) {
          this.clients.delete(k);
        }
      }
    }

    return true;
  }
}
