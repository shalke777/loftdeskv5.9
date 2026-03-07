import type { DemoRole } from '@/shared/lib/demoDb'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'

export const settingsApi = {
  async profile(companyId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.companyProfile(companyId))
    const scope = await getDataScope(companyId)
    if (scope.mode === 'multi-tenant') {
      const { data, error } = await supabase.from('companies').select('*').eq('id', scope.companyId).maybeSingle()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', scope.userId).maybeSingle()
    if (error) throw error
    return data
  },
  async updateProfile(companyId: string, input: { company_name: string; ksef_env: 'test' | 'prod'; ksef_nip: string; ksef_token: string }) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.companyProfileUpdate(companyId, input))
    const scope = await getDataScope(companyId)
    if (scope.mode === 'multi-tenant') {
      const { data, error } = await supabase.from('companies').update({ name: input.company_name, ksef_env: input.ksef_env, ksef_nip: input.ksef_nip || null, ksef_token: input.ksef_token || null }).eq('id', scope.companyId).select('*').single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('profiles').update({ company: input.company_name, ksef_env: input.ksef_env, ksef_nip: input.ksef_nip, ksef_token: input.ksef_token }).eq('id', scope.userId).select('*').single()
    if (error) throw error
    return data
  },
  async team(companyId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.members.list(companyId))
    const scope = await getDataScope(companyId)
    if (scope.mode === 'multi-tenant') {
      const { data, error } = await supabase.from('company_members').select('role, user_id, profiles!company_members_user_id_fkey(id, email, full_name), companies!inner(name, plan)').eq('company_id', scope.companyId)
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
    const { data: profile } = await supabase.from('profiles').select('id, email, full_name, company, plan, ksef_env, ksef_nip, ksef_token').eq('id', scope.userId).maybeSingle()
    return profile ? [{ id: profile.id, email: profile.email, full_name: profile.full_name, company_id: companyId, company_name: profile.company, role: 'owner', plan: profile.plan, ksef_env: profile.ksef_env, ksef_nip: profile.ksef_nip, ksef_token: profile.ksef_token }] : []
  },

  async invitations(companyId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.list(companyId))
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') return []
    const { data, error } = await supabase.from('company_invitations').select('*').eq('company_id', scope.companyId).order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  async inviteMember(input: { companyId: string; email: string; role: DemoRole }) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.invite(input.companyId, null, input.email, input.role))
    const scope = await getDataScope(input.companyId)
    if (scope.mode !== 'multi-tenant') {
      throw new Error('Zapraszanie członków wymaga migracji companies/company_members i istniejących użytkowników.')
    }
    const token = `invite-${Math.random().toString(36).slice(2, 12)}`
    const { data, error } = await supabase.from('company_invitations').insert({ company_id: scope.companyId, email: input.email.toLowerCase(), role: input.role, token }).select('*').single()
    if (error) throw error
    return data
  },
  async revokeInvitation(companyId: string, invitationId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.revoke(invitationId))
    const scope = await getDataScope(companyId)
    if (scope.mode !== 'multi-tenant') throw new Error('Revoke invitation wymaga company_invitations.')
    const { error } = await supabase.from('company_invitations').update({ status: 'revoked' }).eq('company_id', scope.companyId).eq('id', invitationId)
    if (error) throw error
    return true
  },
  async pendingInvitationsByEmail(email: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.pendingByEmail(email))
    const { data, error } = await supabase.from('company_invitations').select('*, companies(name)').eq('email', email.toLowerCase()).eq('status', 'pending').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  async acceptInvitation(token: string, email?: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invitations.accept(token, email))
    const { data: invite, error: inviteError } = await supabase.from('company_invitations').select('*').eq('token', token).eq('status', 'pending').maybeSingle()
    if (inviteError) throw inviteError
    if (!invite) throw new Error('Zaproszenie nie istnieje albo wygasło.')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    const authUser = authData.user
    if (!authUser) throw new Error('Zaloguj się, aby przyjąć zaproszenie.')
    const { error: memberError } = await supabase.from('company_members').upsert({ company_id: invite.company_id, user_id: authUser.id, role: invite.role }, { onConflict: 'company_id,user_id' })
    if (memberError) throw memberError
    const { error: updateError } = await supabase.from('company_invitations').update({ status: 'accepted' }).eq('id', invite.id)
    if (updateError) throw updateError
    return true
  },
}
