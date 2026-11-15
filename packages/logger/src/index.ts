import pino from 'pino';
import { getEnv } from '@yogaos/config';

let loggerInstance: pino.Logger | null = null;

export function getLogger(context?: string): pino.Logger {
  if (!loggerInstance) {
    const env = getEnv();
    const isDevelopment = env.NODE_ENV === 'development';

    loggerInstance = pino({
      level: env.LOG_LEVEL,
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
  }

  return context ? loggerInstance.child({ context }) : loggerInstance;
}

export const logger = getLogger();
