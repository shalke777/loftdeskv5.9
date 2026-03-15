import { supabase } from '@/shared/lib/supabase'
import type { DemoRole } from '@/shared/lib/demoDb'
import type { SessionUser } from '@/app/providers'

export interface ResolvedSession {
  user: SessionUser | null
}

function roleFromLegacyPlan(plan?: string | null): DemoRole {
  if (plan === 'admin') return 'admin'
  return 'owner'
}

export async function resolveSupabaseSession(): Promise<ResolvedSession> {
  if (!supabase) return { user: null }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) {
    // No session → treat as logged-out (don't throw)
    return { user: null }
  }
  const authUser = authData.user
  if (!authUser) return { user: null }

  // ── Sprawdź czy to konto klienta (v6.0) ─────────────────────────────────
  // Primary: SECURITY DEFINER RPC (migration 045+). Bypasses RLS — finds
  // client_accounts rows even when auth_user_id IS NULL. The direct query
  // below cannot see those rows: RLS policy "ca_client_select_own" evaluates
  // auth_user_id = auth.uid() = NULL = <uid> = false for unlinked accounts.
  const { data: clientByRpc, error: rpcError } = await supabase
    .rpc('resolve_my_client_account')
    .maybeSingle()

  // Fallback: direct query (works when auth_user_id is already set —
  // guaranteed for all new invites after client-identify.ts fix).
  const clientAccount = (!rpcError && clientByRpc)
    ? clientByRpc
    : await supabase
        .from('client_accounts')
        .select('id, company_id, email, full_name')
        .eq('auth_user_id', authUser.id)
        .limit(1)
        .maybeSingle()
        .then(r => r.data)

  if (clientAccount) {
    if (import.meta.env.DEV) {
      console.info('CLIENT_PORTAL_AUTH_CALLBACK', {
        method: (!rpcError && clientByRpc) ? 'rpc' : 'auth_user_id_direct',
        userId: authUser.id,
      })
    }
    return {
      user: {
        id: authUser.id,
        email: authUser.email ?? clientAccount.email ?? '',
        companyId: clientAccount.company_id,
        companyName: 'Portal klienta',
        role: 'client' as const,
        plan: 'free' as const,
        fullName: clientAccount.full_name ?? authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Klient',
      },
    }
  }

  let { data: memberRow } = await supabase
    .from('company_members')
    .select('company_id, role, companies(name, plan)')
    .eq('user_id', authUser.id)
    .limit(1)
    .maybeSingle()

  if (!memberRow) {
    // ── Metadata guard: blokada bootstrap dla zaproszeń klienckich ─────────────
    // signInWithOtp przekazuje client_account_id w options.data, co Supabase
    // zapisuje w user_metadata. Jeśli to pole jest ustawione, ale ani RPC ani
    // bezpośrednie zapytanie nie znalazło client_accounts (migration 045 jeszcze
    // nie wgrana na produkcji + stare dane z NULL auth_user_id), zwracamy null
    // zamiast tworzyć błędny rekord firmy przez bootstrap_my_company.
    if (authUser.user_metadata?.client_account_id) {
      if (import.meta.env.DEV) {
        console.warn('[backend] CLIENT_PORTAL_AUTH_CALLBACK metadata_guard — klient bez rekordu; uruchom migration 045', { userId: authUser.id })
      }
      return { user: null }
    }

    try {
      const { data: companyId } = await supabase.rpc('bootstrap_my_company', { company_name: '', company_nip: '' })
      if (companyId) {
        const res = await supabase
          .from('company_members')
          .select('company_id, role, companies(name, plan)')
          .eq('user_id', authUser.id)
          .limit(1)
          .maybeSingle()
        memberRow = res.data
      }
    } catch {
      // bootstrap may fail if function not yet granted — fall through to profile path
    }
  }

  if (memberRow) {
    const companies = Array.isArray(memberRow.companies) ? memberRow.companies[0] : memberRow.companies
    return {
      user: {
        id: authUser.id,
        email: authUser.email ?? '',
        companyId: memberRow.company_id,
        companyName: companies?.name ?? 'LoftDesk Workspace',
        role: (memberRow.role as DemoRole) ?? 'worker',
        plan: (companies?.plan as SessionUser['plan']) ?? 'free',
        fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Użytkownik',
      },
    }
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, email, full_name, company, plan')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profileRow) {
    const plan = (profileRow.plan as SessionUser['plan']) || 'free'
    return {
      user: {
        id: profileRow.id,
        email: profileRow.email || authUser.email || '',
        companyId: profileRow.id,
        companyName: profileRow.company || profileRow.full_name || 'LoftDesk Workspace',
        role: roleFromLegacyPlan(profileRow.plan),
        plan,
        fullName: profileRow.full_name || authUser.email?.split('@')[0] || 'Użytkownik',
      },
    }
  }

  return {
    user: {
      id: authUser.id,
      email: authUser.email ?? '',
      companyId: authUser.id,
      companyName: authUser.email?.split('@')[0] ?? 'LoftDesk Workspace',
      role: 'owner',
      plan: 'free',
      fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Użytkownik',
    },
  }
}
