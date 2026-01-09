import { resetAllDailyCounters } from '../services/userService';
import { logJobStart, logJobComplete, logJobFailed } from '../services/jobLogger';
import logger from '../config/logger';

/**
 * Reset daily counters for all users
 * Scheduled to run at midnight (00:00) every day
 *
 * Now logs to database for persistence and visibility
 */
export async function resetDailyCountersJob(): Promise<void> {
  const startTime = Date.now();
  const jobName = 'reset-daily-counters' as const;

  // Log job start to database
  const logId = await logJobStart(jobName);

  try {
    logger.info({ msg: 'Starting daily counter reset job' });

    const resetCount = await resetAllDailyCounters();

    const duration = Date.now() - startTime;

    // Log success to database
    await logJobComplete(logId, jobName, { users_reset: resetCount }, duration);

    logger.info({
      msg: 'Daily counter reset job completed',
      usersReset: resetCount,
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log failure to database
    await logJobFailed(logId, jobName, error, duration);

    logger.error({
      msg: 'Daily counter reset job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    throw error;
  }
}
