// =============================================================================
// stripe-checkout.ts — POST /api/stripe/checkout
//
// Creates a Stripe Checkout Session for a company subscription.
// Security model:
//   - Requires valid Supabase Bearer token in Authorization header
//   - Verifies the user is an owner/admin of the requested company
//   - Validates priceId against allow-list from environment variables
//   - Looks up or creates a Stripe Customer keyed to companies.stripe_customer_id
//   - Grants a 14-day trial only to customers with no prior subscription
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
} as const

function json(status: number, body: unknown) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify(body) }
}

function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Return the set of allowed Stripe price IDs from env vars */
function allowedPriceIds(): Set<string> {
  const ids = new Set<string>()
  const candidates = [
    process.env.STRIPE_PRICE_PRO,
    process.env.STRIPE_PRICE_BUSINESS,
    process.env.VITE_STRIPE_PRO_PRICE_ID,
    process.env.VITE_STRIPE_BUSINESS_PRICE_ID,
  ]
  candidates.forEach((id) => { if (id) ids.add(id) })
  return ids
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return json(500, { error: 'Stripe not configured' })

  // ── Authenticate via Supabase JWT ──────────────────────────────────────────
  const authHeader = (event.headers['authorization'] ?? event.headers['Authorization']) ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return json(401, { error: 'Missing Authorization header' })

  const admin = adminClient()
  if (!admin) return json(500, { error: 'Database not configured' })

  const { data: { user: authedUser }, error: authErr } = await admin.auth.getUser(accessToken)
  if (authErr || !authedUser) return json(401, { error: 'Invalid or expired token' })

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = JSON.parse(event.body ?? '{}') } catch { return json(400, { error: 'Invalid JSON' }) }

  const { companyId, priceId, successUrl, cancelUrl } = body as {
    companyId?: string; priceId?: string; successUrl?: string; cancelUrl?: string
  }

  if (!companyId || !priceId || !successUrl || !cancelUrl) {
    return json(400, { error: 'Missing required fields: companyId, priceId, successUrl, cancelUrl' })
  }

  // Validate priceId against allow-list (empty set = dev mode, allow any)
  const allowed = allowedPriceIds()
  if (allowed.size > 0 && !allowed.has(priceId)) {
    return json(400, { error: 'Invalid price ID' })
  }

  // ── Authorise: user must be owner or admin of the company ──────────────────
  const { data: membership } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', authedUser.id)
    .maybeSingle()

  if (!membership) return json(403, { error: 'User is not a member of this company' })
  if (!['owner', 'admin'].includes(membership.role as string)) {
    return json(403, { error: 'Only owner or admin can manage billing' })
  }

  // ── Look up or create Stripe Customer ──────────────────────────────────────
  const { data: company } = await admin
    .from('companies')
    .select('name, billing_email, stripe_customer_id, subscription_status')
    .eq('id', companyId)
    .maybeSingle()

  const stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' as any })

  let stripeCustomerId: string = (company?.stripe_customer_id as string | null) ?? ''

  if (!stripeCustomerId) {
    const email = (company?.billing_email as string | null) ?? authedUser.email ?? undefined
    const customer = await stripe.customers.create({
      email,
      name: (company?.name as string | undefined) ?? undefined,
      metadata: { companyId },
    })
    stripeCustomerId = customer.id
    // Persist immediately to prevent duplicate creation on concurrent requests
    await admin.from('companies')
      .update({ stripe_customer_id: stripeCustomerId, billing_email: email ?? null })
      .eq('id', companyId)
  }

  // ── Trial eligibility: only for brand-new customers ────────────────────────
  const hadPriorSubscription =
    Boolean(company?.stripe_customer_id) ||
    (Boolean(company?.subscription_status) && (company?.subscription_status as string) !== 'none')

  // ── Create Checkout Session ────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { companyId },
      ...(hadPriorSubscription ? {} : { trial_period_days: 14 }),
    },
    allow_promotion_codes: true,
    metadata: { companyId },
  })

  return json(200, { sessionId: session.id, url: session.url })
}
