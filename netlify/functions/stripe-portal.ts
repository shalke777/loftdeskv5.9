// =============================================================================
// stripe-portal.ts — POST /api/stripe/portal
//
// Creates a Stripe Billing Portal session for an existing subscriber.
// Security model:
//   - Requires valid Supabase Bearer token
//   - Verifies user is owner/admin of the requested company
//   - Looks up stripe_customer_id from the companies table (NOT from email)
//   - Returns 404 if the company has no Stripe customer yet
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

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return json(500, { error: 'Stripe not configured' })

  // ── Authenticate ───────────────────────────────────────────────────────────
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

  const { companyId, returnUrl } = body as { companyId?: string; returnUrl?: string }
  if (!companyId || !returnUrl) {
    return json(400, { error: 'Missing required fields: companyId, returnUrl' })
  }

  // ── Authorise ─────────────────────────────────────────────────────────────
  const { data: membership } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', authedUser.id)
    .maybeSingle()

  if (!membership) return json(403, { error: 'User is not a member of this company' })
  if (!['owner', 'admin'].includes(membership.role as string)) {
    return json(403, { error: 'Only owner or admin can access the billing portal' })
  }

  // ── Resolve Stripe Customer ID from DB ─────────────────────────────────────
  const { data: company } = await admin
    .from('companies')
    .select('stripe_customer_id')
    .eq('id', companyId)
    .maybeSingle()

  const stripeCustomerId = (company?.stripe_customer_id as string | null) ?? null
  if (!stripeCustomerId) {
    return json(404, {
      error: 'Brak subskrypcji Stripe. Aktywuj plan, aby uzyskać dostęp do portalu płatności.',
    })
  }

  // ── Create Billing Portal Session ─────────────────────────────────────────
  const stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' as any })
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })

  return json(200, { url: session.url })
}
