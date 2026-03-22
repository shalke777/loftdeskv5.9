import { PLAN_DEFS } from '@/shared/lib/constants'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'
import { getAppOrigin } from '@/shared/lib/native'

export type BillingPlan = keyof typeof PLAN_DEFS

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'

export interface BillingSummary {
  companyName: string
  companyId: string
  currentPlan: BillingPlan
  ksefReady: boolean
  subscriptionStatus: SubscriptionStatus
  trialEndsAt: string | null
  subscriptionPeriodEnd: string | null
  usage: {
    clients: number
    projects: number
    estimates: number
    invoices: number
    contracts: number
  }
  limits: {
    clients: number | '∞'
    projects: number | '∞'
    estimates: number | '∞'
    invoices: number | '∞'
    contracts: number | '∞'
  }
}

function planLimits(plan: BillingPlan) {
  if (plan === 'free') return { clients: 10, projects: 3, estimates: 5, invoices: 5, contracts: 3 }
  return { clients: '∞', projects: '∞', estimates: '∞', invoices: '∞', contracts: '∞' } as const
}

export const billingApi = {
  async summary(companyId: string): Promise<BillingSummary> {
    if (isDemoMode || !supabase) {
      const dashboard = demoDb.dashboard(companyId)
      return {
        companyName: dashboard.companyName,
        companyId,
        currentPlan: dashboard.plan,
        ksefReady: dashboard.ksefReady,
        subscriptionStatus: 'active' as SubscriptionStatus,
        trialEndsAt: null,
        subscriptionPeriodEnd: null,
        usage: {
          clients: dashboard.clientsCount,
          projects: dashboard.projectsCount,
          estimates: dashboard.estimatesCount,
          invoices: dashboard.invoicesCount,
          contracts: dashboard.contractsCount,
        },
        limits: planLimits(dashboard.plan),
      }
    }

    const scope = await getDataScope(companyId)
    const filterColumn = scope.mode === 'multi-tenant' ? 'company_id' : 'user_id'
    const filterValue = scope.mode === 'multi-tenant' ? scope.companyId : scope.userId

    const [{ count: clients }, { count: projects }, { count: estimates }, { count: invoices }, { count: contracts }] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('cost_estimates').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('contracts').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
    ])

    if (scope.mode === 'multi-tenant') {
      // Try full billing query first; if billing columns aren't in the DB yet
      // (migration 036 pending), fall back to core columns so the dashboard
      // doesn't 400 and crash.
      let company: Record<string, unknown> | null = null
      const { data: fullCompany, error: billingErr } = await supabase
        .from('companies')
        .select('name, plan, ksef_token, subscription_status, trial_ends_at, subscription_current_period_end')
        .eq('id', scope.companyId)
        .maybeSingle()
      if (!billingErr) {
        company = fullCompany as Record<string, unknown> | null
      } else {
        const { data: coreCompany } = await supabase
          .from('companies')
          .select('name, plan, ksef_token')
          .eq('id', scope.companyId)
          .maybeSingle()
        company = coreCompany as Record<string, unknown> | null
      }
      const currentPlan = ((company?.plan as BillingPlan | null) ?? 'free')
      return {
        companyName: (company?.name as string | undefined) ?? 'LoftDesk Workspace',
        companyId: scope.companyId,
        currentPlan,
        ksefReady: Boolean(company?.ksef_token),
        subscriptionStatus: ((company?.subscription_status as SubscriptionStatus | null) ?? 'none'),
        trialEndsAt: (company?.trial_ends_at as string | null) ?? null,
        subscriptionPeriodEnd: (company?.subscription_current_period_end as string | null) ?? null,
        usage: { clients: clients ?? 0, projects: projects ?? 0, estimates: estimates ?? 0, invoices: invoices ?? 0, contracts: contracts ?? 0 },
        limits: planLimits(currentPlan),
      }
    }

    const { data: profile } = await supabase.from('profiles').select('company, plan, ksef_token').eq('id', scope.userId).maybeSingle()
    const currentPlan = ((profile?.plan as BillingPlan | null) ?? 'free')
    return {
      companyName: profile?.company ?? 'LoftDesk Workspace',
      companyId: scope.companyId,
      currentPlan,
      ksefReady: Boolean(profile?.ksef_token),
      subscriptionStatus: 'none' as SubscriptionStatus,
      trialEndsAt: null,
      subscriptionPeriodEnd: null,
      usage: { clients: clients ?? 0, projects: projects ?? 0, estimates: estimates ?? 0, invoices: invoices ?? 0, contracts: contracts ?? 0 },
      limits: planLimits(currentPlan),
    }
  },

  async changePlan(companyId: string, plan: BillingPlan) {
    if (plan === 'admin') throw new Error('Plan admin może być przypisany wyłącznie przez administratora systemu.')
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.companyPlanUpdate(companyId, plan))
    const scope = await getDataScope(companyId)
    if (scope.mode === 'multi-tenant') {
      const { data, error } = await supabase.from('companies').update({ plan }).eq('id', scope.companyId).select('*').single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('profiles').update({ plan }).eq('id', scope.userId).select('*').single()
    if (error) throw error
    return data
  },

  async createCheckoutSession(companyId: string, priceId?: string): Promise<{ url: string }> {
    const resolvedPriceId = priceId ?? import.meta.env.VITE_STRIPE_BUSINESS_PRICE_ID
    if (!resolvedPriceId) throw new Error('Stripe price ID not configured (VITE_STRIPE_BUSINESS_PRICE_ID)')
    if (!supabase) throw new Error('Supabase not configured')
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) throw new Error('Nie zalogowany. Zaloguj się i spróbuj ponownie.')
    const res = await fetch(`${getAppOrigin()}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        priceId: resolvedPriceId,
        companyId,
        successUrl: `${getAppOrigin()}/billing?checkout=success`,
        cancelUrl: `${getAppOrigin()}/billing?checkout=cancel`,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error || `Stripe error: ${res.status}`)
    }
    return res.json()
  },

  async openCustomerPortal(companyId: string): Promise<{ url: string }> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) throw new Error('Nie zalogowany. Zaloguj się i spróbuj ponownie.')
    const res = await fetch(`${getAppOrigin()}/api/stripe/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        companyId,
        returnUrl: `${getAppOrigin()}/billing`,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error || `Stripe portal error: ${res.status}`)
    }
    return res.json()
  },
}
