import type { SessionUser } from '@/app/providers'
import { isDemoMode } from '@/shared/lib/supabase'

export type AppPlan = SessionUser['plan']
export type AppRole = SessionUser['role']

// ── Feature flags (plan + role gating for entire sections) ──────────────────
export type AppFeature =
  | 'billing'
  | 'admin'
  | 'ksef'
  | 'team'
  | 'portal'
  | 'release'

// ── Granular actions (role-level access control) ────────────────────────────
// Naming: <domain>.<verb> — fail-closed (unlisted = false)
export type AppAction =
  // Projects
  | 'projects.view'
  | 'projects.create'
  | 'projects.edit'
  | 'projects.archive'
  | 'projects.delete'
  | 'projects.updateStatus'      // kept for backward compat (ProjectsPage)

  // Clients
  | 'clients.view'
  | 'clients.create'
  | 'clients.edit'
  | 'clients.delete'

  // Stages
  | 'stages.view'
  | 'stages.create'
  | 'stages.edit'
  | 'stages.update_status'

  // Costs
  | 'costs.view'
  | 'costs.create'
  | 'costs.edit'
  | 'costs.delete'

  // Worklogs
  | 'worklogs.create'
  | 'worklogs.edit_own'

  // Media
  | 'photos.upload'
  | 'photos.delete'
  | 'documents.upload'
  | 'documents.delete'

  // Estimates
  | 'estimates.view'
  | 'estimates.create'
  | 'estimates.edit'
  | 'estimates.delete'
  | 'estimates.convert'

  // Contracts
  | 'contracts.view'
  | 'contracts.create'
  | 'contracts.edit'
  | 'contracts.delete'
  | 'contracts.sign'

  // Invoices
  | 'invoices.view'
  | 'invoices.create'
  | 'invoices.edit'
  | 'invoices.delete'
  | 'invoices.markPaid'
  | 'invoices.send'
  | 'invoices.sendToKsef'

  // KSeF
  | 'ksef.access'

  // Team
  | 'team.view'
  | 'team.invite'
  | 'team.edit_roles'
  | 'team.remove'

  // Settings
  | 'settings.updateCompany'
  | 'settings.inviteMember'      // kept for backward compat (TeamInvitationsCard)

  // Billing
  | 'billing.changePlan'

  // Admin
  | 'admin.manage'

// ── Helpers ──────────────────────────────────────────────────────────────────

const planOrder: Record<AppPlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
  admin: 3,
}

function hasPlan(plan: AppPlan, minimum: AppPlan) {
  return planOrder[plan] >= planOrder[minimum]
}

function hasRole(role: AppRole | null | undefined, allowed: AppRole[]) {
  if (!role) return false
  return allowed.includes(role)
}

// ── Feature access (plan-gated sections) ─────────────────────────────────────
export function canAccessFeature(user: SessionUser | null | undefined, feature: AppFeature) {
  if (!user) return false
  if (user.isOwnerOverride) return feature !== 'admin'
  switch (feature) {
    case 'billing':
      return hasRole(user.role, ['owner', 'admin', 'accountant'])
    case 'admin':
      return user.role === 'admin'
    case 'ksef':
      return (isDemoMode || hasPlan(user.plan, 'pro')) && hasRole(user.role, ['owner', 'admin', 'accountant'])
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

// ── Role permission matrix ────────────────────────────────────────────────────
//
// OWNER      full access (isOwnerOverride short-circuits everything)
// ADMIN      everything except billing owner controls
// MANAGER    project execution + business flow; no invoices, no ksef, no billing
// ACCOUNTANT finance only: invoices, costs, ksef; no projects, stages, media, team
// WORKER     project execution only: view, status updates, upload, costs.create
// CLIENT     portal only (is_client path — should never reach canPerformAction)
//
// Fail-closed: default branch returns false for any unlisted action.

export function canPerformAction(user: SessionUser | null | undefined, action: AppAction): boolean {
  if (!user) return false
  if (user.isOwnerOverride) return true

  const r = user.role

  switch (action) {

    // ── Projects ──────────────────────────────────────────────────────────────
    case 'projects.view':
      return hasRole(r, ['owner', 'admin', 'manager', 'worker'])
    case 'projects.create':
    case 'projects.edit':
    case 'projects.archive':
      return hasRole(r, ['owner', 'admin', 'manager'])
    case 'projects.delete':
      return hasRole(r, ['owner', 'admin'])
    case 'projects.updateStatus':                     // backward compat alias
      return hasRole(r, ['owner', 'admin', 'manager'])

    // ── Clients ───────────────────────────────────────────────────────────────
    case 'clients.view':
      return hasRole(r, ['owner', 'admin', 'manager', 'accountant'])
    case 'clients.create':
    case 'clients.edit':
      return hasRole(r, ['owner', 'admin', 'manager'])
    case 'clients.delete':
      return hasRole(r, ['owner', 'admin'])

    // ── Stages ────────────────────────────────────────────────────────────────
    case 'stages.view':
      return hasRole(r, ['owner', 'admin', 'manager', 'worker'])
    case 'stages.create':
    case 'stages.edit':
      return hasRole(r, ['owner', 'admin', 'manager'])
    case 'stages.update_status':
      return hasRole(r, ['owner', 'admin', 'manager', 'worker'])

    // ── Costs ─────────────────────────────────────────────────────────────────
    case 'costs.view':
      return hasRole(r, ['owner', 'admin', 'manager', 'accountant', 'worker'])
    case 'costs.create':
      return hasRole(r, ['owner', 'admin', 'manager', 'accountant', 'worker'])
    case 'costs.edit':
      return hasRole(r, ['owner', 'admin', 'manager', 'accountant'])
    case 'costs.delete':
      return hasRole(r, ['owner', 'admin', 'manager'])

    // ── Worklogs ──────────────────────────────────────────────────────────────
    case 'worklogs.create':
      return hasRole(r, ['owner', 'admin', 'manager', 'worker'])
    case 'worklogs.edit_own':
      return hasRole(r, ['owner', 'admin', 'manager', 'worker'])

    // ── Media ─────────────────────────────────────────────────────────────────
    case 'photos.upload':
    case 'documents.upload':
      return hasRole(r, ['owner', 'admin', 'manager', 'worker'])
    case 'photos.delete':
    case 'documents.delete':
      return hasRole(r, ['owner', 'admin', 'manager'])

    // ── Estimates ─────────────────────────────────────────────────────────────
    case 'estimates.view':
      return hasRole(r, ['owner', 'admin', 'manager', 'accountant'])
    case 'estimates.create':
    case 'estimates.edit':
    case 'estimates.convert':
      return hasRole(r, ['owner', 'admin', 'manager'])
    case 'estimates.delete':
      return hasRole(r, ['owner', 'admin'])

    // ── Contracts ─────────────────────────────────────────────────────────────
    case 'contracts.view':
      return hasRole(r, ['owner', 'admin', 'manager', 'accountant'])
    case 'contracts.create':
    case 'contracts.edit':
    case 'contracts.sign':
      return hasRole(r, ['owner', 'admin', 'manager'])
    case 'contracts.delete':
      return hasRole(r, ['owner', 'admin'])

    // ── Invoices ──────────────────────────────────────────────────────────────
    case 'invoices.view':
      return hasRole(r, ['owner', 'admin', 'accountant'])
    case 'invoices.create':
    case 'invoices.edit':
    case 'invoices.delete':
    case 'invoices.markPaid':
    case 'invoices.send':
      return hasRole(r, ['owner', 'admin', 'accountant'])
    case 'invoices.sendToKsef':
      return canAccessFeature(user, 'ksef') && hasRole(r, ['owner', 'admin', 'accountant'])

    // ── KSeF ──────────────────────────────────────────────────────────────────
    case 'ksef.access':
      return canAccessFeature(user, 'ksef')

    // ── Team ──────────────────────────────────────────────────────────────────
    case 'team.view':
      return hasRole(r, ['owner', 'admin', 'manager'])
    case 'team.invite':
    case 'settings.inviteMember':                     // backward compat alias
      return canAccessFeature(user, 'team')
    case 'team.edit_roles':
    case 'team.remove':
      return hasRole(r, ['owner'])

    // ── Settings ──────────────────────────────────────────────────────────────
    case 'settings.updateCompany':
      return hasRole(r, ['owner', 'admin'])

    // ── Billing ───────────────────────────────────────────────────────────────
    case 'billing.changePlan':
      return hasRole(r, ['owner'])

    // ── Admin ─────────────────────────────────────────────────────────────────
    case 'admin.manage':
      return r === 'admin'

    // Fail-closed: any unlisted action = denied
    default:
      return false
  }
}
