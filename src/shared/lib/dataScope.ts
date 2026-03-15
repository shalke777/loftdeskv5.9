import { supabase } from '@/shared/lib/supabase'
import { requireSupabaseUserId } from '@/shared/lib/legacySupabase'

export type DataScope = {
  mode: 'multi-tenant' | 'legacy'
  userId: string
  companyId: string
  role?: string | null
}

let bootstrapAttempted = false

export async function getDataScope(companyIdHint?: string): Promise<DataScope> {
  const userId = await requireSupabaseUserId()
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany')

  let { data: memberRow } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!memberRow?.company_id && !bootstrapAttempted) {
    bootstrapAttempted = true
    try {
      await supabase.rpc('bootstrap_my_company', { company_name: '', company_nip: '' })
      const res = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      memberRow = res.data
    } catch {
      // bootstrap may fail — fall through to legacy
    }
  }

  if (memberRow?.company_id) {
    const safeCompanyId = String(memberRow.company_id).trim()
    console.info('COMPANY_QUERY_ID', { raw: memberRow.company_id, safe: safeCompanyId })
    return {
      mode: 'multi-tenant',
      userId,
      companyId: safeCompanyId,
      role: memberRow.role,
    }
  }

  return {
    mode: 'legacy',
    userId,
    companyId: companyIdHint ?? userId,
    role: 'owner',
  }
}

export function applyScope(query: any, scope: DataScope) {
  if (scope.mode === 'multi-tenant') {
    return query.eq('company_id', scope.companyId)
  }
  return query.eq('user_id', scope.userId)
}

export function withScope<T extends Record<string, unknown>>(scope: DataScope, payload: T) {
  return compact({ ...payload, company_id: scope.companyId, user_id: scope.userId })
}

export function compact<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T
}
