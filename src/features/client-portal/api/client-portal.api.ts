// =============================================================================
// client-portal.api.ts — API dla zalogowanego klienta (v6.0)
// =============================================================================
// Używa bezpośrednich zapytań Supabase z JWT klienta.
// RLS (migr. 042) ogranicza dostęp do projektów z project_client_access.
// BEZPIECZEŃSTWO: seller data (marże, expense_invoices) nigdy nie jest tutaj pobierana.
// =============================================================================

import { supabase } from '@/shared/lib/supabase'

export interface ClientProject {
  id: string
  company_id: string
  number: string
  name: string
  status: 'offer' | 'active' | 'done' | 'cancelled'
  address?: string | null
  investment_address?: string | null
  start_date?: string | null
  end_date?: string | null
  created_at: string
}

export interface ClientEstimate {
  id: string
  number: string
  name: string
  status: string
  total_net: number
  total_gross: number
  notes?: string | null
  valid_until?: string | null
  created_at: string
}

export interface ClientInvoice {
  id: string
  number: string
  status: string
  issue_date: string
  due_date?: string | null
  total_gross: number
  notes?: string | null
}

export interface ClientContract {
  id: string
  number: string
  name: string
  status: string
  start_date?: string | null
  end_date?: string | null
  value_net?: number | null
  created_at: string
}

export interface ClientMessage {
  id: string
  body: string
  sender_type: 'operator' | 'client' | 'system'
  sender_name: string | null
  created_at: string
  read_by_client: boolean
}

export interface ClientApproval {
  id: string
  snapshot_vendor?: string | null
  snapshot_description?: string | null
  snapshot_amount_gross?: number | null
  message_to_client?: string | null
  status: string
  created_at: string
}

export const clientPortalApi = {
  // SECURITY: pass companyId explicitly — never read from session inside API.
  // This adds a defence-in-depth company_id filter on top of RLS so that:
  //   a) a client whose email exists in multiple companies only sees their own company's projects
  //   b) if migration 042 / my_client_project_ids() is absent, we still filter correctly
  async listProjects(companyId: string): Promise<ClientProject[]> {
    if (!supabase || !companyId || companyId === 'demo-company') return []
    const { data, error } = await supabase
      .from('projects')
      .select('id, company_id, number, name, status, address, investment_address, start_date, end_date, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientProject[]
  },

  // SECURITY: also scope getProject by company_id to prevent UUID-guessing attacks.
  async getProject(projectId: string, companyId: string): Promise<ClientProject | null> {
    if (!supabase || !companyId || companyId === 'demo-company') return null
    const { data, error } = await supabase
      .from('projects')
      .select('id, company_id, number, name, status, address, investment_address, start_date, end_date, created_at')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) throw error
    return data as ClientProject | null
  },

  async listEstimates(projectId: string): Promise<ClientEstimate[]> {
    if (!supabase) return []
    // Brak: internal_cost, margin — RLS + selektywny select
    const { data, error } = await supabase
      .from('cost_estimates')
      .select('id, number, name, status, total_net, total_gross, notes, valid_until, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientEstimate[]
  },

  async listInvoices(projectId: string): Promise<ClientInvoice[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('invoices')
      .select('id, number, status, issue_date, due_date, total_gross, notes')
      .eq('project_id', projectId)
      .order('issue_date', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientInvoice[]
  },

  async listContracts(projectId: string): Promise<ClientContract[]> {
    if (!supabase) return []
    // Kontrakty nie mają project_id — łączymy przez estimate_id
    const estimates = await clientPortalApi.listEstimates(projectId)
    if (!estimates.length) return []
    const estimateIds = estimates.map((e) => e.id)
    const { data, error } = await supabase
      .from('contracts')
      .select('id, number, name, status, start_date, end_date, value_net, created_at')
      .in('estimate_id', estimateIds)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientContract[]
  },

  async listMessages(projectId: string): Promise<ClientMessage[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('project_messages')
      .select('id, body, sender_type, sender_name, created_at, read_by_client')
      .eq('project_id', projectId)
      .in('visibility', ['client_shared', 'approval'])
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as ClientMessage[]
  },

  async sendMessage(projectId: string, companyId: string, body: string, senderName: string): Promise<void> {
    if (!supabase) return
    // project_messages.thread_id is NOT NULL — find the client_shared thread first.
    // Operator creates threads; client can SELECT but not INSERT them.
    const { data: thread, error: threadError } = await supabase
      .from('project_threads')
      .select('id')
      .eq('project_id', projectId)
      .eq('visibility', 'client_shared')
      .eq('archived', false)
      .limit(1)
      .maybeSingle()
    if (threadError) throw threadError
    if (!thread) throw new Error('Wykonawca nie otworzył jeszcze wątku czatu dla tego projektu. Spróbuj ponownie za chwilę lub skontaktuj się z wykonawcą.')
    const { error } = await supabase.from('project_messages').insert({
      thread_id:      thread.id,
      project_id:     projectId,
      company_id:     companyId,
      body:           body.trim(),
      sender_type:    'client',
      sender_name:    senderName,
      visibility:     'client_shared',
      read_by_client: true,
    })
    if (error) throw error
  },

  async listApprovals(projectId: string): Promise<ClientApproval[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('cost_approvals')
      .select('id, snapshot_vendor, snapshot_description, snapshot_amount_gross, message_to_client, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientApproval[]
  },

  async respondApproval(approvalId: string, status: 'accepted' | 'rejected' | 'questioned', comment?: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase
      .from('cost_approvals')
      .update({ status, client_comment: comment ?? null, responded_at: new Date().toISOString() })
      .eq('id', approvalId)
    if (error) throw error
  },

  async getMyAccount(): Promise<{ id: string; email: string; full_name: string | null; phone: string | null } | null> {
    if (!supabase) return null
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return null
    const { data, error } = await supabase
      .from('client_accounts')
      .select('id, email, full_name, phone')
      .eq('auth_user_id', authData.user.id)
      .single()
    if (error) return null
    return data
  },

  async updateMyAccount(fields: { full_name?: string; phone?: string }): Promise<void> {
    if (!supabase) return
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) throw new Error('Brak sesji')
    const { error } = await supabase
      .from('client_accounts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('auth_user_id', authData.user.id)
    if (error) throw error
  },
}
