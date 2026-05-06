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

const OWNER_OVERRIDE_EMAIL = 'loftbau@gmail.com'

/** Applies full business-unlimited access for the designated owner account. */
function applyOwnerOverride(user: SessionUser): SessionUser {
  if (user.email !== OWNER_OVERRIDE_EMAIL) return user
  return {
    ...user,
    role: 'owner' as DemoRole,
    plan: 'business',
    isOwnerOverride: true,
  }
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

  // ── Sprawdź company_members i client_accounts RÓWNOLEGLE ─────────────────
  // OPERATOR-ALWAYS-WINS rule: any row in company_members → role is operator.
  // DB is the only source of truth — no localStorage hints, no client fallback.
  //
  // Membership query is decoupled from companies() embedded join — RLS misses
  // on a single company would otherwise 403 the entire query (PostgREST quirk).
  // Newest membership wins via ORDER BY created_at DESC.
  const [memberResult, clientByRpc] = await Promise.all([
    supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('resolve_my_client_account').maybeSingle(),
  ])

  if (memberResult.error && import.meta.env.DEV) {
    console.warn('[backend] company_members query error', memberResult.error)
  }

  // SECURITY RULE: operator (company_members) ALWAYS wins over client_accounts.
  // If the user has ANY row in company_members they are an operator — full stop.
  const memberRows = memberResult.data ?? []
  const isOperator = memberRows.length > 0

  // Newest membership wins. DB is source of truth — no hints, no fallbacks.
  const pickedMemberBase = memberRows[0] ?? null

  console.log('[DEBUG MEMBERS]', memberRows)
  console.log('[DEBUG ACTIVE COMPANY]', pickedMemberBase?.company_id ?? null)
  if (pickedMemberBase) {
    console.log('[auth] active membership:', pickedMemberBase.company_id)
  }

  // Fetch company details (name, plan) via SECURITY DEFINER RPC (migration 153).
  // Direct SELECT on companies returns 403 when RLS policy is missing/unapplied.
  // The RPC function bypasses RLS and always returns the caller's company row.
  let companyDetails: { name: string | null; plan: string | null } | null = null
  if (pickedMemberBase) {
    const { data: cd } = await supabase
      .rpc('get_my_company_billing')
      .maybeSingle()
    companyDetails = cd ? { name: (cd as any).name ?? null, plan: (cd as any).plan ?? null } : null
  }

  const pickedMember = pickedMemberBase
    ? { ...pickedMemberBase, companies: companyDetails }
    : null

  let memberRow: typeof pickedMember | null = isOperator ? pickedMember : null

  if (!memberRow) {
    // ── Sprawdź client_accounts PRZED bootstrap ───────────────────────────────
    // KLUCZOWE: ten check MUSI być przed bootstrap_my_company.
    // Bez tego: klient nie ma wiersza w company_members → bootstrap tworzy firmę
    // → memberRow jest ustawiany → klient wraca jako role:'owner' → LegalAcceptanceGate.
    const { data: clientByRpcData, error: rpcError } = clientByRpc

    const clientAccount = ((!rpcError && clientByRpcData)
      ? clientByRpcData
      : await supabase
          .from('client_accounts')
          .select('id, company_id, email, full_name')
          .eq('auth_user_id', authUser.id)
          .limit(1)
          .maybeSingle()
          .then(r => r.data)) as { id: string; company_id: string; email: string | null; full_name: string | null } | null

    if (clientAccount) {
      if (import.meta.env.DEV) {
        console.info('CLIENT_PORTAL_AUTH_CALLBACK', {
          method: (!rpcError && clientByRpcData) ? 'rpc' : 'auth_user_id_direct',
          userId: authUser.id,
        })
      }
      return {
        user: applyOwnerOverride({
          id: authUser.id,
          email: authUser.email ?? clientAccount.email ?? '',
          companyId: clientAccount.company_id,
          companyName: 'Portal klienta',
          role: 'client' as const,
          plan: 'free' as const,
          fullName: clientAccount.full_name ?? authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Klient',
          pendingProjectId: (authUser.user_metadata?.project_id as string | undefined) ?? null,
        }),
      }
    }

    // Nie jest klientem — metadata guard blokuje bootstrap dla błędnych zaproszeń
    if (authUser.user_metadata?.client_account_id) {
      if (import.meta.env.DEV) {
        console.warn('[backend] metadata_guard — client_account_id w metadata ale brak rekordu w client_accounts', { userId: authUser.id })
      }
      return { user: null }
    }

    try {
      const { data: bootstrapCompanyId } = await supabase.rpc('bootstrap_my_company', { company_name: '', company_nip: '' })
      if (bootstrapCompanyId) {
        const res = await supabase
          .from('company_members')
          .select('company_id, role')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (res.data) {
          const { data: cd } = await supabase.rpc('get_my_company_billing').maybeSingle()
          memberRow = { ...res.data, companies: cd ? { name: (cd as any).name ?? null, plan: (cd as any).plan ?? null } : null }
        }
      }
    } catch {
      // bootstrap may fail if function not yet granted — fall through to profile path
    }
  }

  if (memberRow) {
    // Użytkownik jest operatorem — ignorujemy client_accounts całkowicie
    const companies = memberRow.companies
    return {
      user: applyOwnerOverride({
        id: authUser.id,
        email: authUser.email ?? '',
        companyId: memberRow.company_id,
        companyName: companies?.name ?? 'LoftDesk Workspace',
        role: (memberRow.role as DemoRole) ?? 'worker',
        plan: (companies?.plan as SessionUser['plan']) ?? 'free',
        fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Użytkownik',
      }),
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
      user: applyOwnerOverride({
        id: profileRow.id,
        email: profileRow.email || authUser.email || '',
        companyId: profileRow.id,
        companyName: profileRow.company || profileRow.full_name || 'LoftDesk Workspace',
        role: roleFromLegacyPlan(profileRow.plan),
        plan,
        fullName: profileRow.full_name || authUser.email?.split('@')[0] || 'Użytkownik',
      }),
    }
  }

  return {
    user: applyOwnerOverride({
      id: authUser.id,
      email: authUser.email ?? '',
      companyId: authUser.id,
      companyName: authUser.email?.split('@')[0] ?? 'LoftDesk Workspace',
      role: 'owner',
      plan: 'free',
      fullName: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Użytkownik',
    }),
  }
}
