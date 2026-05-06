import { supabase } from '@/shared/lib/supabase'
import { requireSupabaseUserId } from '@/shared/lib/legacySupabase'

export type DataScope = {
  mode: 'multi-tenant' | 'legacy'
  userId: string
  companyId: string
  role?: string | null
}

let bootstrapAttempted = false

export async function getDataScope(_legacyHint?: string): Promise<DataScope> {
  // _legacyHint param kept for backward compatibility with existing callers
  // (settings.api.ts and others). It is INTENTIONALLY IGNORED — DB is the
  // only source of truth: newest company_members row wins.
  void _legacyHint
  const userId = await requireSupabaseUserId()
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany')

  // Query ALL memberships (migration 152: members_select_own_rows).
  // Newest first — after an invitation acceptance the invited company is newest.
  const memberResult = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const memberRows = memberResult.data ?? []

  // Newest membership always wins — deterministic, no hints, no fallbacks.
  let memberRow: { company_id: string; role: string } | null = memberRows[0] ?? null

  if (!memberRow?.company_id && !bootstrapAttempted) {
    bootstrapAttempted = true
    try {
      await supabase.rpc('bootstrap_my_company', { company_name: '', company_nip: '' })
      const res = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      memberRow = res.data ?? null
    } catch {
      // bootstrap may fail — fall through to legacy
    }
  }

  if (memberRow?.company_id) {
    console.log('[DATA SCOPE] resolved companyId:', memberRow.company_id, '| role:', memberRow.role)
    return {
      mode: 'multi-tenant',
      userId,
      companyId: memberRow.company_id,
      role: memberRow.role,
    }
  }

  // No membership found — legacy mode (single-tenant / demo user)
  console.warn('[DATA SCOPE] No company_members row found — falling back to legacy mode for userId:', userId)

  return {
    mode: 'legacy',
    userId,
    companyId: userId,
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
