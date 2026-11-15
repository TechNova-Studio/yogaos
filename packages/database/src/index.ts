import { PrismaClient } from '@prisma/client';
import { getEnv } from '@yogaos/config';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const env = getEnv();
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_URL,
        },
      },
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export const prisma = getPrismaClient();
export * from '@prisma/client';
