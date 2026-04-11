import type { CreateInvoiceInput, Invoice } from '@/entities/invoice/model'
import { demoDb } from '@/shared/lib/demoDb'
import { calcInvoiceTotals } from '@/features/invoices/lib/invoice.calculations'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { sumInvoiceItems } from '@/shared/lib/legacySupabase'
import { applyScope, getDataScope, withScope } from '@/shared/lib/dataScope'
import { projectDocumentsApi } from '@/features/projects/api/projectDocuments.api'

// ── C2: Tranche status sync ───────────────────────────────────────────────────
// When an invoice referencing a contract tranche is created/paid,
// update the JSONB tranches[] array in the contracts table.
async function syncTrancheStatus(
  contractId: string,
  trancheId: string,
  newStatus: 'invoiced' | 'paid',
): Promise<void> {
  if (!supabase || !contractId || !trancheId) return
  try {
    // Fetch current tranches
    const { data: contract } = await supabase
      .from('contracts')
      .select('tranches')
      .eq('id', contractId)
      .single()
    if (!contract?.tranches) return
    const tranches = contract.tranches as Array<Record<string, unknown>>
    const updated = tranches.map(t => {
      if (t.id !== trancheId) return t
      // Only advance status (planned→invoiced→paid), never regress
      const current = t.status as string
      if (newStatus === 'paid') return { ...t, status: 'paid' }
      if (newStatus === 'invoiced' && current === 'planned') return { ...t, status: 'invoiced' }
      return t
    })
    await supabase.from('contracts').update({ tranches: updated }).eq('id', contractId)
  } catch (e) {
    console.warn('[invoicesApi] syncTrancheStatus failed (non-fatal):', e)
  }
}

export const invoicesApi = {
  async list(companyId: string): Promise<Invoice[]> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invoices.list(companyId))
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('invoices').select('*, items:invoice_items(*)').order('created_at', { ascending: false }), scope)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row: any) => { const items = (row.items ?? []).map((item: any, index: number) => ({ id: item.id, description: item.description, unit: item.unit, quantity: Number(item.quantity), unit_price: Number(item.unit_price), vat_rate: Number(item.vat_rate ?? 23), sort_order: item.sort_order ?? index, tranche_label: item.tranche_label ?? '' })); const totals = sumInvoiceItems(items); return { id: row.id, company_id: row.company_id ?? companyId, client_id: row.client_id, project_id: row.project_id, contract_id: row.contract_id ?? null, number: row.number, invoice_type: row.invoice_type ?? 'standard', status: row.status, issue_date: row.issue_date, sale_date: row.sale_date ?? null, issue_place: row.issue_place ?? null, due_date: row.due_date, payment_method: row.payment_method ?? 'transfer', bank_account: row.bank_account ?? null, tranche_id: row.tranche_id ?? null, advance_total: row.advance_total ?? null, total_net: totals.totalNet, total_gross: totals.totalGross, ksef_status: row.ksef_status, ksef_ref: row.ksef_ref, notes: row.notes ?? '', created_at: row.created_at, items } })
  },
  async create(input: CreateInvoiceInput): Promise<Invoice> {
    if (isDemoMode || !supabase) { const totals = calcInvoiceTotals(input.items); return Promise.resolve(demoDb.invoices.create({ ...input, total_net: totals.totalNet, total_gross: totals.totalGross, ksef_status: 'ksef_pending', ksef_ref: null })) }
    const scope = await getDataScope(input.company_id)

    const isDraft = input.status === 'draft' || input.draft === true

    let invoiceNumber: string | null = null
    if (!isDraft) {
      // Resolve sequential invoice number:
      // 1. next_doc_number (mig 079) — atomic, month-aware, format FV/YYYY/MM/N
      // 2. next_invoice_number (mig 032) — atomic, year-only, fallback
      // 3. count-based — non-atomic, last-resort edge case
      // Pass issue_date so the counter increments the correct month's sequence (mig 118)
      const { data: numData, error: numError } = await supabase.rpc('next_doc_number', { p_company_id: input.company_id, p_doc_type: 'invoice', p_issue_date: input.issue_date ?? null })
      if (!numError && numData) {
        invoiceNumber = numData as string
      } else {
        const { data: legacyNum, error: legacyErr } = await supabase.rpc('next_invoice_number', { p_company_id: input.company_id })
        if (!legacyErr && legacyNum) {
          invoiceNumber = legacyNum as string
        } else {
          const now = new Date()
          const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', input.company_id).gte('issue_date', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
          invoiceNumber = `FV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${(count ?? 0) + 1}`
        }
      }
    }

    const payload = withScope(scope, { number: invoiceNumber, client_id: input.client_id, project_id: input.project_id, contract_id: input.contract_id ?? null, status: isDraft ? 'draft' : (input.status ?? 'unpaid'), invoice_type: input.invoice_type ?? 'standard', issue_date: input.issue_date, sale_date: input.sale_date ?? null, issue_place: input.issue_place ?? null, due_date: input.due_date, payment_method: input.payment_method ?? 'transfer', bank_account: input.bank_account ?? null, tranche_id: input.tranche_id ?? null, advance_total: input.advance_total ?? null, ksef_status: isDraft ? null : 'ksef_pending', ksef_ref: null, notes: input.notes ?? null })
    const { data: invoice, error } = await supabase.from('invoices').insert(payload).select('*').single(); if (error) throw error
    const items = input.items ?? []
    if (items.length > 0) {
      const itemRows = items.map((item, index) => ({ invoice_id: invoice.id, description: item.description ?? '', unit: item.unit ?? 'szt', quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate ?? 23, sort_order: item.sort_order ?? index, tranche_label: item.tranche_label ?? '' }))
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)
      if (itemsError) throw itemsError
    }
    const totals = calcInvoiceTotals(items)
    if (input.project_id) { try { await projectDocumentsApi.link(input.company_id, input.project_id, 'invoice', invoice.id, { manual: true }) } catch (err) { console.warn('[invoices] project document link failed:', err) } }
    // C2: if invoice is linked to a contract tranche, mark it as 'invoiced'
    if (!isDraft && invoice.contract_id && invoice.tranche_id) {
      void syncTrancheStatus(invoice.contract_id, invoice.tranche_id, 'invoiced')
    }
    return { id: invoice.id, company_id: invoice.company_id ?? input.company_id, client_id: invoice.client_id, project_id: invoice.project_id, contract_id: invoice.contract_id ?? null, number: invoice.number, invoice_type: invoice.invoice_type ?? 'standard', status: invoice.status, issue_date: invoice.issue_date, sale_date: invoice.sale_date ?? null, issue_place: invoice.issue_place ?? null, due_date: invoice.due_date, payment_method: invoice.payment_method ?? 'transfer', bank_account: invoice.bank_account ?? null, tranche_id: invoice.tranche_id ?? null, advance_total: invoice.advance_total ?? null, total_net: totals.totalNet, total_gross: totals.totalGross, ksef_status: invoice.ksef_status, ksef_ref: invoice.ksef_ref, notes: input.notes ?? '', created_at: invoice.created_at, items }
  },
  async update(id: string, input: Partial<Invoice>, companyId?: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invoices.update(id, input))
    const scope = await getDataScope(companyId)
    const items = input.items
    const payload: any = { ...input }
    delete payload.items
    const { data, error } = await supabase.from('invoices').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    if (items) {
      await supabase.from('invoice_items').delete().eq('invoice_id', id)
      if (items.length > 0) {
        const itemRows = items.map((item, index) => ({ invoice_id: id, description: item.description ?? '', unit: item.unit ?? 'szt', quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate ?? 23, sort_order: item.sort_order ?? index, tranche_label: item.tranche_label ?? '' }))
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)
        if (itemsError) throw itemsError
      }
    }
    return data
  },
  async delete(id: string, companyId?: string) {
    if (isDemoMode || !supabase) { demoDb.invoices.delete(id); return Promise.resolve() }
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('invoices').delete().eq('id', id), scope)
    const { error } = await query
    if (error) throw error
    // Archive any project_documents rows that reference this invoice (best-effort)
    supabase.from('project_documents')
      .update({ archived_at: new Date().toISOString() })
      .eq('doc_type', 'invoice')
      .eq('doc_id', id)
      .is('archived_at', null)
      .then(() => {})
  },
  async markPaid(id: string, companyId?: string) {
    if (isDemoMode || !supabase) { demoDb.invoices.markPaid(id); return Promise.resolve() }
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('invoices').update({ status: 'paid' }).eq('id', id), scope)
    const { error } = await query
    if (error) throw error
    // C2: sync tranche status to 'paid' when invoice is marked paid
    try {
      const { data: inv } = await supabase.from('invoices').select('contract_id, tranche_id').eq('id', id).single()
      if (inv?.contract_id && inv?.tranche_id) {
        void syncTrancheStatus(inv.contract_id, inv.tranche_id, 'paid')
      }
    } catch { /* non-fatal */ }
  },
  async sendToKsef(id: string, companyId?: string) { if (isDemoMode || !supabase) { demoDb.invoices.sendToKsef(id); return Promise.resolve() } const scope = await getDataScope(companyId); const query = applyScope(supabase.from('invoices').update({ ksef_status: 'ksef_pending', ksef_ref: null }).eq('id', id), scope); const { error } = await query; if (error) throw error },
  async finalize(id: string, companyId: string): Promise<string> {
    // Assigns a sequential FV number to a draft invoice and transitions it to 'unpaid'.
    // Safe to call only once per invoice — if number is already set, throws.
    if (isDemoMode || !supabase) {
      const inv = demoDb.invoices.list(companyId).find(i => i.id === id)
      if (!inv) throw new Error('Nie znaleziono faktury')
      const num = `FV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/1`
      demoDb.invoices.update(id, { number: num as any, status: 'unpaid' })
      return num
    }
    const scope = await getDataScope(companyId)
    // Verify invoice is still a draft before consuming a number
    const { data: current, error: fetchErr } = await supabase.from('invoices').select('id, status, number, issue_date').eq('id', id).maybeSingle()
    if (fetchErr) throw fetchErr
    if (!current) throw new Error('Nie znaleziono faktury')
    if (current.status !== 'draft') throw new Error('Faktura nie jest szkicem — nie można ponownie wystawić.')
    if (current.number) throw new Error('Faktura ma już przypisany numer.')
    // Consume next number atomically — use the invoice's own issue_date for correct month
    const { data: numData, error: numError } = await supabase.rpc('next_doc_number', { p_company_id: scope.companyId, p_doc_type: 'invoice', p_issue_date: current.issue_date ?? null })
    if (numError || !numData) throw numError ?? new Error('Nie udało się pobrać numeru faktury.')
    const invoiceNumber = numData as string
    const { error: updateErr } = await supabase.from('invoices').update({ number: invoiceNumber, status: 'unpaid', ksef_status: 'ksef_pending' }).eq('id', id)
    if (updateErr) throw updateErr
    return invoiceNumber
  },
  async createFromEstimate(companyId: string, estimateId: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invoices.createFromEstimate(companyId, estimateId))
    const { data: estimate, error: estErr } = await supabase.from('cost_estimates').select('*, items:cost_estimate_items(*)').eq('id', estimateId).single()
    if (estErr || !estimate) throw estErr ?? new Error('Nie znaleziono kosztorysu')
    const invoiceItems = (estimate.items ?? []).map((item: any, i: number) => ({ id: crypto.randomUUID(), description: item.name || item.description || '', unit: item.unit || 'szt', quantity: Number(item.quantity), unit_price: Number(item.unit_price), vat_rate: Number(item.vat_rate ?? 23), sort_order: i }))
    return invoicesApi.create({ company_id: companyId, client_id: estimate.client_id, project_id: estimate.project_id ?? null, status: 'unpaid', issue_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), items: invoiceItems })
  },
  async createFromContract(companyId: string, contractId: string) {
    if (isDemoMode || !supabase) {
      const contract = demoDb.contracts.list(companyId).find(c => c.id === contractId)
      if (!contract) throw new Error('Nie znaleziono umowy')
      return invoicesApi.create({ company_id: companyId, client_id: contract.client_id, project_id: contract.project_id ?? null, contract_id: contractId, status: 'unpaid', notes: `Wygenerowano z umowy ${contract.number}`, issue_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), items: [{ id: crypto.randomUUID(), description: `Realizacja umowy ${contract.number}`, unit: 'usł', quantity: 1, unit_price: contract.value, vat_rate: contract.vat_rate ?? 23, sort_order: 0, tranche_label: '' }] })
    }
    const { data: contract, error: cErr } = await supabase.from('contracts').select('*').eq('id', contractId).single()
    if (cErr || !contract) throw cErr ?? new Error('Nie znaleziono umowy')
    let items: any[]
    if (contract.estimate_id) {
      const { data: est } = await supabase.from('cost_estimates').select('*, items:cost_estimate_items(*)').eq('id', contract.estimate_id).single()
      if (est?.items?.length) {
        items = (est.items as any[]).map((item: any, i: number) => ({ id: crypto.randomUUID(), description: item.name || item.description || '', unit: item.unit || 'szt', quantity: Number(item.quantity), unit_price: Number(item.unit_price), vat_rate: Number(item.vat_rate ?? 23), sort_order: i, tranche_label: '' }))
      } else {
        items = [{ id: crypto.randomUUID(), description: `Realizacja umowy ${contract.number}`, unit: 'usł', quantity: 1, unit_price: Number(contract.value ?? 0), vat_rate: Number(contract.vat_rate ?? 23), sort_order: 0, tranche_label: '' }]
      }
    } else {
      items = [{ id: crypto.randomUUID(), description: `Realizacja umowy ${contract.number}`, unit: 'usł', quantity: 1, unit_price: Number(contract.value ?? 0), vat_rate: Number(contract.vat_rate ?? 23), sort_order: 0, tranche_label: '' }]
    }
    return invoicesApi.create({ company_id: companyId, client_id: contract.client_id, project_id: contract.project_id ?? null, contract_id: contractId, status: 'unpaid', notes: `Wygenerowano z umowy ${contract.number}`, issue_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), items })
  },
  async createFromProject(companyId: string, config: { projectId: string; vatRate?: number; tranches?: Array<{ id: string; label: string; amount: number; due_date: string }> }) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.invoices.createFromProject(companyId, config))
    const { data: project, error: projErr } = await supabase.from('projects').select('*').eq('id', config.projectId).single()
    if (projErr || !project) throw projErr ?? new Error('Nie znaleziono projektu')
    const vatRate = config.vatRate ?? 23
    const items = config.tranches?.length
      ? config.tranches.map((t, i) => ({ id: crypto.randomUUID(), description: t.label, unit: 'usł' as const, quantity: 1, unit_price: t.amount, vat_rate: vatRate, sort_order: i, tranche_label: t.label }))
      : [{ id: crypto.randomUUID(), description: `Realizacja projektu: ${project.name}`, unit: 'usł' as const, quantity: 1, unit_price: 0, vat_rate: vatRate, sort_order: 0, tranche_label: '' }]
    const dueDate = config.tranches?.[0]?.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    return invoicesApi.create({ company_id: companyId, client_id: project.client_id, project_id: config.projectId, status: 'unpaid', issue_date: new Date().toISOString().slice(0, 10), due_date: dueDate, items })
  },
}
