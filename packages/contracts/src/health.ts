import { z } from 'zod';

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  version: z.string(),
  uptime: z.number(),
  timestamp: z.string(),
  services: z.object({
    database: z.enum(['connected', 'disconnected', 'unreachable']),
    redis: z.enum(['connected', 'disconnected', 'unreachable']),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
