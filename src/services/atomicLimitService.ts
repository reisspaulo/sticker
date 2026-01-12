import logger from '../config/logger';
import { alertRpcFailure } from './alertService';
import { rpc, type AtomicLimitCheckResult } from '../rpc';

// Re-export type for backwards compatibility
export type { AtomicLimitCheckResult };

/**
 * Atomically check and increment daily limit AND onboarding step
 * This prevents race conditions when multiple images are sent simultaneously
 * Uses SELECT FOR UPDATE lock to ensure thread-safety
 * Now also updates onboarding_step atomically to prevent inconsistencies
 *
 * ✅ REFACTORED: Now uses type-safe RPC from src/rpc module
 */
export async function checkAndIncrementDailyLimitAtomic(
  userId: string
): Promise<AtomicLimitCheckResult> {
  try {
    logger.debug({
      msg: '[ATOMIC] Checking and incrementing daily limit + onboarding',
      userId,
    });

    // ✅ Type-safe RPC call - TABLE function returns first row
    const result = await rpc('check_and_increment_daily_limit_atomic', {
      p_user_id: userId,
    });

    logger.info({
      msg: '[ATOMIC] Limit check + onboarding update completed',
      userId,
      allowed: result.allowed,
      dailyCount: result.daily_count,
      effectiveLimit: result.effective_limit,
      pendingCount: result.pending_count,
      onboardingStep: result.onboarding_step,
    });

    return result;
  } catch (error) {
    logger.error({
      msg: '[ATOMIC] Error in atomic limit check',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });

    // 🚨 Send critical alert
    await alertRpcFailure({
      service: 'atomicLimitService',
      errorType: 'check_and_increment_daily_limit',
      errorMessage: error instanceof Error ? error.message : 'Unknown RPC error',
      errorCode: (error as any)?.code,
      userId,
      additionalInfo: {
        hint: (error as any)?.hint,
        details: (error as any)?.details,
      },
    });

    throw error;
  }
}

/**
 * Atomically set limit_notified_at to prevent duplicate notifications
 * Returns true if user was already notified today
 *
 * ✅ REFACTORED: Now uses type-safe RPC from src/rpc module
 */
export async function setLimitNotifiedAtomic(userId: string): Promise<boolean> {
  try {
    logger.debug({
      msg: '[ATOMIC] Setting limit notified timestamp',
      userId,
    });

    // ✅ Type-safe RPC call
    // NOTE: PostgreSQL function returns {"was_already_notified": boolean}, not plain boolean
    const result = await rpc('set_limit_notified_atomic', {
      p_user_id: userId,
    });

    // 🔧 FIX: Extract boolean from object if needed (PostgreSQL returns object with property)
    const wasAlreadyNotified =
      typeof result === 'boolean'
        ? result
        : (result as unknown as { was_already_notified: boolean }).was_already_notified;

    logger.info({
      msg: '[ATOMIC] Limit notified timestamp set',
      userId,
      wasAlreadyNotified,
    });

    return wasAlreadyNotified;
  } catch (error) {
    logger.error({
      msg: '[ATOMIC] Error setting limit notified',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });

    // 🚨 Send critical alert
    await alertRpcFailure({
      service: 'atomicLimitService',
      errorType: 'set_limit_notified_atomic',
      errorMessage: error instanceof Error ? error.message : 'Unknown RPC error',
      errorCode: (error as any)?.code,
      userId,
      additionalInfo: {
        hint: (error as any)?.hint,
        details: (error as any)?.details,
      },
    });

    throw error;
  }
}
