// Netlify Function: Stripe Checkout session creation
// POST /api/stripe/checkout
// Body: { priceId, companyId, email, successUrl, cancelUrl }

const Stripe = require('stripe');

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { priceId, companyId, email, successUrl, cancelUrl } = body;

    if (!priceId || !companyId || !successUrl || !cancelUrl) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: priceId, companyId, successUrl, cancelUrl' }) };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email || undefined,
      metadata: { companyId },
      subscription_data: { metadata: { companyId } },
      allow_promotion_codes: true,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ sessionId: session.id, url: session.url }) };
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Stripe error' }) };
  }
};
