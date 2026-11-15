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
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await app.register(fastifyCookie);

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
