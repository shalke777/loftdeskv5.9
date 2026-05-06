import { supabase } from '@/shared/lib/supabase'
import type { DemoRole } from '@/shared/lib/demoDb'
import type { SessionUser } from '@/app/providers'

export interface ResolvedSession {
  user: SessionUser | null
}

// Sprint B: single authority — get_session_context() is the primary resolver.
// Sprint B.1 safe deploy layer: if mig 155 is not yet applied on the DB,
// get_session_context() returns PGRST202 (function not found). In that case
// we fall back to the legacy get_my_company_billing() + company_members path.
// Once mig 155 is applied, the fallback never fires.

// Returns true if the error indicates mig 155 is not yet on the DB.
function isFunctionNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as Record<string, unknown>).code
  // PGRST202 = PostgREST "Could not find the function" (mig 155 not applied)
  // 42883     = PostgreSQL "undefined_function" (direct Postgres path)
  return code === 'PGRST202' || code === '42883'
}

// Legacy fallback: reconstructs session from get_my_company_billing() (mig 153)
// + company_members. Used ONLY when mig 155 is not yet deployed.
// Remove in Sprint C after mig 155 is confirmed on all envs.
async function legacyResolveContext(authUserId: string): Promise<{
  company_id: string | null
  company_name: string | null
  company: Record<string, unknown> | null
  membership_role: string | null
} | null> {
  if (!supabase) return null
  try {
    const [{ data: companyRow }, { data: memberRow }] = await Promise.all([
      supabase.rpc('get_my_company_billing').maybeSingle(),
      supabase.from('company_members').select('company_id, role').eq('user_id', authUserId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const company = companyRow as Record<string, unknown> | null
    const member  = memberRow  as { company_id: string; role: string } | null
    if (!member?.company_id) return null
    return {
      company_id:       member.company_id,
      company_name:     (company?.name as string | null) ?? null,
      company:          company,
      membership_role:  member.role,
    }
  } catch {
    return null
  }
}

export async function resolveSupabaseSession(): Promise<ResolvedSession> {
  if (!supabase) return { user: null }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { user: null }
  const authUser = authData.user

  // Single DB roundtrip — migration 155: SECURITY DEFINER, JSONB snapshot.
  const { data: ctx, error: ctxError } = await supabase
    .rpc('get_session_context')
    .maybeSingle()

  // Sprint B.1 safe deploy layer: if mig 155 not yet applied, use legacy path.
  if (ctxError && isFunctionNotFound(ctxError)) {
    console.warn('[backend] get_session_context not found — falling back to legacy resolution (apply mig 155 to remove this path)')
    const legacy = await legacyResolveContext(authUser.id)
    if (legacy?.company_id) {
      return {
        user: {
          id: authUser.id,
          email: authUser.email ?? '',
          companyId: legacy.company_id,
          companyName: legacy.company_name ?? 'LoftDesk Workspace',
          role: (legacy.membership_role as DemoRole) ?? 'worker',
          plan: ((legacy.company?.plan as SessionUser['plan']) ?? 'free'),
          fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Użytkownik',
        },
      }
    }
    return { user: null }
  }

  if (ctxError && import.meta.env.DEV) {
    console.warn('[backend] get_session_context error', ctxError)
  }

  const sessionCtx = ctx as {
    company_id: string | null
    company_name: string | null
    company: Record<string, unknown> | null
    membership_role: string | null
    membership_since: string | null
    is_client: boolean
    client_company_id: string | null
  } | null

  // ── Client path ─────────────────────────────────────────────────────────────
  if (sessionCtx?.is_client && sessionCtx.company_id) {
    return {
      user: {
        id: authUser.id,
        email: authUser.email ?? '',
        companyId: sessionCtx.company_id,
        companyName: 'Portal klienta',
        role: 'client' as const,
        plan: 'free' as const,
        fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Klient',
        pendingProjectId: (authUser.user_metadata?.project_id as string | undefined) ?? null,
      },
    }
  }

  // Metadata guard: client_account_id in metadata but no client_accounts row.
  // Prevents bootstrap creating an operator account for a stale client invite.
  if (authUser.user_metadata?.client_account_id && !sessionCtx?.company_id) {
    if (import.meta.env.DEV) {
      console.warn('[backend] metadata_guard — client_account_id w metadata ale brak rekordu w client_accounts', { userId: authUser.id })
    }
    return { user: null }
  }

  // ── Operator path ────────────────────────────────────────────────────────────
  if (sessionCtx?.company_id) {
    const company = sessionCtx.company
    return {
      user: {
        id: authUser.id,
        email: authUser.email ?? '',
        companyId: sessionCtx.company_id,
        companyName: sessionCtx.company_name ?? 'LoftDesk Workspace',
        role: (sessionCtx.membership_role as DemoRole) ?? 'worker',
        plan: ((company?.plan as SessionUser['plan']) ?? 'free'),
        fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Użytkownik',
      },
    }
  }

  // ── New user: no membership yet → trigger bootstrap, then re-resolve ─────────
  // Bootstrap is a one-time operation, NOT part of context resolution.
  try {
    const { data: bootstrapCompanyId } = await supabase.rpc('bootstrap_my_company', { company_name: '', company_nip: '' })
    if (bootstrapCompanyId) {
      // Single re-resolve after bootstrap via the same canonical RPC
      const { data: ctxAfter } = await supabase.rpc('get_session_context').maybeSingle()
      const after = ctxAfter as typeof sessionCtx
      if (after?.company_id) {
        const company = after.company
        return {
          user: {
            id: authUser.id,
            email: authUser.email ?? '',
            companyId: after.company_id,
            companyName: after.company_name ?? 'LoftDesk Workspace',
            role: (after.membership_role as DemoRole) ?? 'owner',
            plan: ((company?.plan as SessionUser['plan']) ?? 'free'),
            fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Użytkownik',
          },
        }
      }
    }
  } catch {
    // bootstrap may fail (already bootstrapped, or function not yet applied) — fall through
  }

  // Fully anonymous / edge case — render as logged-out
  return { user: null }
}
