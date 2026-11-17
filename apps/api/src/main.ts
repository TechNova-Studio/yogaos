import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { getEnv } from '@yogaos/config';
import { getLogger } from '@yogaos/logger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

const logger = getLogger('Bootstrap');

async function bootstrap() {
  const env = getEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // We use structured @yogaos/logger
    })
  );

  // Security & HTTP Middleware
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'];

  await app.register(fastifyCors, {
    origin: isProduction
      ? (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('CORS origin unauthorized by policy'), false);
          }
        }
      : true,
    credentials: true,
  });

  await app.register(fastifyCookie);

  // Security Headers Hook (Defense-in-Depth)
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onSend', async (request: any, reply: any) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // API Versioning under /v1
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const port = env.API_PORT || 4000;
  await app.listen(port, '0.0.0.0');

  logger.info(`YogaOS API Server running on http://localhost:${port}/v1`);
  logger.info(`Health check available at http://localhost:${port}/v1/health`);
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during API bootstrap');
  process.exit(1);
});
