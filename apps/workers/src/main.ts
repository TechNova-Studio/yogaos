import { getLogger } from '@yogaos/logger';
import { RedisService } from './redis.service.js';
import { BillingAutomationWorker } from './billing-automation.worker.js';

const logger = getLogger('WorkerDaemon');

async function startWorkers() {
  logger.info('Initializing YogaOS Background Worker Daemon...');
  const redisService = new RedisService();

  const redisStatus = await redisService.checkHealth();
  logger.info({ redisStatus }, 'Worker Redis connectivity verified');

  const billingWorker = new BillingAutomationWorker();
  logger.info('Registering Billing Automation Worker...');
  // Run an initial check
  await billingWorker.processBillingAutomation();

  logger.info('YogaOS Worker Daemon ready. Listening for queue dispatches.');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker daemon...');
    await redisService.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorkers().catch((err) => {
  logger.error({ err }, 'Fatal error during worker bootstrap');
  process.exit(1);
});
