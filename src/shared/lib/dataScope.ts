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

  // Query ALL memberships (migration 149: members_select_own_rows allows this).
  // Newest first — after an invitation acceptance the invited company is newest.
  const memberResult = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const memberRows = memberResult.data ?? []

  // Pick the most appropriate row:
  //   1. Matches companyIdHint (from React session, already resolved to invited company)
  //   2. Newest row
  let memberRow: { company_id: string; role: string } | null =
    (companyIdHint ? memberRows.find((r) => r.company_id === companyIdHint) : undefined) ??
    memberRows[0] ??
    null

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
      memberRow = res.data ?? null
    } catch {
      // bootstrap may fail — fall through to legacy
    }
  }

  if (memberRow?.company_id) {
    return {
      mode: 'multi-tenant',
      userId,
      companyId: memberRow.company_id,
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
