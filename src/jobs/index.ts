import cron from 'node-cron';
import { resetDailyCountersJob } from './resetDailyCounters';
import { sendPendingStickersJob } from './sendPendingStickers';
import { sendScheduledRemindersJob } from './sendScheduledReminders';
import { checkWhatsAppConnectionsJob } from './checkWhatsAppConnections';
// REMOVIDO: processSequenceSteps - migrado para campaigns system (process-campaigns job no worker.ts)
import { supabase } from '../config/supabase';
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

  // REMOVIDO: process-sequence-steps - migrado para campaigns system
  // O job process-campaigns roda no worker.ts com BullMQ (60s interval)

  // Check WhatsApp connections every 5 minutes
  // Cron pattern: '*/5 * * * *' = Every 5 minutes
  const checkConnectionsTask = cron.schedule(
    '*/5 * * * *',
    async () => {
      logger.debug({ msg: 'Running scheduled job: check-whatsapp-connections' });
      try {
        await checkWhatsAppConnectionsJob();
      } catch (error) {
        logger.error({
          msg: 'Scheduled job failed: check-whatsapp-connections',
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
      { name: 'check-whatsapp-connections', schedule: '*/5 * * * *', time: 'Every 5 min' },
      // process-campaigns agora roda via BullMQ no worker.ts (60s interval)
    ],
    timezone: 'America/Sao_Paulo',
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info({ msg: 'Stopping scheduled jobs' });
    resetCountersTask.stop();
    sendPendingTask.stop();
    sendRemindersTask.stop();
    checkConnectionsTask.stop();
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

/**
 * Recovery check for pending stickers on server startup
 *
 * This function runs on server initialization to catch any pending stickers
 * that should have been sent at 8:00 AM but weren't (due to deploy/restart).
 *
 * Logic:
 * 1. Only runs if current time is after 8:00 AM (São Paulo timezone)
 * 2. Checks for pending stickers created before 8:00 AM today
 * 3. If found, runs the sendPendingStickersJob to send them
 *
 * This ensures users don't have to wait until the next day if a deploy
 * happens around 8:00 AM and the scheduled job is missed.
 */
export async function checkPendingStickersRecovery(): Promise<void> {
  try {
    // Get current time in São Paulo timezone
    const now = new Date();
    const saoPauloTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentHour = saoPauloTime.getHours();

    // Only run recovery if it's after 8:00 AM
    if (currentHour < 8) {
      logger.info({
        msg: '[RECOVERY] Skipping - before 8:00 AM',
        currentHour,
        timezone: 'America/Sao_Paulo',
      });
      return;
    }

    // Calculate 8:00 AM today in São Paulo timezone
    const today8am = new Date(saoPauloTime);
    today8am.setHours(8, 0, 0, 0);

    // Query for pending stickers created before 8:00 AM today
    const { data: oldPendingStickers, error } = await supabase
      .from('stickers')
      .select('id, user_number, created_at')
      .eq('status', 'pendente')
      .lt('created_at', today8am.toISOString())
      .limit(100);

    if (error) {
      logger.error({
        msg: '[RECOVERY] Error querying pending stickers',
        error: error.message,
      });
      return;
    }

    if (!oldPendingStickers || oldPendingStickers.length === 0) {
      logger.info({
        msg: '[RECOVERY] No old pending stickers found',
        currentHour,
        cutoffTime: today8am.toISOString(),
      });
      return;
    }

    // Found old pending stickers - run recovery
    logger.warn({
      msg: '[RECOVERY] Found old pending stickers - running recovery job',
      count: oldPendingStickers.length,
      oldestCreatedAt: oldPendingStickers[oldPendingStickers.length - 1]?.created_at,
      newestCreatedAt: oldPendingStickers[0]?.created_at,
      cutoffTime: today8am.toISOString(),
    });

    // Run the pending stickers job
    const result = await sendPendingStickersJob();

    logger.info({
      msg: '[RECOVERY] Recovery job completed',
      result,
    });
  } catch (error) {
    logger.error({
      msg: '[RECOVERY] Recovery check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - recovery failure shouldn't prevent server startup
  }
}
