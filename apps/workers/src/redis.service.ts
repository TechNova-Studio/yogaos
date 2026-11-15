import { Redis } from 'ioredis';
import { getEnv } from '@yogaos/config';
import { getLogger } from '@yogaos/logger';

const logger = getLogger('RedisConnection');

export class RedisService {
  private client: Redis | null = null;

  getConnection(): Redis {
    if (!this.client) {
      const env = getEnv();
      this.client = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        logger.error({ err }, 'Redis connection error in worker daemon');
      });
    }
    return this.client;
  }

  async checkHealth(): Promise<'connected' | 'unreachable'> {
    try {
      const redis = this.getConnection();
      if (redis.status !== 'ready') {
        await redis.connect().catch(() => {});
      }
      const ping = await redis.ping();
      return ping === 'PONG' ? 'connected' : 'unreachable';
    } catch {
      return 'unreachable';
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
