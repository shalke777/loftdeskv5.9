import type { DemoRole } from '@/shared/lib/demoDb'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'
import { sessionOk, sessionMissing, type SessionResult } from '@/shared/lib/sessionResult'

// Rolling-window timestamp buffer for INVITE_ACCEPT_FAIL rate alerting.
let _inviteFailTimestamps: number[] = []

export const settingsApi = {
  async profile(companyId: string): Promise<SessionResult<unknown>> {
    if (isDemoMode || !supabase) return sessionOk(demoDb.companyProfile(companyId))
    const scope = await getDataScope(companyId)
    if (scope.mode === 'multi-tenant') {
      // Sprint B/C: get_session_context() single authority (migration 155).
      const { data, error } = await supabase.rpc('get_session_context').maybeSingle()
      if (error) throw error
      const company = (data as Record<string, unknown> | null)?.company ?? null
      if (!company) return sessionMissing()
      return sessionOk(company)
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', scope.userId).maybeSingle()
    if (error) throw error
    return sessionOk(data)
  },
  async updateProfile(companyId: string, input: { company_name: string; nip?: string; address?: string; postal_code?: string; city?: string; iban?: string; phone?: string; email?: string; ksef_env: 'test' | 'demo' | 'prod'; ksef_nip: string; ksef_token: string; logo_url?: string | null }) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.companyProfileUpdate(companyId, input))
    const scope = await getDataScope(companyId)
    if (scope.mode === 'multi-tenant') {
      const { data, error } = await supabase.from('companies').update({
        name: input.company_name,
        nip: input.nip || null,
        address: input.address || null,
        postal_code: input.postal_code || null,
        city: input.city || null,
        iban: input.iban || null,
        phone: input.phone || null,
        email: input.email || null,
        ksef_env: input.ksef_env,
        ksef_nip: input.ksef_nip || null,
        ksef_token: input.ksef_token || null,
        ...(input.logo_url !== undefined ? { logo_url: input.logo_url } : {}),
      }).eq('id', scope.companyId).select('*').single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('profiles').update({
      company: input.company_name,
      nip: input.nip || null,
      address: input.address || null,
      postal_code: input.postal_code || null,
      city: input.city || null,
      iban: input.iban || null,
      phone: input.phone || null,
      ksef_env: input.ksef_env,
      ksef_nip: input.ksef_nip || null,
      ksef_token: input.ksef_token || null,
      ...(input.logo_url !== undefined ? { logo_url: input.logo_url } : {}),
    }).eq('id', scope.userId).select('*').single()
    if (error) throw error
    return data
  },
  async team(companyId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.members.list(companyId))
    const scope = await getDataScope(companyId)
    if (scope.mode === 'multi-tenant') {
      const { data, error } = await supabase.from('company_members').select('role, user_id, profiles!company_members_user_id_profiles_fkey(id, email, full_name), companies!inner(name, plan)').eq('company_id', scope.companyId)
      if (error) throw error
      return (data ?? []).map((row: any) => ({
        id: row.user_id,
        email: row.profiles?.email ?? '',
        full_name: row.profiles?.full_name ?? row.profiles?.email ?? 'Użytkownik',
        company_id: scope.companyId,
        company_name: Array.isArray(row.companies) ? row.companies[0]?.name : row.companies?.name,
        role: row.role,
        plan: Array.isArray(row.companies) ? row.companies[0]?.plan : row.companies?.plan,
        ksef_env: 'test',
        ksef_nip: null,
        ksef_token: null,
      }))
    }
    const { data: profile } = await supabase.from('profiles').select('id, email, full_name, company, plan').eq('id', scope.userId).maybeSingle()
    return profile ? [{ id: profile.id, email: profile.email, full_name: profile.full_name, company_id: companyId, company_name: profile.company, role: undefined, plan: profile.plan, ksef_env: 'test', ksef_nip: null, ksef_token: null }] : []
  },

  async invitations(companyId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.list(companyId))
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') return []
    const { data, error } = await supabase.from('company_invitations').select('*').eq('company_id', scope.companyId).order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  async inviteMember(input: { companyId: string; email: string; role: DemoRole }): Promise<SessionResult<unknown>> {
    if (isDemoMode || !supabase) return sessionOk(demoDb.invitations.invite(input.companyId, null, input.email, input.role))
    const scope = await getDataScope(input.companyId)
    if (scope.mode !== 'multi-tenant') {
      return sessionMissing()
    }
    // Cryptographically secure token — 20 bytes = 160-bit entropy (replaces Math.random())
    const arr = new Uint8Array(20)
    if (typeof window !== 'undefined') {
      window.crypto.getRandomValues(arr)
    } else {
      const { randomFillSync } = await import('crypto')
      randomFillSync(arr)
    }
    const token = `invite-${Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')}`
    console.log('[inviteMember] inserting invitation', { companyId: scope.companyId, email: input.email.toLowerCase(), role: input.role })
    const { data, error } = await supabase.from('company_invitations').insert({ company_id: scope.companyId, email: input.email.toLowerCase(), role: input.role, token }).select('*, companies(name)').single()
    if (error) {
      console.error('[inviteMember] insert failed', error)
      throw error
    }
    console.log('[inviteMember] invitation created', { id: (data as { id?: string })?.id, companyId: scope.companyId })

    // Dispatch invitation email (non-fatal — never blocks the invite flow).
    const companyName = (data as Record<string, unknown> & { companies?: { name?: string } })?.companies?.name ?? ''
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/.netlify/functions/send-invitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        email: input.email,
        token,
        role: input.role,
        company_name: companyName,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      }),
    }).catch((err) => console.warn('[inviteMember] email dispatch failed (non-fatal):', err))

    return sessionOk(data)
  },
  async revokeInvitation(companyId: string, invitationId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.revoke(invitationId))
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') throw new Error('Revoke invitation wymaga company_invitations.')
    const { error } = await supabase.from('company_invitations').update({ status: 'revoked' }).eq('company_id', scope.companyId).eq('id', invitationId)
    if (error) throw error
    return true
  },
  async updateMemberRole(companyId: string, userId: string, role: DemoRole) {
    if (isDemoMode || !supabase) return Promise.resolve(true)
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') throw new Error('Requires multi-tenant mode.')
    const { error } = await supabase
      .from('company_members')
      .update({ role })
      .eq('company_id', scope.companyId)
      .eq('user_id', userId)
    if (error) throw error
    return true
  },
  async removeMember(companyId: string, userId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(true)
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') throw new Error('Requires multi-tenant mode.')
    const { error } = await supabase
      .from('company_members')
      .delete()
      .eq('company_id', scope.companyId)
      .eq('user_id', userId)
    if (error) throw error
    return true
  },
  async pendingInvitationsByEmail(email: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.pendingByEmail(email))
    // First attempt: full query with companies(name) join (requires migration 148 RLS policy).
    const { data, error } = await supabase
      .from('company_invitations')
      .select('*, companies(name)')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (!error) return data ?? []
    // Fallback: 403 means the companies join is blocked (invited user, migration 148 not yet
    // applied or company RLS not updated). Return invitations without company name — still functional.
    if ((error as { code?: string }).code === 'PGRST301' || error.message?.includes('permission denied') || error.message?.includes('403')) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('company_invitations')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (fallbackError) throw fallbackError
      return fallback ?? []
    }
    throw error
  },
  async acceptInvitation(token: string, email?: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.accept(token, email))
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!authData.user) throw new Error('Zaloguj się, aby przyjąć zaproszenie.')
    // SECURITY: route through SECURITY DEFINER RPC so privileged roles
    // (admin/manager) bypass the strict members_insert RLS policy (mig 142).
    // IDEMPOTENT: mig 145 makes the RPC safe to call twice — already-accepted
    // tokens heal the membership row and return company_id without error.
    const { data: companyId, error } = await supabase.rpc('accept_company_invitation', { invite_token: token })
    if (error) throw error
    return companyId as string
  },

  /** Verify that the current user has at least one company_members row.
   *  Returns both a boolean flag and the full list of company IDs so callers
   *  can switch to the correct active company without a second query. */
  async verifyMembership(): Promise<{ isMember: boolean; companyIds: string[] }> {
    if (isDemoMode || !supabase) return { isMember: true, companyIds: [] }
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return { isMember: false, companyIds: [] }
    const { data, error } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    const companyIds = (data ?? []).map((r: { company_id: string }) => r.company_id)
    return { isMember: companyIds.length > 0, companyIds }
  },

  /** Fire-and-forget production audit log. Never throws.
   *  Tracks ACCEPT_FAIL rate and emits a console.error alert when the
   *  failure rate exceeds FAIL_ALERT_THRESHOLD within FAIL_WINDOW_MS. */
  async logInviteEvent(
    eventType: 'ACCEPT_START' | 'ACCEPT_SUCCESS' | 'ACCEPT_FAIL' | 'MEMBERSHIP_VERIFIED' | 'MEMBERSHIP_MISSING',
    tokenHash: string,
    errorReason?: string,
  ): Promise<void> {
    // In-memory rolling window for ACCEPT_FAIL rate alerting.
    const FAIL_WINDOW_MS    = 60_000  // 60 seconds
    const FAIL_ALERT_THRESHOLD = 3    // failures within window before alert

    if (eventType === 'ACCEPT_FAIL') {
      const now = Date.now()
      // Trim old entries outside the window then push current timestamp.
      _inviteFailTimestamps = _inviteFailTimestamps.filter(t => now - t < FAIL_WINDOW_MS)
      _inviteFailTimestamps.push(now)
      if (_inviteFailTimestamps.length >= FAIL_ALERT_THRESHOLD) {
        console.error(
          `[invite] ALERT: ${_inviteFailTimestamps.length} INVITE_ACCEPT_FAIL events in last ${FAIL_WINDOW_MS / 1000}s — ` +
          'investigate token validity, RLS, or DB availability.',
          { errorReason, tokenHash },
        )
      }
    }

    if (isDemoMode || !supabase) return
    try {
      const { data: auth } = await supabase.auth.getUser()
      await supabase.from('invite_accept_events').insert({
        user_id:      auth.user?.id ?? null,
        token_hash:   tokenHash,
        event_type:   eventType,
        error_reason: errorReason ?? null,
      })
    } catch { /* non-critical — never surface logging failures */ }
  },

  async getDocNumberConfig(companyId: string): Promise<DocNumberConfig | null> {
    if (isDemoMode || !supabase) return null
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') return null
    // Sprint B/C: get_session_context() single authority (migration 155).
    const { data, error } = await supabase.rpc('get_session_context').maybeSingle()
    if (error) throw error
    const company = (data as Record<string, unknown> | null)?.company as Record<string, unknown> | null
    return (company?.doc_number_config as DocNumberConfig) ?? null
  },

  async updateDocNumberConfig(companyId: string, config: DocNumberConfig): Promise<void> {
    if (isDemoMode || !supabase) return
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') return
    // .select('id').maybeSingle() exposes both RLS errors AND "0 rows matched" (silent failure
    // in Supabase when update returns no data) — both surface as thrown errors, not false success.
    const { data, error } = await supabase.from('companies').update({ doc_number_config: config }).eq('id', scope.companyId).select('id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Konfiguracja numeracji nie została zapisana. Sprawdź uprawnienia do firmy.')
  },

  async resetDocCounter(companyId: string, docType: string, year: number, month: number, value: number): Promise<{ docType: string; year: number; month: number; value: number }> {
    if (isDemoMode || !supabase) return { docType, year, month, value }
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') return { docType, year, month, value }
    const { error } = await supabase.rpc('reset_doc_counter', {
      p_company_id: scope.companyId,
      p_doc_type: docType,
      p_year: year,
      p_month: month,
      p_value: value,
    })
    if (error) throw error
    return { docType, year, month, value }
  },
}

export interface DocNumberTypeConfig {
  prefix: string
  start_seq: number
}

export interface DocNumberConfig {
  estimate: DocNumberTypeConfig
  contract: DocNumberTypeConfig
  invoice: DocNumberTypeConfig
}

export const DOC_NUMBER_DEFAULTS: DocNumberConfig = {
  estimate: { prefix: 'WY', start_seq: 1 },
  contract:  { prefix: 'UM', start_seq: 1 },
  invoice:   { prefix: 'FV', start_seq: 1 },
}
