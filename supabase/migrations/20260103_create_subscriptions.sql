-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Stripe data
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,

  -- Subscription details
  plan_type TEXT NOT NULL CHECK (plan_type IN ('premium', 'ultra')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),

  -- Dates
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Add subscription columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'premium', 'ultra')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'canceled', 'past_due', 'unpaid', 'trialing')),
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Create updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscriptions_updated_at_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Function to get user subscription limits
CREATE OR REPLACE FUNCTION get_user_limits(p_user_id UUID)
RETURNS TABLE (
  daily_sticker_limit INTEGER,
  daily_twitter_limit INTEGER,
  has_watermark BOOLEAN,
  priority_processing BOOLEAN
) AS $$
DECLARE
  v_plan TEXT;
  v_status TEXT;
BEGIN
  -- Get user subscription plan
  SELECT subscription_plan, subscription_status
  INTO v_plan, v_status
  FROM users
  WHERE id = p_user_id;

  -- If subscription is not active, use free limits
  IF v_status != 'active' THEN
    v_plan := 'free';
  END IF;

  -- Return limits based on plan
  CASE v_plan
    WHEN 'premium' THEN
      RETURN QUERY SELECT 20, 15, FALSE, FALSE;
    WHEN 'ultra' THEN
      RETURN QUERY SELECT 999999, 999999, FALSE, TRUE;
    ELSE
      RETURN QUERY SELECT 4, 4, TRUE, FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;
