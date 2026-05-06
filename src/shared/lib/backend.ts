import { supabase } from '@/shared/lib/supabase'
import type { DemoRole } from '@/shared/lib/demoDb'
import type { SessionUser } from '@/app/providers'
import { captureSessionContextNull } from '@/shared/lib/monitoring'

export interface ResolvedSession {
  user: SessionUser | null
}

// Sprint B/C: single authority — get_session_context() is the ONLY resolver.
// Session invariant: this function MUST NOT query companies, company_members,
// or client_accounts directly — only via the get_session_context() RPC.
// Migration 155 must be present on the DB.

export async function resolveSupabaseSession(): Promise<ResolvedSession> {
  if (!supabase) return { user: null }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { user: null }
  const authUser = authData.user

  // Single DB roundtrip — migration 155: SECURITY DEFINER, JSONB snapshot.
  const { data: ctx, error: ctxError } = await supabase
    .rpc('get_session_context')
    .maybeSingle()

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
  //
  // INVITE GUARD (DB-only, deterministic):
  //   Backend decisions MUST NOT depend on client state (localStorage).
  //   The single source of truth is `company_invitations` — if a pending
  //   invitation row exists for this user's email, bootstrap is skipped and
  //   LoginForm.finalizeInviteIfNeeded() will create the company_members row
  //   via the SECURITY DEFINER RPC. Page reload after accept → get_session_context()
  //   returns the invited company.
  //
  //   RACE GUARD (DB-side): bootstrap_my_company itself (migration 162) checks for
  //   pending OR recently-accepted invites before creating a company. This is the
  //   authoritative guard — this frontend check is defense-in-depth for pending only.
  //
  //   localStorage inviteIntent remains as a UX hint only (queues tokens for
  //   finalizeInviteIfNeeded), never as a bootstrap gate.
  if (authUser.email) {
    const { data: pendingInvite } = await supabase
      .from('company_invitations')
      .select('id')
      .eq('email', authUser.email)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()
    if (pendingInvite) {
      if (import.meta.env.DEV) {
        console.info('[backend] bootstrap skipped — pending company_invitations row (DB)')
      }
      return { user: null }
    }
  }
  // No DB evidence of a pending invite → attempt bootstrap.
  // bootstrap_my_company (mig 162) has its own invite guard for the race window.

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

  // Fully anonymous / edge case — user is authenticated but has no context.
  // This is an anomaly: SESSION_CONTEXT_NULL is captured to Sentry.
  // NO fallback — fail loud to observability, render as logged-out.
  captureSessionContextNull(authUser.id)
  return { user: null }
}
