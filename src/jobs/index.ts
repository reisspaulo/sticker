import cron from 'node-cron';
import { resetDailyCountersJob } from './resetDailyCounters';
import { sendPendingStickersJob } from './sendPendingStickers';
import logger from '../config/logger';

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduledJobs(): void {
  logger.info({ msg: 'Initializing scheduled jobs' });

  // Reset daily counters at midnight (00:00) every day
  // Cron pattern: '0 0 * * *' = At 00:00 (midnight) every day
  const resetCountersTask = cron.schedule(
    '0 0 * * *',
    async () => {
      logger.info({ msg: 'Running scheduled job: reset-daily-counters' });
      try {
        await resetDailyCountersJob();
      } catch (error) {
        logger.error({
          msg: 'Scheduled job failed: reset-daily-counters',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    {
      timezone: 'America/Sao_Paulo', // Brazil timezone
    }
  );

  // Send pending stickers at 8:00 AM every day
  // Cron pattern: '0 8 * * *' = At 08:00 every day
  const sendPendingTask = cron.schedule(
    '0 8 * * *',
    async () => {
      logger.info({ msg: 'Running scheduled job: send-pending-stickers' });
      try {
        await sendPendingStickersJob();
      } catch (error) {
        logger.error({
          msg: 'Scheduled job failed: send-pending-stickers',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    {
      timezone: 'America/Sao_Paulo', // Brazil timezone
    }
  );

  logger.info({
    msg: 'Scheduled jobs initialized',
    jobs: [
      { name: 'reset-daily-counters', schedule: '0 0 * * *', time: 'Midnight' },
      { name: 'send-pending-stickers', schedule: '0 8 * * *', time: '8:00 AM' },
    ],
    timezone: 'America/Sao_Paulo',
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info({ msg: 'Stopping scheduled jobs' });
    resetCountersTask.stop();
    sendPendingTask.stop();
    logger.info({ msg: 'Scheduled jobs stopped' });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Run a job manually (useful for testing)
 * @param jobName Name of the job to run
 */
export async function runJobManually(jobName: 'reset-counters' | 'send-pending'): Promise<void> {
  logger.info({ msg: 'Running job manually', jobName });

  try {
    switch (jobName) {
      case 'reset-counters':
        await resetDailyCountersJob();
        break;
      case 'send-pending':
        await sendPendingStickersJob();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }

    logger.info({ msg: 'Manual job completed', jobName });
  } catch (error) {
    logger.error({
      msg: 'Manual job failed',
      jobName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
