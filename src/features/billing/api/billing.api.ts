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
  if (plan === 'free') return { clients: 10, projects: 5, estimates: 20, invoices: 10, contracts: 5 }
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

    // DB is the only source of truth: getDataScope() resolves active company
    // from company_members ORDER BY created_at DESC. The companyId param is
    // used only as a React Query cache key — NOT for data resolution.
    const scope = await getDataScope()
    const activeCompanyId = scope.companyId

    console.log('[ACTIVE COMPANY]', activeCompanyId)

    const filterColumn = scope.mode === 'multi-tenant' ? 'company_id' : 'user_id'
    const filterValue = scope.mode === 'multi-tenant' ? activeCompanyId : scope.userId

    const [{ count: clients }, { count: projects }, { count: estimates }, { count: invoices }, { count: contracts }] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('cost_estimates').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
      supabase.from('contracts').select('*', { count: 'exact', head: true }).eq(filterColumn, filterValue),
    ])

    console.log('[PROJECT COUNT]', projects ?? 0)

    if (scope.mode === 'multi-tenant') {
      // Sprint B: get_session_context() is the single authority.
      // Sprint B.1 fallback: if mig 155 not on DB, use get_my_company_billing().
      const { data: ctxData, error: ctxErr } = await supabase.rpc('get_session_context').maybeSingle()
      const useLegacy = ctxErr && (ctxErr.code === 'PGRST202' || ctxErr.code === '42883')

      let company: Record<string, unknown> | null = null
      if (useLegacy) {
        console.warn('[billing] get_session_context not found — fallback to get_my_company_billing (apply mig 155)')
        const { data: legacyRow } = await supabase.rpc('get_my_company_billing').maybeSingle()
        company = legacyRow as Record<string, unknown> | null
      } else {
        company = (ctxData as Record<string, unknown> | null)?.company as Record<string, unknown> | null
      }

      const currentPlan = ((company?.plan as BillingPlan | null) ?? 'free')
      const planSource  = (company?.plan_source as string | null) ?? 'unknown'
      const limits = planLimits(currentPlan)

      console.log('[PLAN SOURCE]', `companies.plan for ${activeCompanyId} = ${currentPlan} (plan_source=${planSource})`)
      console.log('[PROJECT LIMIT]', limits.projects)

      return {
        companyName: (company?.name as string | undefined) ?? 'LoftDesk Workspace',
        companyId: activeCompanyId,
        currentPlan,
        ksefReady: Boolean(company?.ksef_token),
        subscriptionStatus: ((company?.subscription_status as SubscriptionStatus | null) ?? 'none'),
        trialEndsAt: (company?.trial_ends_at as string | null) ?? null,
        subscriptionPeriodEnd: (company?.subscription_current_period_end as string | null) ?? null,
        usage: { clients: clients ?? 0, projects: projects ?? 0, estimates: estimates ?? 0, invoices: invoices ?? 0, contracts: contracts ?? 0 },
        limits,
      }
    }

    const { data: profile } = await supabase.from('profiles').select('company, plan').eq('id', scope.userId).maybeSingle()
    const currentPlan = ((profile?.plan as BillingPlan | null) ?? 'free')
    const limits = planLimits(currentPlan)

    console.log('[PLAN SOURCE]', `profiles.plan for user ${scope.userId} = ${currentPlan}`)
    console.log('[PROJECT LIMIT]', limits.projects)

    return {
      companyName: profile?.company ?? 'LoftDesk Workspace',
      companyId: activeCompanyId,
      currentPlan,
      ksefReady: false, // ksef columns only exist on companies table (multi-tenant)
      subscriptionStatus: 'none' as SubscriptionStatus,
      trialEndsAt: null,
      subscriptionPeriodEnd: null,
      usage: { clients: clients ?? 0, projects: projects ?? 0, estimates: estimates ?? 0, invoices: invoices ?? 0, contracts: contracts ?? 0 },
      limits,
    }
  },

  async changePlan(companyId: string, plan: BillingPlan) {
    if (plan === 'admin') throw new Error('Plan admin może być przypisany wyłącznie przez administratora systemu.')
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.companyPlanUpdate(companyId, plan))
    const scope = await getDataScope()
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
