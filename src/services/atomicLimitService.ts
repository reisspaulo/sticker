import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { alertRpcFailure } from './alertService';

export interface AtomicLimitCheckResult {
  allowed: boolean;
  daily_count: number;
  effective_limit: number;
  pending_count: number;
  onboarding_step: number;
}

/**
 * Atomically check and increment daily limit AND onboarding step
 * This prevents race conditions when multiple images are sent simultaneously
 * Uses SELECT FOR UPDATE lock to ensure thread-safety
 * Now also updates onboarding_step atomically to prevent inconsistencies
 */
export async function checkAndIncrementDailyLimitAtomic(
  userId: string
): Promise<AtomicLimitCheckResult> {
  try {
    logger.debug({
      msg: '[ATOMIC] Checking and incrementing daily limit + onboarding',
      userId,
    });

    const { data, error } = await supabase.rpc('check_and_increment_daily_limit_atomic', {
      p_user_id: userId,
    });

    if (error) {
      logger.error({
        msg: '[ATOMIC] Error in atomic limit check',
        error,
        userId,
      });

      // 🚨 Send critical alert
      await alertRpcFailure({
        service: 'atomicLimitService',
        errorType: 'check_and_increment_daily_limit',
        errorMessage: error.message || 'Unknown RPC error',
        errorCode: error.code,
        userId,
        additionalInfo: {
          hint: error.hint,
          details: error.details,
        },
      });

      throw error;
    }

    if (!data || !data[0]) {
      throw new Error('No data returned from check_and_increment_daily_limit_atomic');
    }

    const result = data[0];

    logger.info({
      msg: '[ATOMIC] Limit check + onboarding update completed',
      userId,
      allowed: result.allowed,
      dailyCount: result.daily_count,
      effectiveLimit: result.effective_limit,
      pendingCount: result.pending_count,
      onboardingStep: result.onboarding_step,
    });

    return {
      allowed: result.allowed,
      daily_count: result.daily_count,
      effective_limit: result.effective_limit,
      pending_count: result.pending_count,
      onboarding_step: result.onboarding_step,
    };
  } catch (error) {
    logger.error({
      msg: '[ATOMIC] Fatal error in atomic limit check',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Atomically set limit_notified_at to prevent duplicate notifications
 * Returns true if user was already notified today
 */
export async function setLimitNotifiedAtomic(userId: string): Promise<boolean> {
  try {
    logger.debug({
      msg: '[ATOMIC] Setting limit notified timestamp',
      userId,
    });

    const { data, error } = await supabase.rpc('set_limit_notified_atomic', {
      p_user_id: userId,
    });

    if (error) {
      logger.error({
        msg: '[ATOMIC] Error setting limit notified',
        error,
        userId,
      });

      // 🚨 Send critical alert
      await alertRpcFailure({
        service: 'atomicLimitService',
        errorType: 'set_limit_notified_atomic',
        errorMessage: error.message || 'Unknown RPC error',
        errorCode: error.code,
        userId,
        additionalInfo: {
          hint: error.hint,
          details: error.details,
        },
      });

      throw error;
    }

    const result = data?.[0];
    const wasAlreadyNotified = result?.was_already_notified ?? false;

    logger.info({
      msg: '[ATOMIC] Limit notified timestamp set',
      userId,
      wasAlreadyNotified,
    });

    return wasAlreadyNotified;
  } catch (error) {
    logger.error({
      msg: '[ATOMIC] Fatal error setting limit notified',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}
