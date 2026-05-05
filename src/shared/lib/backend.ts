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

  // Read + clear the company switch hint set after invitation acceptance.
  // This ensures the session resolves to the invited company, not the ghost
  // bootstrap company that was created on first registration.
  const switchHint =
    typeof window !== 'undefined'
      ? (localStorage.getItem('loftdesk-company-switch-hint') ?? null)
      : null
  if (switchHint && typeof window !== 'undefined') {
    localStorage.removeItem('loftdesk-company-switch-hint')
  }

  // ── Sprawdź company_members i client_accounts RÓWNOLEGLE ─────────────────
  // WAŻNE: operator (company_members) MA ZAWSZE PIERWSZEŃSTWO nad client_accounts.
  //
  // CRITICAL: The company_members query does NOT join companies() here.
  // Reason: the companies_select RLS policy is `USING (id = my_company_id())`
  // which only covers the ghost/oldest company until migration 150+151 are applied.
  // The PostgREST embedded join would return HTTP 403 for the invited company row,
  // making the ENTIRE query fail → memberRows=[] → falls through to client path.
  //
  // To be resilient, we:
  //   1. Fetch company_members WITHOUT the companies join (never 403s)
  //   2. Pick the active row based on hint / newest
  //   3. Fetch company details for ONLY that row in a second query
  //
  // Query returns ALL memberships (migration 149: members_select_own_rows).
  // Newest first — so that an accepted invitation (most recent) is preferred
  // over the ghost bootstrap company (oldest) when no hint is present.
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

  // Pick the most appropriate membership row:
  //   1. Matches switchHint (explicitly set after invitation acceptance)
  //   2. Newest row (first after ORDER BY created_at DESC)
  const pickedMemberBase =
    (switchHint ? memberRows.find((r) => r.company_id === switchHint) : undefined) ??
    memberRows[0] ??
    null

  // Fetch company details (name, plan) only for the picked company.
  // Done as a SEPARATE query so a companies RLS miss never blocks role resolution.
  let companyDetails: { name: string | null; plan: string | null } | null = null
  if (pickedMemberBase) {
    const { data: cd } = await supabase
      .from('companies')
      .select('name, plan')
      .eq('id', pickedMemberBase.company_id)
      .maybeSingle()
    companyDetails = cd ?? null
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
        user: {
          id: authUser.id,
          email: authUser.email ?? clientAccount.email ?? '',
          companyId: clientAccount.company_id,
          companyName: 'Portal klienta',
          role: 'client' as const,
          plan: 'free' as const,
          fullName: clientAccount.full_name ?? authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Klient',
          // project_id zapisywany przez client-identify.ts via generateLink data — używany do
          // jednorazowego przekierowania na właściwy projekt po zalogowaniu z zaproszenia.
          pendingProjectId: (authUser.user_metadata?.project_id as string | undefined) ?? null,
        },
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
          .limit(1)
          .maybeSingle()
        if (res.data) {
          const { data: cd } = await supabase
            .from('companies')
            .select('name, plan')
            .eq('id', res.data.company_id)
            .maybeSingle()
          memberRow = { ...res.data, companies: cd ?? null }
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
