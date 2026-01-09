import cron from 'node-cron';
import { resetDailyCountersJob } from './resetDailyCounters';
import { sendPendingStickersJob } from './sendPendingStickers';
import { sendScheduledRemindersJob } from './sendScheduledReminders';
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

  // Send scheduled reminders every 5 minutes
  // Cron pattern: '*/5 * * * *' = Every 5 minutes
  const sendRemindersTask = cron.schedule(
    '*/5 * * * *',
    async () => {
      logger.debug({ msg: 'Running scheduled job: send-scheduled-reminders' });
      try {
        await sendScheduledRemindersJob();
      } catch (error) {
        logger.error({
          msg: 'Scheduled job failed: send-scheduled-reminders',
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
      { name: 'send-scheduled-reminders', schedule: '*/5 * * * *', time: 'Every 5 min' },
    ],
    timezone: 'America/Sao_Paulo',
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info({ msg: 'Stopping scheduled jobs' });
    resetCountersTask.stop();
    sendPendingTask.stop();
    sendRemindersTask.stop();
    logger.info({ msg: 'Scheduled jobs stopped' });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Run a job manually (useful for testing/emergency)
 *
 * ⚠️ WARNING: Only use this for testing in development or emergency situations!
 *
 * - send-pending: Normally runs at 8:00 AM São Paulo time
 *   Running manually outside this time will send stickers to users unexpectedly!
 *
 * - reset-counters: Normally runs at midnight São Paulo time
 *   Running manually will reset all user daily counts immediately!
 *
 * @param jobName Name of the job to run
 * @param options Options for manual execution
 */
export async function runJobManually(
  jobName: 'reset-counters' | 'send-pending',
  options?: { skipTimeWarning?: boolean }
): Promise<void> {
  logger.info({ msg: 'Running job manually', jobName });

  // Time check warning for send-pending job
  if (jobName === 'send-pending' && !options?.skipTimeWarning) {
    const now = new Date();
    const saoPauloTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hour = saoPauloTime.getHours();

    if (hour !== 8) {
      logger.warn({
        msg: '⚠️  WARNING: Running send-pending job outside scheduled time (8:00 AM)!',
        currentHour: hour,
        scheduledHour: 8,
        timezone: 'America/Sao_Paulo',
        warning: 'Users will receive stickers at unexpected time!',
      });

      logger.info({
        msg: 'To bypass this warning, pass { skipTimeWarning: true } option',
      });
    }
  }

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
