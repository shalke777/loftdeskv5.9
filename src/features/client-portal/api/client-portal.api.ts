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

export interface ClientEstimateItem {
  id: string
  name: string
  description?: string | null
  unit: string
  quantity: number
  unit_price: number
  vat_rate: number
  sort_order?: number
}

export interface ClientInvoiceItem {
  id: string
  description: string
  unit: string
  quantity: number
  unit_price: number
  vat_rate: number
  sort_order?: number
  tranche_label?: string | null
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
  items?: ClientEstimateItem[]
}

export interface ClientInvoice {
  id: string
  number: string
  invoice_type?: string | null
  status: string
  issue_date: string
  sale_date?: string | null
  issue_place?: string | null
  due_date?: string | null
  payment_method?: string | null
  bank_account?: string | null
  advance_total?: number | null
  ksef_status?: string | null
  ksef_ref?: string | null
  total_gross?: number | null
  notes?: string | null
  items?: ClientInvoiceItem[]
}

export interface ClientContract {
  id: string
  number: string
  name?: string | null
  status: string
  sign_date?: string | null
  start_date?: string | null
  end_date?: string | null
  location?: string | null
  value?: number | null
  value_net?: number | null
  vat_rate?: number | null
  template_name?: string | null
  template_content?: string | null
  tranches?: unknown
  custom_paragraphs?: unknown
  notes?: string | null
  created_at: string
}

export interface ClientMessage {
  id: string
  body: string
  sender_type: 'operator' | 'client' | 'system'
  sender_name: string | null
  created_at: string
  read_by_client: boolean
  deleted_at: string | null
}

export interface ClientApproval {
  id: string
  status: string
  snapshot_vendor?: string | null
  snapshot_description?: string | null
  snapshot_amount_gross?: number | null
  snapshot_invoice_number?: string | null
  message_to_client?: string | null
  client_comment?: string | null
  sent_at?: string | null
  responded_at?: string | null
  created_at: string
}

export interface ClientDocSignatureRequest {
  id: string
  company_id: string
  project_id: string | null
  document_type: string
  document_id: string
  document_label: string | null
  document_hash: string
  status: string
  mode: string
  created_at: string
  participants: Array<{
    id: string
    name: string
    email: string
    role: string
    status: string
    client_account_id: string | null
    action_at: string | null
  }>
}

export interface ClientProjectDocument {
  id: string
  doc_type: string
  doc_id: string
  created_at: string
}

export interface ClientPhotoDoc {
  id: string
  title: string
  category: string
  image_url: string | null
  note: string | null
  taken_at: string | null
  created_at?: string
}

export interface ClientTimelineEvent {
  id: string
  body: string
  event_type: string
  created_at: string
}

export const clientPortalApi = {
  async listProjects(): Promise<ClientProject[]> {
    if (!supabase) return []
    // RLS na project_client_access filtruje automatycznie przez my_client_project_ids()
    const { data, error } = await supabase
      .from('projects')
      .select('id, company_id, number, name, status, address, investment_address, start_date, end_date, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientProject[]
  },

  async getProject(projectId: string): Promise<ClientProject | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('projects')
      .select('id, company_id, number, name, status, address, investment_address, start_date, end_date, created_at')
      .eq('id', projectId)
      .single()
    if (error) throw error
    return data as ClientProject
  },

  async listEstimates(projectId: string): Promise<ClientEstimate[]> {
    if (!supabase) return []
    // Brak: internal_cost, margin — RLS + selektywny select
    const { data, error } = await supabase
      .from('cost_estimates')
      .select('id, number, name, status, total_net, total_gross, notes, valid_until, created_at, items:cost_estimate_items(id, name, description, unit, quantity, unit_price, vat_rate, sort_order)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientEstimate[]
  },

  async listInvoices(projectId: string): Promise<ClientInvoice[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('invoices')
      .select('id, number, invoice_type, status, issue_date, sale_date, issue_place, due_date, payment_method, bank_account, advance_total, ksef_status, ksef_ref, notes, items:invoice_items(id, description, unit, quantity, unit_price, vat_rate, sort_order, tranche_label)')
      .eq('project_id', projectId)
      .order('issue_date', { ascending: false })
    if (error) throw error
    // total_gross is not stored on invoices — compute from items
    return (data ?? []).map((row: any) => {
      const items = (row.items ?? []) as ClientInvoiceItem[]
      const gross = Math.round(
        items.reduce((s, it) =>
          s + Number(it.quantity) * Number(it.unit_price) * (1 + Number(it.vat_rate ?? 23) / 100), 0
        ) * 100,
      ) / 100
      return { ...row, total_gross: gross > 0 ? gross : null } as ClientInvoice
    })
  },

  async listContracts(projectId: string): Promise<ClientContract[]> {
    if (!supabase) return []
    // Primary path: contracts with direct project_id (most reliable, matches operator view)
    const { data: byProject, error: err1 } = await supabase
      .from('contracts')
      .select('id, number, status, sign_date, start_date, end_date, location, value, value_net, vat_rate, template_name, template_content, tranches, custom_paragraphs, notes, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (err1) throw err1
    const direct = (byProject ?? []) as ClientContract[]
    const directIds = new Set(direct.map((c) => c.id))
    // Fallback: contracts linked via estimate_id (legacy data where project_id wasn't set)
    try {
      const estimates = await clientPortalApi.listEstimates(projectId)
      if (!estimates.length) return direct
      const estimateIds = estimates.map((e) => e.id)
      const { data: viaEst } = await supabase
        .from('contracts')
        .select('id, number, status, sign_date, start_date, end_date, location, value, value_net, vat_rate, template_name, template_content, tranches, custom_paragraphs, notes, created_at')
        .in('estimate_id', estimateIds)
        .order('created_at', { ascending: false })
      const merged = [
        ...direct,
        ...(viaEst ?? []).filter((c: any) => !directIds.has(c.id)),
      ]
      return merged as ClientContract[]
    } catch {
      // Fallback query failed — return what we have from direct project_id query
      return direct
    }
  },

  async listMessages(projectId: string): Promise<ClientMessage[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('project_messages')
      .select('id, body, sender_type, sender_name, created_at, read_by_client, deleted_at')
      .eq('project_id', projectId)
      .in('visibility', ['client_shared', 'approval'])
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as ClientMessage[]
  },

  async sendMessage(projectId: string, companyId: string, body: string, senderName: string): Promise<void> {
    if (!supabase) return
    // Uses SECURITY DEFINER RPC (migration 062) — direct INSERT fails because
    // project_messages.thread_id is NOT NULL and clients cannot INSERT into
    // project_threads (no policy). The RPC finds or auto-creates the thread.
    const { error } = await supabase.rpc('client_send_message', {
      p_project_id:  projectId,
      p_company_id:  companyId,
      p_body:        body.trim(),
      p_sender_name: senderName,
    })
    if (error) throw error
  },

  async deleteMessage(messageId: string): Promise<void> {
    if (!supabase) return
    const { error } = await supabase.rpc('delete_portal_message', {
      p_message_id: messageId,
    })
    if (error) throw error
  },

  async listApprovals(projectId: string): Promise<ClientApproval[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('cost_approvals')
      .select('id, status, snapshot_vendor, snapshot_description, snapshot_amount_gross, snapshot_invoice_number, message_to_client, client_comment, sent_at, responded_at, created_at')
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

  async listProjectDocuments(projectId: string): Promise<ClientProjectDocument[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('project_documents')
      .select('id, doc_type, doc_id, created_at')
      .eq('project_id', projectId)
      .is('archived_at', null)
      // Exclude domain entities already shown in their own sections (Wyceny/Umowy/Faktury).
      // project_documents is a junction table — it stores refs to ALL doc types including
      // estimate/contract/invoice. Without this filter they would appear twice in the portal.
      .not('doc_type', 'in', '(estimate,contract,invoice)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientProjectDocument[]
  },

  async listPhotoDocs(projectId: string): Promise<ClientPhotoDoc[]> {
    if (!supabase) return []
    // NOTE: created_at is excluded — the column was not present in migration 017
    // (the table was created without it). Ordering uses taken_at instead.
    // Migration 067 adds the column; re-add created_at to the select after that runs.
    const { data, error } = await supabase
      .from('project_photo_docs')
      .select('id, title, category, image_url, note, taken_at')
      .eq('project_id', projectId)
      .order('taken_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as ClientPhotoDoc[]
  },

  async listTimelineEvents(projectId: string): Promise<ClientTimelineEvent[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('project_timeline_events')
      .select('id, body, event_type, created_at')
      .eq('project_id', projectId)
      .eq('visibility', 'client_shared')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []) as ClientTimelineEvent[]
  },

  /** List pending/active document signature requests visible to the authenticated client */
  async listDocSignatureRequests(projectId: string): Promise<ClientDocSignatureRequest[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('signature_requests')
      .select('id, company_id, project_id, document_type, document_id, document_label, document_hash, status, mode, created_at, signature_participants(id, name, email, role, status, client_account_id, action_at)')
      .eq('project_id', projectId)
      .not('status', 'in', '(cancelled,expired)')
      .order('created_at', { ascending: false })
    if (error) {
      // Table may not exist yet — fail silently
      console.warn('[clientPortal] listDocSignatureRequests failed:', error.message)
      return []
    }
    const rows = ((data ?? []) as any[]).map(row => ({
      ...row,
      participants: row.signature_participants ?? [],
    })) as ClientDocSignatureRequest[]

    // Deduplicate: if the same document was sent to approval more than once (without
    // cancelling the previous request), only show the most-recent request.
    // The query orders by created_at DESC, so the first occurrence per key is the latest.
    const seen = new Set<string>()
    return rows.filter(r => {
      const key = `${r.document_type}:${r.document_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  },

  /** Client approves / rejects / questions a document */
  async respondDocApproval(input: {
    signatureRequestId: string
    participantId: string
    decision: 'approved' | 'rejected' | 'questioned'
    documentHash: string
    documentType: string
    documentId: string
    documentLabel?: string | null
    companyId: string
    projectId: string | null
    actorId: string
    actorName: string | null
    actorEmail: string | null
    consentText: string
    comment?: string
  }): Promise<void> {
    if (!supabase) throw new Error('Supabase not available')

    // 1. Record approval_event (RLS allows client INSERT with actor_id = auth.uid())
    const { error: evtErr } = await supabase
      .from('approval_events')
      .insert({
        company_id:           input.companyId,
        project_id:           input.projectId,
        signature_request_id: input.signatureRequestId,
        document_type:        input.documentType,
        document_id:          input.documentId,
        document_hash:        input.documentHash,
        actor_type:           'client' as const,
        actor_id:             input.actorId,
        actor_name:           input.actorName,
        actor_email:          input.actorEmail,
        actor_ip:             null,
        actor_user_agent:     typeof navigator !== 'undefined' ? navigator.userAgent : null,
        consent_text:         input.consentText,
        otp_verified_at:      null,
        decision:             input.decision,
        comment:              input.comment ?? null,
      })
    if (evtErr) throw evtErr

    // 2. Update signature_participants.status (only for final decisions)
    // Skip 'questioned' — a question is not a final decision, the participant remains
    // 'pending' and can still approve or reject after the conversation.
    // This also avoids a potential CHECK constraint failure on older DB instances
    // where 'questioned' may not have been added to the status enum.
    if (input.decision !== 'questioned') {
      const { error: partErr } = await supabase
        .from('signature_participants')
        .update({ status: input.decision, action_at: new Date().toISOString() })
        .eq('id', input.participantId)
      if (partErr) throw partErr
    }

    // 3. If questioned: auto-create or find message thread and post the question
    //    client_send_message (migration 062) handles find-or-create + fires trigger 070
    if (input.decision === 'questioned' && input.projectId) {
      const docLabel = input.documentLabel?.trim() || input.documentType
      const body = input.comment?.trim()
        ? `Mam pytanie dot. dokumentu „${docLabel}”: ${input.comment.trim()}`
        : `Zadałem/am pytanie dot. dokumentu „${docLabel}”. Proszę o kontakt.`
      const { error: threadErr } = await supabase.rpc('client_send_message', {
        p_project_id:  input.projectId,
        p_company_id:  input.companyId,
        p_body:        body,
        p_sender_name: input.actorName ?? 'Klient',
      })
      if (threadErr) {
        // Non-fatal: approval_event was already recorded above
        console.warn('[clientPortal] auto-thread for questioned failed:', threadErr.message)
      }
    }
    // Trigger 073 auto-updates signature_requests.status server-side
  },
}
