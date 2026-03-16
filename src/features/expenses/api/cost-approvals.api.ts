// =============================================================================
// Cost Approvals API — Operator layer
// =============================================================================
// Manages cost_approvals records on behalf of operators (authenticated users).
// Portal-side responses go through the auth-based client portal (/client/project/:id).
//
// Key rules:
//  - Only one ACTIVE approval per expense (unique idx on expense_id WHERE pending_client)
//  - Operator creates the approval with a snapshot of the expense data at send time
//  - getOrCreateApprovalsThread() ensures max 1 approvals thread per project
//  - All timeline events are fire-and-forget (never block main flow)

import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { createTimelineEvent } from '@/features/projects/lib/timeline'
import type {
  CostApproval,
  ApprovalStatus,
  ProjectThread,
} from '@/features/portal/model/project-portal.types'

export type { CostApproval, ApprovalStatus }

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateApprovalInput {
  /** The expense being sent for approval */
  expense_id:    string
  project_id:    string
  company_id:    string
  /** Message shown to the client alongside the snapshot */
  message_to_client?: string
  /** Snapshot data — captured at send time */
  snapshot_vendor:         string | null
  snapshot_invoice_number: string | null
  snapshot_amount_gross:   number | null
  snapshot_description:    string | null
  /** For timeline event */
  actor_id?:   string
  actor_name?: string
}

/** Operator cancellation input (e.g. if expense is edited after sending) */
export interface CancelApprovalInput {
  approval_id: string
  company_id:  string
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const demoApprovals: CostApproval[] = [
  {
    id: 'appr-demo-1',
    company_id:    'demo-company',
    project_id:    'demo-project-1',
    expense_id:    'exp-v4-demo-1',
    thread_id:     'thread-demo-approvals',
    status:        'pending_client',
    snapshot_amount_gross:   2460.00,
    snapshot_description:    'Płytki wielkoformatowe 120x60',
    snapshot_vendor:         'Ceramika Design Sp. z o.o.',
    snapshot_invoice_number: 'FV/2026/00999',
    message_to_client:       'Proszę o akceptację zakupu płytek do łazienki.',
    client_comment:          null,
    response_idempotency_key: null,
    sent_at:       new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    responded_at:  null,
    created_at:    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at:    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// ─── Helper: get or create the approvals thread for a project ────────────────

/**
 * Returns the existing approvals thread for the project, or creates one.
 * Safe to call concurrently — DB has a UNIQUE index preventing duplicates.
 */
export async function getOrCreateApprovalsThread(
  projectId: string,
  companyId: string,
): Promise<string | null> {
  if (isDemoMode || !supabase) return 'thread-demo-approvals'

  // Try to find existing
  const { data: existing } = await supabase
    .from('project_threads')
    .select('id')
    .eq('project_id', projectId)
    .eq('type', 'approvals')
    .eq('archived', false)
    .maybeSingle()

  if (existing) return existing.id

  // Create new approvals thread
  const { data: created, error } = await supabase
    .from('project_threads')
    .insert({
      company_id:  companyId,
      project_id:  projectId,
      type:        'approvals',
      visibility:  'approval',
      title:       'Akceptacje kosztów',
    })
    .select('id')
    .single()

  if (error) {
    // Concurrent creation — try to fetch again
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('project_threads')
        .select('id')
        .eq('project_id', projectId)
        .eq('type', 'approvals')
        .eq('archived', false)
        .maybeSingle()
      return retry?.id ?? null
    }
    console.warn('[cost-approvals.api] getOrCreateApprovalsThread error:', error.message)
    return null
  }

  return created.id
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const costApprovalsApi = {
  // ── List approvals for a project (operator view) ────────────────────────

  async listForProject(projectId: string, companyId: string): Promise<CostApproval[]> {
    if (isDemoMode || !supabase) {
      return demoApprovals.filter((a) => a.project_id === projectId)
    }

    const { data, error } = await supabase
      .from('cost_approvals')
      .select('*')
      .eq('project_id', projectId)
      .eq('company_id', companyId)
      .order('sent_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as CostApproval[]
  },

  // ── List approvals for a specific expense ──────────────────────────────

  async listForExpense(expenseId: string, companyId: string): Promise<CostApproval[]> {
    if (isDemoMode || !supabase) {
      return demoApprovals.filter((a) => a.expense_id === expenseId)
    }

    const { data, error } = await supabase
      .from('cost_approvals')
      .select('*')
      .eq('expense_id', expenseId)
      .eq('company_id', companyId)
      .order('sent_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as CostApproval[]
  },

  // ── Create approval (operator sends expense for client approval) ────────

  async create(input: CreateApprovalInput): Promise<CostApproval> {
    if (isDemoMode || !supabase) {
      const appr: CostApproval = {
        id:            `appr-${Date.now()}`,
        company_id:    input.company_id,
        project_id:    input.project_id,
        expense_id:    input.expense_id,
        thread_id:     'thread-demo-approvals',
        status:        'pending_client',
        snapshot_amount_gross:   input.snapshot_amount_gross,
        snapshot_description:    input.snapshot_description,
        snapshot_vendor:         input.snapshot_vendor,
        snapshot_invoice_number: input.snapshot_invoice_number,
        message_to_client:       input.message_to_client ?? null,
        client_comment:          null,
        response_idempotency_key: null,
        sent_at:    new Date().toISOString(),
        responded_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      demoApprovals.unshift(appr)
      return appr
    }

    // ── 1. Get or create approvals thread ──────────────────────────────────
    const threadId = await getOrCreateApprovalsThread(input.project_id, input.company_id)

    // ── 2. Insert cost_approvals record ────────────────────────────────────
    const { data, error } = await supabase
      .from('cost_approvals')
      .insert({
        company_id:    input.company_id,
        project_id:    input.project_id,
        expense_id:    input.expense_id,
        thread_id:     threadId,
        status:        'pending_client',
        snapshot_vendor:         input.snapshot_vendor,
        snapshot_invoice_number: input.snapshot_invoice_number,
        snapshot_amount_gross:   input.snapshot_amount_gross,
        snapshot_description:    input.snapshot_description,
        message_to_client:       input.message_to_client ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    const approval = data as CostApproval

    // ── 3. Update expense approval_status + approval_sent_at ──────────────
    await supabase
      .from('expense_invoices')
      .update({
        approval_status:  'pending_client',
        approval_sent_at: approval.sent_at,
      })
      .eq('id', input.expense_id)

    // ── 4. Insert system message into approvals thread ────────────────────
    if (threadId) {
      const amountStr = input.snapshot_amount_gross != null
        ? `${input.snapshot_amount_gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN`
        : '?'
      const msgBody = [
        `📋 Wysłano prośbę o akceptację kosztu:`,
        `Sprzedawca: ${input.snapshot_vendor ?? '—'}`,
        input.snapshot_invoice_number ? `Faktura: ${input.snapshot_invoice_number}` : null,
        `Kwota brutto: ${amountStr}`,
        input.message_to_client ? `\nWiadomość do klienta: ${input.message_to_client}` : null,
      ].filter(Boolean).join('\n')

      await supabase
        .from('project_messages')
        .insert({
          thread_id:     threadId,
          company_id:    input.company_id,
          project_id:    input.project_id,
          sender_type:   'system',
          sender_name:   input.actor_name ?? 'System',
          body:          msgBody,
          visibility:    'client_shared',
          read_by_operator: true,
          read_by_client:   false,
        })
    }

    // ── 5. Timeline event (fire-and-forget) ───────────────────────────────
    createTimelineEvent({
      company_id:   input.company_id,
      project_id:   input.project_id,
      event_type:   'cost_approval_sent',
      visibility:   'internal',
      title:        `Wysłano do akceptacji: ${input.snapshot_vendor ?? 'koszt'}`,
      description:  input.snapshot_invoice_number
        ? `Faktura ${input.snapshot_invoice_number} — ${input.snapshot_amount_gross ?? '?'} PLN`
        : undefined,
      actor_type:   'operator',
      actor_id:     input.actor_id,
      actor_name:   input.actor_name,
      reference_id:   approval.id,
      reference_type: 'approval',
      payload: {
        approval_id:     approval.id,
        expense_id:      input.expense_id,
        vendor_name:     input.snapshot_vendor,
        gross_amount:    input.snapshot_amount_gross,
        invoice_number:  input.snapshot_invoice_number,
      },
    }).catch(() => {})

    return approval
  },

  // ── Cancel approval (operator retracts a pending approval) ─────────────

  async cancel(input: CancelApprovalInput): Promise<void> {
    if (isDemoMode || !supabase) {
      const idx = demoApprovals.findIndex((a) => a.id === input.approval_id)
      if (idx !== -1) demoApprovals[idx] = { ...demoApprovals[idx], status: 'cancelled', updated_at: new Date().toISOString() }
      return
    }

    const { error } = await supabase
      .from('cost_approvals')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', input.approval_id)
      .eq('company_id', input.company_id)
      .eq('status', 'pending_client') // only cancel if still pending

    if (error) throw error

    // Also reset expense approval_status to not_sent? (only if no other pending approvals)
    // This is intentionally left to the hook layer where we can check more context.
  },
}
