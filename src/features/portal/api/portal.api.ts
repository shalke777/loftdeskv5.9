import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'

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
