import logger from '../config/logger';
import redis from '../config/redis';
import { supabase } from '../config/supabase';
import { PlanType } from '../types/subscription';

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
 * Stores in Redis with 30-minute expiration
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

  // Store in Redis with 30-minute expiration
  const key = `pending_pix:${userNumber}`;
  await redis.setex(key, 30 * 60, JSON.stringify(payment));

  logger.info({
    msg: 'Pending PIX payment created',
    userNumber,
    plan,
    amount: pixData.amount,
    expiresAt: expiresAt.toISOString(),
  });

  return payment;
}

/**
 * Get pending PIX payment
 */
export async function getPendingPixPayment(
  userNumber: string
): Promise<PendingPixPayment | null> {
  try {
    const key = `pending_pix:${userNumber}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as PendingPixPayment;
  } catch (error) {
    logger.error({
      msg: 'Error getting pending PIX payment',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    return null;
  }
}

/**
 * Confirm PIX payment (user clicked "Já Paguei")
 * This marks the payment as confirmed and ready for activation after delay
 */
export async function confirmPixPayment(userNumber: string): Promise<boolean> {
  try {
    const pending = await getPendingPixPayment(userNumber);

    if (!pending) {
      logger.warn({
        msg: 'No pending PIX payment found',
        userNumber,
      });
      return false;
    }

    // Update Redis with confirmation flag
    const key = `pending_pix:${userNumber}`;
    const confirmed = {
      ...pending,
      confirmedAt: new Date().toISOString(),
      status: 'confirmed',
    };

    // Keep for 10 minutes more (time for job to process)
    await redis.setex(key, 10 * 60, JSON.stringify(confirmed));

    logger.info({
      msg: 'PIX payment confirmed by user',
      userNumber,
      plan: pending.plan,
      amount: pending.amount,
    });

    return true;
  } catch (error) {
    logger.error({
      msg: 'Error confirming PIX payment',
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
 * Activate subscription after PIX payment confirmation
 * Called by delayed job after 5 minutes
 */
export async function activatePixSubscription(userNumber: string): Promise<boolean> {
  try {
    const pending = await getPendingPixPayment(userNumber);

    if (!pending) {
      logger.warn({
        msg: 'No pending PIX payment to activate',
        userNumber,
      });
      return false;
    }

    // Check if it was confirmed
    const confirmedData = pending as any;
    if (confirmedData.status !== 'confirmed') {
      logger.warn({
        msg: 'PIX payment was not confirmed by user',
        userNumber,
      });
      return false;
    }

    // Calculate subscription dates
    const now = new Date();
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1); // 1 month subscription

    // Update user subscription in database
    const { error } = await supabase
      .from('users')
      .update({
        subscription_plan: pending.plan,
        subscription_status: 'active',
        subscription_starts_at: now.toISOString(),
        subscription_ends_at: endsAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', pending.userId);

    if (error) {
      throw error;
    }

    // Remove pending payment from Redis
    await cancelPixPayment(userNumber);

    logger.info({
      msg: 'PIX subscription activated',
      userNumber,
      userId: pending.userId,
      plan: pending.plan,
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    return true;
  } catch (error) {
    logger.error({
      msg: 'Error activating PIX subscription',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    return false;
  }
}
