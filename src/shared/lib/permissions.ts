import type { SessionUser } from '@/app/providers'
import { isDemoMode } from '@/shared/lib/supabase'

export type AppPlan = SessionUser['plan']
export type AppRole = SessionUser['role']
export type AppFeature =
  | 'billing'
  | 'admin'
  | 'ksef'
  | 'team'
  | 'portal'
  | 'release'

export type AppAction =
  | 'clients.create'
  | 'clients.delete'
  | 'estimates.create'
  | 'estimates.delete'
  | 'estimates.convert'
  | 'invoices.create'
  | 'invoices.delete'
  | 'invoices.markPaid'
  | 'invoices.sendToKsef'
  | 'contracts.create'
  | 'contracts.delete'
  | 'contracts.sign'
  | 'projects.create'
  | 'projects.delete'
  | 'projects.updateStatus'
  | 'settings.updateCompany'
  | 'settings.inviteMember'
  | 'billing.changePlan'
  | 'admin.manage'

const planOrder: Record<AppPlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
  admin: 3,
}

function hasPlan(plan: AppPlan, minimum: AppPlan) {
  return planOrder[plan] >= planOrder[minimum]
}

function hasRole(role: AppRole, allowed: AppRole[]) {
  return allowed.includes(role)
}

export function canAccessFeature(user: SessionUser | null | undefined, feature: AppFeature) {
  if (!user) return false
  switch (feature) {
    case 'billing':
      return hasRole(user.role, ['owner', 'admin', 'manager', 'accountant'])
    case 'admin':
      return user.role === 'admin'
    case 'ksef':
      return (isDemoMode || hasPlan(user.plan, 'pro')) && hasRole(user.role, ['owner', 'admin', 'manager', 'accountant'])
    case 'team':
      return (isDemoMode || hasPlan(user.plan, 'business')) && hasRole(user.role, ['owner', 'admin'])
    case 'portal':
      return (isDemoMode || hasPlan(user.plan, 'pro')) && hasRole(user.role, ['owner', 'admin', 'manager'])
    case 'release':
      return hasRole(user.role, ['owner', 'admin'])
    default:
      return false
  }
}

export function canPerformAction(user: SessionUser | null | undefined, action: AppAction) {
  if (!user) return false
  switch (action) {
    case 'clients.create':
    case 'clients.delete':
    case 'estimates.create':
    case 'estimates.delete':
    case 'estimates.convert':
    case 'invoices.create':
    case 'invoices.delete':
    case 'invoices.markPaid':
    case 'contracts.create':
    case 'contracts.delete':
    case 'contracts.sign':
    case 'projects.create':
    case 'projects.delete':
    case 'projects.updateStatus':
      return hasRole(user.role, ['owner', 'admin', 'manager'])
    case 'invoices.sendToKsef':
      return canAccessFeature(user, 'ksef') && hasRole(user.role, ['owner', 'admin', 'manager', 'accountant'])
    case 'settings.updateCompany':
      return hasRole(user.role, ['owner', 'admin'])
    case 'settings.inviteMember':
      return canAccessFeature(user, 'team')
    case 'billing.changePlan':
      return hasRole(user.role, ['owner', 'admin'])
    case 'admin.manage':
      return user.role === 'admin'
    default:
      return false
  }
}
