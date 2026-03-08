// Netlify Function: Stripe Webhook handler
// POST /api/stripe/webhook
// Handles: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

const Stripe = require('stripe');

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, serviceKey);
}

async function updateCompanyPlan(companyId, plan) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn('No Supabase admin client — plan update skipped for', companyId);
    return;
  }
  const { error } = await supabase
    .from('companies')
    .update({ plan })
    .eq('id', companyId);
  if (error) {
    const { error: err2 } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('company', companyId);
    if (err2) console.error('Failed to update plan:', err2);
  }
}

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });

  let stripeEvent;
  if (webhookSecret) {
    const sig = event.headers['stripe-signature'];
    if (!sig) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing stripe-signature header' }) };
    }
    try {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Webhook signature verification failed' }) };
    }
  } else {
    try {
      stripeEvent = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const companyId = session.metadata?.companyId;
        if (companyId && session.payment_status === 'paid') {
          await updateCompanyPlan(companyId, 'business');
          // Ensure subscription also carries companyId metadata
          if (session.subscription) {
            try {
              await stripe.subscriptions.update(session.subscription, {
                metadata: { companyId },
              });
            } catch (metaErr) {
              console.warn('Could not propagate metadata to subscription:', metaErr.message);
            }
          }
          console.log('Plan upgraded to business for company:', companyId);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        const companyId = subscription.metadata?.companyId;
        if (companyId) {
          const plan = subscription.status === 'active' ? 'business' : 'free';
          await updateCompanyPlan(companyId, plan);
          console.log('Subscription updated:', companyId, plan);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const companyId = subscription.metadata?.companyId;
        if (companyId) {
          await updateCompanyPlan(companyId, 'free');
          console.log('Subscription cancelled, downgraded to free:', companyId);
        }
        break;
      }
      default:
        console.log('Unhandled event type:', stripeEvent.type);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook processing error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Webhook processing failed' }) };
  }
};
