import { resetAllDailyCounters } from '../services/userService';
import logger from '../config/logger';

/**
 * Reset daily counters for all users
 * Scheduled to run at midnight (00:00) every day
 */
export async function resetDailyCountersJob(): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info({ msg: 'Starting daily counter reset job' });

    const resetCount = await resetAllDailyCounters();

    const duration = Date.now() - startTime;

    logger.info({
      msg: 'Daily counter reset job completed',
      usersReset: resetCount,
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      msg: 'Daily counter reset job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    throw error;
  }
}
