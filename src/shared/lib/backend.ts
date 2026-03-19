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

  // ── Sprawdź company_members i client_accounts RÓWNOLEGLE ─────────────────
  // WAŻNE: operator (company_members) MA ZAWSZE PIERWSZEŃSTWO nad client_accounts.
  // Jeśli użytkownik jest w obu tabelach (np. operator testował zaproszenie
  // własnym mailem), musi wchodzić jako operator, nie jako klient.
  const [memberResult, clientByRpc] = await Promise.all([
    supabase
      .from('company_members')
      .select('company_id, role, companies(name, plan)')
      .eq('user_id', authUser.id)
      .limit(1)
      .maybeSingle(),
    supabase.rpc('resolve_my_client_account').maybeSingle(),
  ])

  // Operator — company_members ma pierwszeństwo
  let memberRow = memberResult.data

  // ── Guard: client_accounts vs company_members priority ──────────────────────
  // Przypadki:
  //   A) Prawdziwy klient z bootstrap-ghost company:
  //      company_members.company_id = X (ghost), client_accounts.company_id = Y (operator)
  //      → różne company_id → wyczyść memberRow → rola 'client'
  //
  //   B) Operator testujący własne zaproszenie swoim mailem:
  //      company_members.company_id = Y (prawdziwa firma operatora)
  //      client_accounts.company_id = Y (zaproszenie do własnej firmy)
  //      → ten sam company_id → zostaje operatorem
  //
  //   C) Klient bez żadnego company_members → memberRow = null → wpada w ścieżkę klienta niżej
  if (memberRow) {
    const { data: clientByRpcData } = clientByRpc

    // Pobierz client_accounts z company_id — RPC (migration 054) lub bezpośrednio
    let clientAccountCompanyId: string | null = null
    if (clientByRpcData && typeof clientByRpcData === 'object' && 'company_id' in (clientByRpcData as object)) {
      clientAccountCompanyId = (clientByRpcData as { company_id: string }).company_id
    } else {
      const { data: directLookup } = await supabase
        .from('client_accounts')
        .select('id, company_id')
        .eq('auth_user_id', authUser.id)
        .limit(1)
        .maybeSingle()
      clientAccountCompanyId = directLookup?.company_id ?? null
    }

    if (clientAccountCompanyId && clientAccountCompanyId !== memberRow.company_id) {
      // Różne firmy → company_members to artefakt bootstrap → traktuj jako klient
      memberRow = null
    }
    // Ten sam company_id lub brak client_accounts → zostaje operatorem
  }

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
    // Użytkownik jest operatorem — ignorujemy client_accounts całkowicie
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
