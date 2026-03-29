import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'

// ── New: authenticated portal access (client_accounts + project_client_access) ──

export interface PortalAccessClient {
  id: string              // project_client_access.id
  clientAccountId: string
  email: string
  fullName: string | null
  phone: string | null
  projectId: string
  projectName: string
  projectNumber: string
  projectStatus: string
  grantedAt: string
}

export interface PortalProjectSummary {
  projectId: string
  unreadOperator: number
  pendingApprovals: number
}

// ── Legacy: estimate-level URL tokens (client_tokens table) ──────────────────

export interface CompanyPortalToken {
  id: string
  token: string
  estimate_id: string
  estimate_number: string
  estimate_name: string
  client_name: string
  active: boolean
  expires_at: string
  url: string
}

function buildPortalUrl(token: string) {
  return `/portal/${token}`
}

export const portalApi = {
  // ── Authenticated portal access ──────────────────────────────────────────

  async listPortalAccess(): Promise<PortalAccessClient[]> {
    if (isDemoMode || !supabase) return []
    const { data, error } = await supabase
      .from('project_client_access')
      .select(`
        id,
        granted_at,
        client_accounts!inner(id, email, full_name, phone),
        projects!inner(id, name, number, status)
      `)
      .order('granted_at', { ascending: false })
    if (error) {
      if (error.code === '42P01') return []
      throw error
    }
    return (data ?? [])
      .filter((row: any) => row.projects && row.client_accounts)
      .map((row: any) => ({
        id: row.id,
        clientAccountId: row.client_accounts.id,
        email: row.client_accounts.email,
        fullName: row.client_accounts.full_name ?? null,
        phone: row.client_accounts.phone ?? null,
        projectId: row.projects.id,
        projectName: row.projects.name,
        projectNumber: row.projects.number,
        projectStatus: row.projects.status,
        grantedAt: row.granted_at,
      }))
  },

  async revokePortalAccess(accessId: string): Promise<void> {
    if (isDemoMode || !supabase) return
    const { error } = await supabase
      .from('project_client_access')
      .delete()
      .eq('id', accessId)
    if (error) throw error
  },

  /** Per-project communication summary for PortalInboxPage (operator view) */
  async listProjectSummaries(projectIds: string[]): Promise<PortalProjectSummary[]> {
    if (isDemoMode || !supabase || !projectIds.length) return []
    const [threadsResult, sigReqResult] = await Promise.all([
      supabase
        .from('project_threads')
        .select('project_id, unread_count_operator')
        .in('project_id', projectIds)
        .eq('archived', false),
      supabase
        .from('signature_requests')
        .select('project_id')
        .in('project_id', projectIds)
        .in('status', ['pending', 'in_progress']),
    ])
    const unreadMap: Record<string, number> = {}
    for (const t of threadsResult.data ?? []) {
      if (t.project_id) {
        unreadMap[t.project_id] = (unreadMap[t.project_id] ?? 0) + (t.unread_count_operator ?? 0)
      }
    }
    const pendingMap: Record<string, number> = {}
    for (const r of sigReqResult.data ?? []) {
      if (r.project_id) {
        pendingMap[r.project_id] = (pendingMap[r.project_id] ?? 0) + 1
      }
    }
    return projectIds.map(pid => ({
      projectId:       pid,
      unreadOperator:  unreadMap[pid] ?? 0,
      pendingApprovals: pendingMap[pid] ?? 0,
    }))
  },

  // ── Legacy: estimate-level URL tokens ────────────────────────────────────

  async listCompanyTokens(companyId: string): Promise<CompanyPortalToken[]> {
    if (isDemoMode || !supabase) {
      return demoDb.portal.listForCompany(companyId).map((item) => ({
        id: item.id,
        token: item.token,
        estimate_id: item.cost_estimate_id,
        estimate_number: item.estimate_number,
        estimate_name: item.estimate_name,
        client_name: item.client_name,
        active: item.active,
        expires_at: item.expires_at,
        url: buildPortalUrl(item.token),
      }))
    }
    const scope = await getDataScope(companyId)
    const table = supabase.from('client_tokens').select('id, token, cost_estimate_id, client_name, active, expires_at, cost_estimates(number, name)').order('created_at', { ascending: false })
    const query = scope.mode === 'multi-tenant' ? table.eq('company_id', scope.companyId) : table.eq('user_id', scope.userId)
    const { data, error } = await query
    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation') || String((error as any).status ?? '').startsWith('4')) return []
      throw error
    }
    return (data ?? []).map((item: any) => ({
      id: item.id,
      token: item.token,
      estimate_id: item.cost_estimate_id,
      estimate_number: Array.isArray(item.cost_estimates) ? item.cost_estimates[0]?.number ?? '' : item.cost_estimates?.number ?? '',
      estimate_name: Array.isArray(item.cost_estimates) ? item.cost_estimates[0]?.name ?? '' : item.cost_estimates?.name ?? '',
      client_name: item.client_name,
      active: Boolean(item.active),
      expires_at: item.expires_at,
      url: buildPortalUrl(item.token),
    }))
  },
  async deactivateCompanyToken(companyId: string, tokenId: string) {
    if (isDemoMode || !supabase) {
      demoDb.portal.deactivateToken(tokenId)
      return { ok: true }
    }
    const scope = await getDataScope(companyId)
    const table = supabase.from('client_tokens').update({ active: false }).eq('id', tokenId)
    const query = scope.mode === 'multi-tenant' ? table.eq('company_id', scope.companyId) : table.eq('user_id', scope.userId)
    const { error } = await query
    if (error) throw error
    return { ok: true }
  },
}
