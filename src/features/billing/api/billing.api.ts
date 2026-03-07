import { PLAN_DEFS } from '@/shared/lib/constants'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'

export type BillingPlan = keyof typeof PLAN_DEFS

export interface BillingSummary {
  companyName: string
  companyId: string
  currentPlan: BillingPlan
  ksefReady: boolean
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
      const { data: company } = await supabase.from('companies').select('name, plan, ksef_token').eq('id', scope.companyId).maybeSingle()
      const currentPlan = ((company?.plan as BillingPlan | null) ?? 'free')
      return {
        companyName: company?.name ?? 'LoftDesk Workspace',
        companyId: scope.companyId,
        currentPlan,
        ksefReady: Boolean(company?.ksef_token),
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
      usage: { clients: clients ?? 0, projects: projects ?? 0, estimates: estimates ?? 0, invoices: invoices ?? 0, contracts: contracts ?? 0 },
      limits: planLimits(currentPlan),
    }
  },

  async changePlan(companyId: string, plan: BillingPlan) {
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
}
