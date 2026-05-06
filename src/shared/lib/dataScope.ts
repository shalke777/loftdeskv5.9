import { supabase } from '@/shared/lib/supabase'
import { requireSupabaseUserId } from '@/shared/lib/legacySupabase'

export type DataScope = {
  mode: 'multi-tenant' | 'legacy'
  userId: string
  companyId: string
  role?: string | null
}

// Sprint B: dataScope is an ADAPTER ONLY — all resolution delegated to
// get_session_context(). No resolver logic, no fallbacks, no secondary DB
// queries. In Sprint C this will be removed entirely.
//
// Sprint B.1 safe deploy layer: if mig 155 is not on the DB yet,
// falls back to direct company_members query (old behaviour).
// Remove in Sprint C after mig 155 confirmed on all envs.

function isFunctionNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as Record<string, unknown>).code
  return code === 'PGRST202' || code === '42883'
}

export async function getDataScope(_legacyHint?: string): Promise<DataScope> {
  void _legacyHint
  const userId = await requireSupabaseUserId()
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany')

  const { data: ctx, error } = await supabase
    .rpc('get_session_context')
    .maybeSingle()

  // Sprint B.1: legacy fallback when mig 155 not yet on DB
  if (error && isFunctionNotFound(error)) {
    console.warn('[dataScope] get_session_context not found — falling back to company_members (apply mig 155 to remove this path)')
    const { data: memberRow } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const member = memberRow as { company_id: string; role: string } | null
    if (member?.company_id) {
      return { mode: 'multi-tenant', userId, companyId: member.company_id, role: member.role }
    }
    return { mode: 'legacy', userId, companyId: userId, role: 'owner' }
  }

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
