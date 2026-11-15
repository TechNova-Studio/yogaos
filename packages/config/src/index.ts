import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PORT: z.coerce.number().default(4000),
  WEB_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default('postgresql://yogaos:yogaos_secret@localhost:5432/yogaos_dev?schema=public'),
  POSTGRES_USER: z.string().default('yogaos'),
  POSTGRES_PASSWORD: z.string().default('yogaos_secret'),
  POSTGRES_DB: z.string().default('yogaos_dev'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  JWT_SECRET: z.string().min(16).default('super_secret_dev_jwt_key_32_characters_minimum_length_required!'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:4000/v1'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

export function getEnv(): Env {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
      throw new Error('Environment variable validation failed');
    }
    parsedEnv = result.data;
  }
  return parsedEnv;
}
