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

  // ── Sprawdź company_members NAJPIERW — operatorzy mają priorytet ─────────
  // UWAGA: client_accounts może zawierać email operatora jeśli ktoś wysłał mu
  // dokument przez portal. Sprawdzamy company_members najpierw, żeby operator
  // nie dostał roli 'client' przez pomyłkę.
  let { data: memberRow } = await supabase
    .from('company_members')
    .select('company_id, role, companies(name, plan)')
    .eq('user_id', authUser.id)
    .limit(1)
    .maybeSingle()

  if (!memberRow) {
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

  // ── Sprawdź czy to konto klienta (v6.0) — tylko jeśli brak rekordu operatora ──
  // Sprawdzamy client_accounts NA KOŃCU: użytkownik bez company_members i profiles
  // jest dopiero wtedy traktowany jako klient portalu.
  const { data: clientAccount } = await supabase
    .from('client_accounts')
    .select('id, company_id, email, full_name')
    .eq('auth_user_id', authUser.id)
    .limit(1)
    .maybeSingle()

  if (clientAccount) {
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
