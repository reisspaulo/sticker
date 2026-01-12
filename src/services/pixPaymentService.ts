import logger from '../config/logger';
import redis from '../config/redis';
import { supabase } from '../config/supabase';
import { PlanType, PLAN_LIMITS } from '../types/subscription';

// PIX key for receiving payments
const PIX_KEY = 'dceaa434-b5ac-462e-bbd4-c66248869cff';

export interface PendingPixPayment {
  userNumber: string;
  userName: string;
  userId: string;
  plan: PlanType;
  pixKey: string;
  amount: number;
  createdAt: string;
  expiresAt: string;
}

/**
 * Generate PIX payment data for a subscription plan
 */
export function generatePixPayment(plan: PlanType): {
  pixKey: string;
  amount: number;
  description: string;
} {
  const amounts = {
    premium: 5.0,
    ultra: 9.9,
    free: 0,
  };

  const descriptions = {
    premium: 'StickerBot Premium - Mensal',
    ultra: 'StickerBot Ultra - Mensal',
    free: 'StickerBot Free',
  };

  return {
    pixKey: PIX_KEY,
    amount: amounts[plan],
    description: descriptions[plan],
  };
}

/**
 * Create a pending PIX payment
 * Stores in BOTH Redis (24h expiration) and Supabase (permanent backup)
 */
export async function createPendingPixPayment(
  userNumber: string,
  userName: string,
  userId: string,
  plan: PlanType
): Promise<PendingPixPayment> {
  const pixData = generatePixPayment(plan);
  const now = new Date();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes to pay

  const payment: PendingPixPayment = {
    userNumber,
    userName,
    userId,
    plan,
    pixKey: pixData.pixKey,
    amount: pixData.amount,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  logger.info({
    msg: '[PIX] Creating pending payment',
    userNumber,
    userId,
    plan,
    amount: pixData.amount,
    expiresAt: expiresAt.toISOString(),
  });

  // Store in Supabase for permanent backup and audit
  const { data: dbPayment, error: dbError } = await supabase
    .from('pix_payments')
    .insert({
      user_id: userId,
      user_number: userNumber,
      user_name: userName,
      plan,
      pix_key: pixData.pixKey,
      amount: pixData.amount,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (dbError) {
    logger.error({
      msg: '[PIX] Failed to create payment in Supabase',
      error: dbError,
      userNumber,
      userId,
    });
    throw dbError;
  }

  logger.info({
    msg: '[PIX] Payment saved to Supabase',
    paymentId: dbPayment.id,
    userNumber,
  });

  // Store in Redis with 24-hour expiration (safety buffer)
  const key = `pending_pix:${userNumber}`;
  await redis.setex(key, 24 * 60 * 60, JSON.stringify(payment));

  logger.info({
    msg: '[PIX] Pending PIX payment created successfully',
    paymentId: dbPayment.id,
    userNumber,
    plan,
    amount: pixData.amount,
    expiresAt: expiresAt.toISOString(),
  });

  return payment;
}

/**
 * Get pending PIX payment
 * Tries Redis first, falls back to Supabase if not found
 */
export async function getPendingPixPayment(
  userNumber: string
): Promise<PendingPixPayment | null> {
  try {
    // Try Redis first (fast)
    const key = `pending_pix:${userNumber}`;
    const data = await redis.get(key);

    if (data) {
      logger.debug({
        msg: '[PIX] Payment found in Redis',
        userNumber,
      });
      return JSON.parse(data) as PendingPixPayment;
    }

    logger.info({
      msg: '[PIX] Payment not in Redis, checking Supabase',
      userNumber,
    });

    // Fallback to Supabase (permanent backup)
    const { data: dbPayment, error } = await supabase
      .from('pix_payments')
      .select('*')
      .eq('user_number', userNumber)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        logger.info({
          msg: '[PIX] No pending payment found',
          userNumber,
        });
        return null;
      }
      throw error;
    }

    if (!dbPayment) {
      return null;
    }

    // Convert DB format to PendingPixPayment
    const payment: PendingPixPayment = {
      userNumber: dbPayment.user_number,
      userName: dbPayment.user_name,
      userId: dbPayment.user_id,
      plan: dbPayment.plan as PlanType,
      pixKey: dbPayment.pix_key,
      amount: parseFloat(dbPayment.amount),
      createdAt: dbPayment.created_at,
      expiresAt: dbPayment.expires_at,
    };

    // Restore to Redis for future fast access
    await redis.setex(key, 24 * 60 * 60, JSON.stringify(payment));

    logger.info({
      msg: '[PIX] Payment restored from Supabase to Redis',
      userNumber,
      paymentId: dbPayment.id,
    });

    return payment;
  } catch (error) {
    logger.error({
      msg: '[PIX] Error getting pending PIX payment',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    return null;
  }
}

/**
 * Confirm PIX payment (user clicked "Já Paguei")
 * This marks the payment as confirmed in BOTH Redis and Supabase
 */
export async function confirmPixPayment(userNumber: string): Promise<boolean> {
  try {
    const pending = await getPendingPixPayment(userNumber);

    if (!pending) {
      logger.warn({
        msg: '[PIX] No pending PIX payment found for confirmation',
        userNumber,
      });
      return false;
    }

    const confirmedAt = new Date().toISOString();

    logger.info({
      msg: '[PIX] Confirming payment',
      userNumber,
      plan: pending.plan,
      amount: pending.amount,
    });

    // Update Supabase first (permanent record)
    const { error: dbError } = await supabase
      .from('pix_payments')
      .update({
        status: 'confirmed',
        confirmed_at: confirmedAt,
        updated_at: confirmedAt,
      })
      .eq('user_number', userNumber)
      .eq('status', 'pending');

    if (dbError) {
      logger.error({
        msg: '[PIX] Failed to confirm payment in Supabase',
        error: dbError,
        userNumber,
      });
      throw dbError;
    }

    // Update Redis with confirmation flag
    const key = `pending_pix:${userNumber}`;
    const confirmed = {
      ...pending,
      confirmedAt,
      status: 'confirmed',
    };

    // Keep for 24 hours (plenty of time for job to process)
    await redis.setex(key, 24 * 60 * 60, JSON.stringify(confirmed));

    logger.info({
      msg: '[PIX] Payment confirmed successfully',
      userNumber,
      plan: pending.plan,
      amount: pending.amount,
      confirmedAt,
    });

    return true;
  } catch (error) {
    logger.error({
      msg: '[PIX] Error confirming PIX payment',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    return false;
  }
}

/**
 * Cancel pending PIX payment
 */
export async function cancelPixPayment(userNumber: string): Promise<void> {
  try {
    const key = `pending_pix:${userNumber}`;
    await redis.del(key);

    logger.info({
      msg: 'PIX payment cancelled',
      userNumber,
    });
  } catch (error) {
    logger.error({
      msg: 'Error cancelling PIX payment',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
  }
}

/**
 * Result of PIX subscription activation
 */
export type ActivationResult = {
  success: boolean;
  reason: 'activated' | 'not_confirmed' | 'no_payment_found' | 'database_error' | 'unknown_error';
  error?: string;
};

/**
 * Activate subscription after PIX payment confirmation
 * Called by delayed job after 5 minutes
 */
export async function activatePixSubscription(userNumber: string): Promise<ActivationResult> {
  try {
    logger.info({
      msg: '[PIX] Starting subscription activation',
      userNumber,
    });

    let pending = await getPendingPixPayment(userNumber);
    let paymentData: PendingPixPayment;

    if (!pending) {
      logger.warn({
        msg: '[PIX] No pending PIX payment to activate',
        userNumber,
      });

      // Check Supabase for any confirmed payments that haven't been activated
      const { data: dbPayment } = await supabase
        .from('pix_payments')
        .select('*')
        .eq('user_number', userNumber)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!dbPayment) {
        logger.error({
          msg: '[PIX] No confirmed payment found in Supabase either',
          userNumber,
        });
        return { success: false, reason: 'no_payment_found' };
      }

      logger.info({
        msg: '[PIX] Found confirmed payment in Supabase, proceeding with activation',
        userNumber,
        paymentId: dbPayment.id,
      });

      // Reconstruct pending object from DB
      paymentData = {
        userNumber: dbPayment.user_number,
        userName: dbPayment.user_name,
        userId: dbPayment.user_id,
        plan: dbPayment.plan as PlanType,
        pixKey: dbPayment.pix_key,
        amount: parseFloat(dbPayment.amount),
        createdAt: dbPayment.created_at,
        expiresAt: dbPayment.expires_at,
      };

      // Mark as confirmed for later check
      (paymentData as any).status = 'confirmed';
    } else {
      paymentData = pending;
    }

    // Check if it was confirmed
    const confirmedData = paymentData as any;
    if (confirmedData.status !== 'confirmed') {
      logger.warn({
        msg: '[PIX] Payment was not confirmed by user',
        userNumber,
        status: confirmedData.status,
      });

      // Update payment status to failed
      await supabase
        .from('pix_payments')
        .update({
          status: 'failed',
          error_message: 'User did not confirm payment',
          updated_at: new Date().toISOString(),
        })
        .eq('user_number', userNumber)
        .eq('status', 'pending');

      return { success: false, reason: 'not_confirmed' };
    }

    // Calculate subscription dates
    const now = new Date();
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1); // 1 month subscription

    logger.info({
      msg: '[PIX] Activating subscription in users table',
      userNumber,
      userId: paymentData.userId,
      plan: paymentData.plan,
    });

    // Get plan limits for the new subscription
    const planLimits = PLAN_LIMITS[paymentData.plan];

    // Update user subscription in database
    const { error: userError } = await supabase
      .from('users')
      .update({
        subscription_plan: paymentData.plan,
        subscription_status: 'active',
        subscription_starts_at: now.toISOString(),
        subscription_ends_at: endsAt.toISOString(),
        daily_limit: planLimits.daily_sticker_limit, // FIX: Update daily_limit for paid plans
        daily_count: 0, // Reset count so user can use their new limits immediately
        updated_at: now.toISOString(),
      })
      .eq('id', paymentData.userId);

    if (userError) {
      logger.error({
        msg: '[PIX] Failed to update user subscription',
        error: userError,
        userNumber,
        userId: paymentData.userId,
      });

      // Update payment status to failed
      await supabase
        .from('pix_payments')
        .update({
          status: 'failed',
          error_message: `Failed to update user: ${userError.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq('user_number', userNumber)
        .eq('status', 'confirmed');

      return { success: false, reason: 'database_error', error: userError.message };
    }

    // Update payment status to activated
    const { error: paymentError } = await supabase
      .from('pix_payments')
      .update({
        status: 'activated',
        activated_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_number', userNumber)
      .eq('status', 'confirmed');

    if (paymentError) {
      logger.error({
        msg: '[PIX] Failed to update payment status (but subscription WAS activated)',
        error: paymentError,
        userNumber,
      });
      // Don't throw - subscription was activated successfully
    }

    // Remove pending payment from Redis
    await cancelPixPayment(userNumber);

    logger.info({
      msg: '[PIX] Subscription activated successfully',
      userNumber,
      userId: paymentData.userId,
      plan: paymentData.plan,
      dailyLimit: planLimits.daily_sticker_limit,
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    return { success: true, reason: 'activated' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error({
      msg: '[PIX] Error activating PIX subscription',
      error: errorMessage,
      userNumber,
    });

    // Try to update payment with error
    try {
      await supabase
        .from('pix_payments')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('user_number', userNumber)
        .in('status', ['pending', 'confirmed']);
    } catch (updateError) {
      logger.error({
        msg: '[PIX] Failed to update payment error status',
        error: updateError instanceof Error ? updateError.message : 'Unknown error',
      });
    }

    return { success: false, reason: 'unknown_error', error: errorMessage };
  }
}
