// =============================================================================
// stripe-webhook.ts — POST /api/stripe/webhook
//
// Verifies Stripe webhook signatures and syncs subscription state to Supabase.
//
// Handled events:
//   checkout.session.completed      — persist stripe_customer_id early
//   customer.subscription.created   — full sync (main path for new subs)
//   customer.subscription.updated   — full sync (plan change, trial → active, etc.)
//   customer.subscription.deleted   — downgrade to free + mark canceled
//   invoice.paid                    — extend access period after renewal
//   invoice.payment_failed          — mark subscription as past_due
//
// Security: STRIPE_WEBHOOK_SECRET is required; requests without a valid
// signature are rejected with 400. STRIPE_WEBHOOK_SECRET missing → 500
// (prevents accidentally running unsigned in production).
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const HEADERS = { 'Content-Type': 'application/json' } as const

function json(status: number, body: unknown) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify(body) }
}

function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Map a Stripe price ID to our internal plan name using environment config */
function priceIdToPlan(priceId: string | null | undefined): string {
  if (!priceId) return 'business'
  const map: Record<string, string> = {}
  const add = (env: string | undefined, plan: string) => { if (env) map[env] = plan }
  add(process.env.STRIPE_PRICE_PRO,              'pro')
  add(process.env.STRIPE_PRICE_BUSINESS,         'business')
  add(process.env.VITE_STRIPE_PRO_PRICE_ID,      'pro')
  add(process.env.VITE_STRIPE_BUSINESS_PRICE_ID, 'business')
  return map[priceId] ?? 'business'
}

const STRIPE_TO_INTERNAL_STATUS: Partial<Record<Stripe.Subscription.Status, string>> = {
  active:             'active',
  trialing:           'trialing',
  past_due:           'past_due',
  canceled:           'canceled',
  unpaid:             'unpaid',
  incomplete:         'incomplete',
  incomplete_expired: 'canceled',
  paused:             'active',
}

function toInternalStatus(s: Stripe.Subscription.Status): string {
  return STRIPE_TO_INTERNAL_STATUS[s] ?? 'active'
}

type AdminClient = NonNullable<ReturnType<typeof adminClient>>

async function syncSubscription(admin: AdminClient, sub: Stripe.Subscription) {
  const companyId = sub.metadata?.companyId
  if (!companyId) {
    console.warn('[webhook] subscription lacks companyId metadata:', sub.id)
    return
  }

  const status    = toInternalStatus(sub.status)
  const priceId   = sub.items.data[0]?.price?.id ?? null
  const plan      = status === 'canceled' ? 'free' : priceIdToPlan(priceId)
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null
  const trialEnd  = sub.trial_end
    ? new Date(sub.trial_end * 1000).toISOString()
    : null
  const custId    = typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id

  const { error } = await admin.from('companies').update({
    plan,
    subscription_status:             status,
    stripe_subscription_id:          sub.id,
    stripe_customer_id:              custId,
    subscription_current_period_end: periodEnd,
    trial_ends_at:                   trialEnd,
    plan_source:                     'stripe',
  }).eq('id', companyId)

  if (error) {
    console.error('[webhook] failed to sync company', companyId, error)
    throw error
  }
  console.log(`[webhook] synced company=${companyId} plan=${plan} status=${status}`)
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const secretKey     = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey) return json(500, { error: 'Stripe not configured' })
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set — refusing for security')
    return json(500, { error: 'Webhook secret not configured' })
  }

  const sig = event.headers['stripe-signature']
  if (!sig) return json(400, { error: 'Missing stripe-signature header' })

  const stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' as any })

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body ?? '', sig, webhookSecret)
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err.message)
    return json(400, { error: 'Webhook signature verification failed' })
  }

  const admin = adminClient()

  try {
    switch (stripeEvent.type) {

      // Checkout completed — persist customer ID early; subscription events follow
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session
        const companyId = session.metadata?.companyId
        if (!companyId || !admin) break
        const custId = typeof session.customer === 'string'
          ? session.customer
          : (session.customer as any)?.id
        if (custId) {
          await admin.from('companies')
            .update({ stripe_customer_id: custId, plan_source: 'stripe' })
            .eq('id', companyId)
        }
        break
      }

      // Subscription created or updated — primary sync path
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object as Stripe.Subscription
        if (admin) await syncSubscription(admin, sub)
        break
      }

      // Subscription canceled / deleted
      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object as Stripe.Subscription
        const companyId = sub.metadata?.companyId
        if (!companyId || !admin) break
        await admin.from('companies').update({
          plan:                            'free',
          subscription_status:             'canceled',
          stripe_subscription_id:          sub.id,
          subscription_current_period_end: null,
          plan_source:                     'stripe',
        }).eq('id', companyId)
        console.log(`[webhook] subscription canceled for company=${companyId}`)
        break
      }

      // Invoice paid — renew access period
      case 'invoice.paid': {
        const invoice = stripeEvent.data.object as Stripe.Invoice
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription as any)?.id
        if (!subId || !admin) break
        const sub = await stripe.subscriptions.retrieve(subId)
        await syncSubscription(admin, sub)
        break
      }

      // Invoice payment failed — mark past_due
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object as Stripe.Invoice
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription as any)?.id
        if (!subId || !admin) break
        const sub = await stripe.subscriptions.retrieve(subId)
        const companyId = sub.metadata?.companyId
        if (!companyId) break
        await admin.from('companies')
          .update({ subscription_status: 'past_due' })
          .eq('id', companyId)
        console.log(`[webhook] payment failed for company=${companyId}`)
        break
      }

      default:
        break
    }
  } catch (err: any) {
    console.error('[webhook] error processing', stripeEvent.type, err)
    return json(500, { error: 'Webhook processing error' })
  }

  return json(200, { received: true })
}
