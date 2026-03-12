// =============================================================================
// usePlanLimits — returns current plan limits and usage, with "near limit" flags
// =============================================================================

import { useBillingSummary } from '@/features/billing/hooks/useBilling'
import type { BillingPlan } from '@/features/billing/api/billing.api'

export interface LimitStatus {
  used: number
  limit: number | '∞'
  /** Percent used, 0–100 (null when unlimited) */
  pct: number | null
  /** true when used >= limit */
  exceeded: boolean
  /** true when pct >= warningThreshold */
  nearLimit: boolean
}

export interface PlanLimits {
  plan: BillingPlan
  clients: LimitStatus
  projects: LimitStatus
  estimates: LimitStatus
  invoices: LimitStatus
  contracts: LimitStatus
  /** true if any resource is exceeded */
  anyExceeded: boolean
  /** true if any resource is at/near limit */
  anyNearLimit: boolean
}

function calcStatus(used: number, limit: number | '∞', warnPct = 80): LimitStatus {
  if (limit === '∞') return { used, limit, pct: null, exceeded: false, nearLimit: false }
  const pct = limit === 0 ? 100 : Math.round((used / limit) * 100)
  return {
    used,
    limit,
    pct,
    exceeded: used >= limit,
    nearLimit: pct >= warnPct,
  }
}

export function usePlanLimits(): { data: PlanLimits | null; isLoading: boolean } {
  const { data, isLoading } = useBillingSummary()

  if (!data) return { data: null, isLoading }

  const plans: PlanLimits = {
    plan: data.currentPlan,
    clients:   calcStatus(data.usage.clients,   data.limits.clients),
    projects:  calcStatus(data.usage.projects,  data.limits.projects),
    estimates: calcStatus(data.usage.estimates, data.limits.estimates),
    invoices:  calcStatus(data.usage.invoices,  data.limits.invoices),
    contracts: calcStatus(data.usage.contracts, data.limits.contracts),
    anyExceeded: false,
    anyNearLimit: false,
  }

  const all = [plans.clients, plans.projects, plans.estimates, plans.invoices, plans.contracts]
  plans.anyExceeded  = all.some((s) => s.exceeded)
  plans.anyNearLimit = all.some((s) => s.nearLimit)

  return { data: plans, isLoading }
}
