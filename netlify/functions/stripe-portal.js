// Netlify Function: Stripe Customer Portal session
// POST /api/stripe/portal
// Body: { customerId, returnUrl }

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
    const { email, returnUrl } = body;

    if (!email || !returnUrl) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: email, returnUrl' }) };
    }

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No Stripe customer found for this email' }) };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: returnUrl,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe portal error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Stripe error' }) };
  }
};
