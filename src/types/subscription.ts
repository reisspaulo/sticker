export type PlanType = 'free' | 'premium' | 'ultra';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'inactive';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string;
  stripe_product_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserLimits {
  daily_sticker_limit: number;
  daily_twitter_limit: number;
  has_watermark: boolean;
  priority_processing: boolean;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

export const PLAN_LIMITS: Record<PlanType, UserLimits> = {
  free: {
    daily_sticker_limit: 4,
    daily_twitter_limit: 4,
    has_watermark: true,
    priority_processing: false,
  },
  premium: {
    daily_sticker_limit: 20,
    daily_twitter_limit: 15,
    has_watermark: false,
    priority_processing: false,
  },
  ultra: {
    daily_sticker_limit: 999999,
    daily_twitter_limit: 999999,
    has_watermark: false,
    priority_processing: true,
  },
};
