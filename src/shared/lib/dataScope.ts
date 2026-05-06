import { supabase } from '@/shared/lib/supabase'
import { requireSupabaseUserId } from '@/shared/lib/legacySupabase'

export type DataScope = {
  mode: 'multi-tenant' | 'legacy'
  userId: string
  companyId: string
  role?: string | null
}

// Sprint B/C: dataScope is an ADAPTER ONLY — all resolution delegated to
// get_session_context() (migration 155, must be present on DB).
// No resolver logic, no fallbacks, no secondary DB queries.
// In Sprint D this will be removed entirely — callers migrate to useSessionContext().

export async function getDataScope(_legacyHint?: string): Promise<DataScope> {
  void _legacyHint
  const userId = await requireSupabaseUserId()
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany')

  const { data: ctx, error } = await supabase
    .rpc('get_session_context')
    .maybeSingle()

  if (error && import.meta.env.DEV) {
    console.warn('[dataScope] get_session_context error', error)
  }

  const sessionCtx = ctx as {
    company_id: string | null
    membership_role: string | null
  } | null

  if (sessionCtx?.company_id) {
    console.log('[DATA SCOPE] resolved companyId:', sessionCtx.company_id, '| role:', sessionCtx.membership_role)
    return {
      mode: 'multi-tenant',
      userId,
      companyId: sessionCtx.company_id,
      role: sessionCtx.membership_role,
    }
  }

  // No membership — legacy mode (new user pre-bootstrap, or edge case)
  console.warn('[DATA SCOPE] No company resolved via session_context — legacy mode for userId:', userId)
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
