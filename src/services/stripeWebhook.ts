import Stripe from 'stripe';
import logger from '../config/logger';
import {
  upsertSubscription,
  cancelSubscription,
  getSubscriptionByStripeId,
} from './subscriptionService';
import { PlanType } from '../types/subscription';
import { getUserByNumber } from './userService';
import { sendText } from './evolutionApi';
import { getSubscriptionActivatedMessage } from './menuService';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Product ID to plan type mapping (will be set from env vars)
const PRODUCT_TO_PLAN: Record<string, PlanType> = {
  [process.env.STRIPE_STICKER_PREMIUM_PRODUCT_ID || '']: 'premium',
  [process.env.STRIPE_STICKER_ULTRA_PRODUCT_ID || '']: 'ultra',
};

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    return event;
  } catch (error) {
    logger.error({
      msg: 'Webhook signature verification failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Invalid signature');
  }
}

/**
 * Process checkout.session.completed event
 */
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  try {
    logger.info({
      msg: 'Processing checkout.session.completed',
      sessionId: session.id,
      customerId: session.customer,
      clientReferenceId: session.client_reference_id,
    });

    // Get customer phone from client_reference_id (passed via URL)
    const phoneNumber = session.client_reference_id;
    if (!phoneNumber) {
      logger.warn({
        msg: 'No phone number in checkout session client_reference_id',
        sessionId: session.id,
      });
      return;
    }

    // Get user by phone number
    const user = await getUserByNumber(phoneNumber);
    if (!user) {
      logger.error({
        msg: 'User not found for checkout session',
        phoneNumber,
        sessionId: session.id,
      });
      return;
    }

    // Get subscription details
    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      logger.warn({
        msg: 'No subscription ID in checkout session',
        sessionId: session.id,
      });
      return;
    }

    // Retrieve subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Validate subscription has required fields
    if (!(subscription as any).current_period_start || !(subscription as any).current_period_end) {
      logger.error({
        msg: 'Subscription missing required period fields',
        subscriptionId: subscription.id,
        hasPeriodStart: !!(subscription as any).current_period_start,
        hasPeriodEnd: !!(subscription as any).current_period_end,
      });
      throw new Error('Invalid subscription data');
    }

    // Get product ID from price
    const priceId = subscription.items.data[0].price.id;
    const price = await stripe.prices.retrieve(priceId);
    const productId = price.product as string;

    // Determine plan type
    const planType = PRODUCT_TO_PLAN[productId] || 'premium';

    // Create/update subscription in database
    await upsertSubscription({
      userId: user.id,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeProductId: productId,
      planType,
      status: 'active',
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
      trialStart: (subscription as any).trial_start
        ? new Date((subscription as any).trial_start * 1000)
        : undefined,
      trialEnd: (subscription as any).trial_end
        ? new Date((subscription as any).trial_end * 1000)
        : undefined,
    });

    // Send confirmation message to user on WhatsApp
    try {
      const confirmationMessage = getSubscriptionActivatedMessage(planType);
      await sendText(phoneNumber, confirmationMessage);

      logger.info({
        msg: 'Subscription confirmation sent to user',
        userId: user.id,
        phoneNumber,
        planType,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to send subscription confirmation',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id,
        phoneNumber,
      });
      // Don't throw - subscription was created successfully
    }

    // Log experiment event for converted
    try {
      const { logExperimentEvent, getUpgradeDismissVariant } = await import('./experimentService');
      const experimentResult = await getUpgradeDismissVariant(user.id, phoneNumber);
      if (experimentResult) {
        await logExperimentEvent(
          user.id,
          experimentResult.experiment_id,
          experimentResult.variant,
          'converted',
          { plan: planType, payment_method: 'stripe', source: 'checkout_completed' }
        );
        logger.info({
          msg: 'Experiment conversion logged',
          userId: user.id,
          variant: experimentResult.variant,
          planType,
        });
      }
    } catch (experimentError) {
      logger.warn({
        msg: 'Failed to log experiment conversion event',
        error: experimentError instanceof Error ? experimentError.message : 'Unknown error',
        userId: user.id,
      });
      // Don't throw - subscription was activated successfully
    }

    logger.info({
      msg: 'Checkout completed successfully',
      userId: user.id,
      subscriptionId: subscription.id,
      planType,
    });
  } catch (error) {
    logger.error({
      msg: 'Error processing checkout.session.completed',
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: session.id,
    });
    throw error;
  }
}

/**
 * Process customer.subscription.updated event
 */
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  try {
    logger.info({
      msg: 'Processing customer.subscription.updated',
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    // Get product ID from price
    const priceId = subscription.items.data[0].price.id;
    const price = await stripe.prices.retrieve(priceId);
    const productId = price.product as string;

    // Determine plan type
    const planType = PRODUCT_TO_PLAN[productId] || 'premium';

    // Validate subscription has required fields
    if (!(subscription as any).current_period_start || !(subscription as any).current_period_end) {
      logger.error({
        msg: 'Subscription missing required period fields',
        subscriptionId: subscription.id,
        hasPeriodStart: !!(subscription as any).current_period_start,
        hasPeriodEnd: !!(subscription as any).current_period_end,
      });
      throw new Error('Invalid subscription data');
    }

    // Try to find existing subscription in database first
    const existingSubscription = await getSubscriptionByStripeId(subscription.id);

    let userId: string;

    if (existingSubscription) {
      // Use existing user_id from subscription
      userId = existingSubscription.user_id;
      logger.info({
        msg: 'Found existing subscription',
        subscriptionId: subscription.id,
        userId,
      });
    } else {
      // If subscription doesn't exist yet, this shouldn't happen for update
      // but we'll try to find user anyway
      logger.warn({
        msg: 'Subscription not found in database during update - this is unusual',
        subscriptionId: subscription.id,
      });
      return;
    }

    // Update subscription in database
    await upsertSubscription({
      userId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeProductId: productId,
      planType,
      status: subscription.status as any,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
      canceledAt: (subscription as any).canceled_at
        ? new Date((subscription as any).canceled_at * 1000)
        : undefined,
      trialStart: (subscription as any).trial_start
        ? new Date((subscription as any).trial_start * 1000)
        : undefined,
      trialEnd: (subscription as any).trial_end
        ? new Date((subscription as any).trial_end * 1000)
        : undefined,
    });

    logger.info({
      msg: 'Subscription updated successfully',
      userId,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    logger.error({
      msg: 'Error processing customer.subscription.updated',
      error: error instanceof Error ? error.message : 'Unknown error',
      subscriptionId: subscription.id,
    });
    throw error;
  }
}

/**
 * Process customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  try {
    logger.info({
      msg: 'Processing customer.subscription.deleted',
      subscriptionId: subscription.id,
    });

    await cancelSubscription(subscription.id);

    logger.info({
      msg: 'Subscription deleted successfully',
      subscriptionId: subscription.id,
    });
  } catch (error) {
    logger.error({
      msg: 'Error processing customer.subscription.deleted',
      error: error instanceof Error ? error.message : 'Unknown error',
      subscriptionId: subscription.id,
    });
    throw error;
  }
}

/**
 * Process webhook event
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  logger.info({
    msg: 'Processing webhook event',
    eventType: event.type,
    eventId: event.id,
  });

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    default:
      logger.info({
        msg: 'Unhandled webhook event type',
        eventType: event.type,
      });
  }
}
