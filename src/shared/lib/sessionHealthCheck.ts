/**
 * LoftDesk Session Context Health Check
 *
 * READ-ONLY utility. MUST NOT be called from any runtime flow:
 *   ✗ login / session bootstrap
 *   ✗ billing / API handlers
 *   ✗ UI components
 *
 * Allowed callers:
 *   ✓ Dev tools (DevPanel, console)
 *   ✓ Staging / CI health check scripts
 *   ✓ Manual admin verification
 *
 * Equivalent SQL (run in Supabase SQL Editor or psql):
 *   SELECT public.get_session_context();
 */

import { supabase } from '@/shared/lib/supabase'

export interface SessionContextHealthResult {
  ok: boolean
  company_id: string | null
  membership_role: string | null
  is_client: boolean
  raw: Record<string, unknown> | null
  error: string | null
  checked_at: string
}

/**
 * Calls get_session_context() and returns a structured health result.
 * Non-throwing — always returns a result object.
 *
 * @example
 * // In browser console (dev only):
 * import('@/shared/lib/sessionHealthCheck').then(m => m.checkSessionContext().then(console.log))
 *
 * @example
 * // SQL equivalent:
 * SELECT public.get_session_context();
 */
export async function checkSessionContext(): Promise<SessionContextHealthResult> {
  const checked_at = new Date().toISOString()

  if (!supabase) {
    return { ok: false, company_id: null, membership_role: null, is_client: false, raw: null, error: 'Supabase not configured', checked_at }
  }

  try {
    const { data, error } = await supabase.rpc('get_session_context').maybeSingle()

    if (error) {
      return { ok: false, company_id: null, membership_role: null, is_client: false, raw: null, error: `${error.code}: ${error.message}`, checked_at }
    }

    const ctx = data as {
      company_id: string | null
      membership_role: string | null
      is_client: boolean
    } | null

    return {
      ok: Boolean(ctx?.company_id),
      company_id: ctx?.company_id ?? null,
      membership_role: ctx?.membership_role ?? null,
      is_client: ctx?.is_client ?? false,
      raw: data as Record<string, unknown> | null,
      error: null,
      checked_at,
    }
  } catch (err) {
    return {
      ok: false,
      company_id: null,
      membership_role: null,
      is_client: false,
      raw: null,
      error: err instanceof Error ? err.message : String(err),
      checked_at,
    }
  }
}

/**
 * SQL snippet — paste directly into Supabase SQL Editor or psql.
 * Run as authenticated user to verify session context resolution.
 *
 * -- Health check: verify get_session_context() for current user
 * SELECT public.get_session_context();
 *
 * -- Extended: verify specific user (service_role only)
 * SELECT public.get_session_context()
 * FROM auth.users
 * WHERE id = '<user_uuid>';
 */
export const SESSION_HEALTH_SQL = `-- LoftDesk session context health check (migration 155)
-- Run as authenticated user in Supabase SQL Editor or psql.
SELECT public.get_session_context();`
