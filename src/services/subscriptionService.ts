import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { Subscription, PlanType, SubscriptionStatus, UserLimits, PLAN_LIMITS } from '../types/subscription';

/**
 * Get user's current subscription
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error({
      msg: 'Error getting user subscription',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Get user's subscription plan and limits
 */
export async function getUserLimits(userId: string): Promise<UserLimits> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_plan, subscription_status, subscription_ends_at')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Check if subscription is active and not expired
    const isActive =
      user.subscription_status === 'active' &&
      user.subscription_ends_at &&
      new Date(user.subscription_ends_at) > new Date();

    const plan: PlanType = isActive && user.subscription_plan ? user.subscription_plan : 'free';

    return PLAN_LIMITS[plan];
  } catch (error) {
    logger.error({
      msg: 'Error getting user limits',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    // Return free plan limits on error
    return PLAN_LIMITS.free;
  }
}

/**
 * Create or update subscription from Stripe
 */
export async function upsertSubscription(data: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  stripeProductId: string;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
}): Promise<Subscription> {
  try {
    logger.info({
      msg: 'Upserting subscription',
      userId: data.userId,
      planType: data.planType,
      status: data.status,
    });

    // Upsert subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: data.userId,
          stripe_customer_id: data.stripeCustomerId,
          stripe_subscription_id: data.stripeSubscriptionId,
          stripe_price_id: data.stripePriceId,
          stripe_product_id: data.stripeProductId,
          plan_type: data.planType,
          status: data.status,
          current_period_start: data.currentPeriodStart.toISOString(),
          current_period_end: data.currentPeriodEnd.toISOString(),
          cancel_at_period_end: data.cancelAtPeriodEnd || false,
          canceled_at: data.canceledAt?.toISOString() || null,
          trial_start: data.trialStart?.toISOString() || null,
          trial_end: data.trialEnd?.toISOString() || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'stripe_subscription_id',
        }
      )
      .select()
      .single();

    if (subscriptionError) {
      throw subscriptionError;
    }

    // Update user table
    const { error: userError } = await supabase
      .from('users')
      .update({
        subscription_plan: data.planType,
        subscription_status: data.status,
        subscription_ends_at: data.currentPeriodEnd.toISOString(),
      })
      .eq('id', data.userId);

    if (userError) {
      logger.error({
        msg: 'Error updating user subscription info',
        error: userError.message,
        userId: data.userId,
      });
    }

    logger.info({
      msg: 'Subscription upserted successfully',
      userId: data.userId,
      subscriptionId: subscription.id,
      planType: data.planType,
    });

    return subscription;
  } catch (error) {
    logger.error({
      msg: 'Error upserting subscription',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: data.userId,
    });
    throw error;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(stripeSubscriptionId: string): Promise<void> {
  try {
    logger.info({
      msg: 'Canceling subscription',
      stripeSubscriptionId,
    });

    // Update subscription
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);

    if (subscriptionError) {
      throw subscriptionError;
    }

    // Get user_id from subscription
    const { data: subscription, error: getError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (getError) {
      throw getError;
    }

    // Update user table
    const { error: userError } = await supabase
      .from('users')
      .update({
        subscription_plan: 'free',
        subscription_status: 'canceled',
      })
      .eq('id', subscription.user_id);

    if (userError) {
      logger.error({
        msg: 'Error updating user on cancellation',
        error: userError.message,
        userId: subscription.user_id,
      });
    }

    logger.info({
      msg: 'Subscription canceled successfully',
      stripeSubscriptionId,
      userId: subscription.user_id,
    });
  } catch (error) {
    logger.error({
      msg: 'Error canceling subscription',
      error: error instanceof Error ? error.message : 'Unknown error',
      stripeSubscriptionId,
    });
    throw error;
  }
}

/**
 * Get subscription by Stripe customer ID
 */
export async function getSubscriptionByCustomerId(
  stripeCustomerId: string
): Promise<Subscription | null> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error({
      msg: 'Error getting subscription by customer ID',
      error: error instanceof Error ? error.message : 'Unknown error',
      stripeCustomerId,
    });
    throw error;
  }
}

/**
 * Get subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error({
      msg: 'Error getting subscription by Stripe ID',
      error: error instanceof Error ? error.message : 'Unknown error',
      stripeSubscriptionId,
    });
    throw error;
  }
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_ends_at')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    const isActive =
      user.subscription_status === 'active' &&
      user.subscription_ends_at &&
      new Date(user.subscription_ends_at) > new Date();

    return isActive;
  } catch (error) {
    logger.error({
      msg: 'Error checking active subscription',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return false;
  }
}

/**
 * Get user plan type
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_plan, subscription_status, subscription_ends_at')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Check if subscription is active and not expired
    const isActive =
      user.subscription_status === 'active' &&
      user.subscription_ends_at &&
      new Date(user.subscription_ends_at) > new Date();

    return isActive && user.subscription_plan ? user.subscription_plan : 'free';
  } catch (error) {
    logger.error({
      msg: 'Error getting user plan',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return 'free';
  }
}
