const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabase = createClient(
  'https://ludlztjdvwsrwlsczoje.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGx6dGpkdndzcndsc2N6b2plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5MTE1MSwiZXhwIjoyMDgyMzY3MTUxfQ.fl1GxEIj6BK5qpZte3z7HYUW3NWSwPQyYTFf6-38blY'
);

async function getStripeData(path, key) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(key + ':').toString('base64');
    https.get({
      hostname: 'api.stripe.com',
      path: path,
      headers: { 'Authorization': 'Basic ' + auth }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

async function main() {
  const stripeKey = process.env.STRIPE_KEY;
  const userId = 'cd76e9af-dcdf-4bc9-b131-df7fe2fe6b99';
  const customerId = 'cus_TjLYwejp53Qggd';
  
  // Get customer subscriptions
  const customer = await getStripeData(`/v1/customers/${customerId}/subscriptions`, stripeKey);
  const subscription = customer.data[0];
  
  if (!subscription) {
    console.log('No subscription found');
    return;
  }
  
  console.log('Subscription found:', subscription.id);
  console.log('Subscription object:', JSON.stringify(subscription, null, 2));

  // Get full subscription details
  const fullSubscription = await getStripeData(`/v1/subscriptions/${subscription.id}`, stripeKey);
  console.log('Full subscription:', JSON.stringify(fullSubscription, null, 2));

  // Get price to determine product
  const price = await getStripeData(`/v1/prices/${fullSubscription.items.data[0].price.id}`, stripeKey);
  const productId = price.product;

  console.log('Product ID:', productId);

  // Determine plan type
  const PREMIUM_PRODUCT = process.env.STRIPE_STICKER_PREMIUM_PRODUCT_ID;
  const ULTRA_PRODUCT = process.env.STRIPE_STICKER_ULTRA_PRODUCT_ID;
  const planType = productId === PREMIUM_PRODUCT ? 'premium' : 'ultra';

  console.log('Plan type:', planType);

  const periodStart = fullSubscription.items.data[0].current_period_start;
  const periodEnd = fullSubscription.items.data[0].current_period_end;

  console.log('Current period start:', periodStart);
  console.log('Current period end:', periodEnd);

  // Create subscription in database
  const { data: sub, error: subError} = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: fullSubscription.id,
      stripe_price_id: fullSubscription.items.data[0].price.id,
      stripe_product_id: productId,
      plan_type: planType,
      status: 'active',
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: fullSubscription.cancel_at_period_end || false,
    }, { onConflict: 'stripe_subscription_id' })
    .select()
    .single();
  
  if (subError) {
    console.error('Error creating subscription:', subError);
    return;
  }
  
  console.log('Subscription created:', sub.id);
  
  // Update user
  const { error: userError } = await supabase
    .from('users')
    .update({
      subscription_plan: planType,
      subscription_status: 'active',
      subscription_ends_at: new Date(periodEnd * 1000).toISOString(),
    })
    .eq('id', userId);
  
  if (userError) {
    console.error('Error updating user:', userError);
    return;
  }
  
  console.log('User updated successfully!');
  console.log('Phone: 5511946304133');
  console.log('Plan:', planType);
}

main().catch(console.error);
