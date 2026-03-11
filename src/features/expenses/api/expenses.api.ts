// =============================================================================
// Expense Invoices API — scan/upload cost invoices, assign to projects
// =============================================================================

import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { getDataScope, withScope } from '@/shared/lib/dataScope'

export interface ExpenseInvoice {
  id: string
  company_id: string
  project_id: string | null
  project_name?: string   // joined
  file_url: string | null
  file_name: string | null
  invoice_number: string | null
  vendor: string | null
  vendor_nip: string | null
  issue_date: string | null
  amount_net: number | null
  amount_vat: number | null
  amount_gross: number | null
  description: string | null
  status: 'new' | 'parsed' | 'review' | 'assigned' | 'error'
  duplicate_of: string | null
  created_at: string
  updated_at: string
}

export interface ParsedExpenseData {
  invoice_number?: string
  vendor?: string
  vendor_nip?: string
  issue_date?: string
  amount_net?: number
  amount_vat?: number
  amount_gross?: number
  description?: string
}

// ── demo store ────────────────────────────────────────────────────────────────

const demoExpenses: ExpenseInvoice[] = [
  {
    id: 'exp-demo-1',
    company_id: 'demo-company',
    project_id: 'demo-project-1',
    project_name: 'Remont łazienki',
    file_url: null,
    file_name: 'faktura_sklep_budowlany.pdf',
    invoice_number: 'FV/2026/00812',
    vendor: 'Sklep Budowlany ABC Sp. z o.o.',
    vendor_nip: '5221234567',
    issue_date: '2026-03-08',
    amount_net: 1200.00,
    amount_vat: 276.00,
    amount_gross: 1476.00,
    description: 'Płytki ceramiczne 60x60, biały mat — 40 m²',
    status: 'assigned',
    duplicate_of: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'exp-demo-2',
    company_id: 'demo-company',
    project_id: null,
    project_name: undefined,
    file_url: null,
    file_name: 'faktura_elektryczna.jpg',
    invoice_number: 'FV-456/2026',
    vendor: 'Hurt Elektryczny Kowalski',
    vendor_nip: '7771234567',
    issue_date: '2026-03-10',
    amount_net: 340.65,
    amount_vat: 78.35,
    amount_gross: 419.00,
    description: 'Przewody elektryczne, gniazda, wyłączniki',
    status: 'review',
    duplicate_of: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// ── OCR / AI parse helper ─────────────────────────────────────────────────────

/**
 * Attempt to parse invoice data from a text or file.
 * In production this would call an OCR service (Azure Document Intelligence,
 * AWS Textract, or an LLM). For now we return empty data and users fill
 * the form manually — the architecture is ready for a real integration.
 */
export async function parseInvoiceFromText(text: string): Promise<ParsedExpenseData> {
  const result: ParsedExpenseData = {}

  // Simple heuristic extraction — handles common Polish invoice formats
  const numberMatch = text.match(/(?:nr|numer|FV|faktura)[^\n:]*[:.]?\s*([A-Z0-9\/\-]+)/i)
  if (numberMatch) result.invoice_number = numberMatch[1].trim()

  const nipMatch = text.match(/NIP[:\s]+([0-9]{10})/i)
  if (nipMatch) result.vendor_nip = nipMatch[1]

  const dateMatch = text.match(/(?:data wystawienia|data)[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4})/i)
  if (dateMatch) {
    const raw = dateMatch[1]
    // Normalize to YYYY-MM-DD
    if (raw.includes('-') && raw.indexOf('-') === 4) {
      result.issue_date = raw
    } else {
      const parts = raw.split(/[./-]/)
      if (parts.length === 3 && parts[2].length === 4) {
        result.issue_date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      }
    }
  }

  const grossMatch = text.match(/(?:brutto|do zapłaty|razem)[:\s]+([0-9,. ]+)\s*(?:PLN|zł)/i)
  if (grossMatch) {
    result.amount_gross = parseFloat(grossMatch[1].replace(/[, ]/g, '.').replace('..', '.'))
  }

  const netMatch = text.match(/(?:netto|wartość netto)[:\s]+([0-9,. ]+)\s*(?:PLN|zł)/i)
  if (netMatch) {
    result.amount_net = parseFloat(netMatch[1].replace(/[, ]/g, '.').replace('..', '.'))
  }

  if (result.amount_gross && result.amount_net) {
    result.amount_vat = Math.round((result.amount_gross - result.amount_net) * 100) / 100
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────

export const expensesApi = {
  async list(companyId: string): Promise<ExpenseInvoice[]> {
    if (isDemoMode || !supabase) return [...demoExpenses]

    const { data, error } = await supabase
      .from('expense_invoices')
      .select('*, projects(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row: any) => ({
      ...row,
      project_name: row.projects?.name ?? null,
    }))
  },

  async create(input: {
    companyId: string
    fileUrl?: string
    fileName?: string
    parsed?: ParsedExpenseData
    projectId?: string | null
  }): Promise<ExpenseInvoice> {
    if (isDemoMode || !supabase) {
      const item: ExpenseInvoice = {
        id: `exp-${Date.now()}`,
        company_id: input.companyId,
        project_id: input.projectId ?? null,
        file_url: input.fileUrl ?? null,
        file_name: input.fileName ?? null,
        invoice_number: input.parsed?.invoice_number ?? null,
        vendor: input.parsed?.vendor ?? null,
        vendor_nip: input.parsed?.vendor_nip ?? null,
        issue_date: input.parsed?.issue_date ?? null,
        amount_net: input.parsed?.amount_net ?? null,
        amount_vat: input.parsed?.amount_vat ?? null,
        amount_gross: input.parsed?.amount_gross ?? null,
        description: input.parsed?.description ?? null,
        status: 'review',
        duplicate_of: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      demoExpenses.unshift(item)
      return item
    }

    const scope = await getDataScope(input.companyId)
    const { data, error } = await supabase
      .from('expense_invoices')
      .insert(withScope(scope, {
        project_id: input.projectId ?? null,
        file_url: input.fileUrl ?? null,
        file_name: input.fileName ?? null,
        invoice_number: input.parsed?.invoice_number ?? null,
        vendor: input.parsed?.vendor ?? null,
        vendor_nip: input.parsed?.vendor_nip ?? null,
        issue_date: input.parsed?.issue_date ?? null,
        amount_net: input.parsed?.amount_net ?? null,
        amount_vat: input.parsed?.amount_vat ?? null,
        amount_gross: input.parsed?.amount_gross ?? null,
        description: input.parsed?.description ?? null,
        status: 'review',
      }))
      .select('*')
      .single()

    if (error) throw error
    return data as ExpenseInvoice
  },

  async update(id: string, data: Partial<ExpenseInvoice>): Promise<void> {
    if (isDemoMode || !supabase) {
      const idx = demoExpenses.findIndex((e) => e.id === id)
      if (idx !== -1) Object.assign(demoExpenses[idx], data, { updated_at: new Date().toISOString() })
      return
    }
    const payload: any = { ...data, updated_at: new Date().toISOString() }
    delete payload.id
    delete payload.company_id
    delete payload.created_at
    delete payload.project_name
    const { error } = await supabase.from('expense_invoices').update(payload).eq('id', id)
    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    if (isDemoMode || !supabase) {
      const idx = demoExpenses.findIndex((e) => e.id === id)
      if (idx !== -1) demoExpenses.splice(idx, 1)
      return
    }
    const { error } = await supabase.from('expense_invoices').delete().eq('id', id)
    if (error) throw error
  },

  async uploadFile(file: File, companyId: string): Promise<{ url: string; name: string }> {
    if (isDemoMode || !supabase) {
      return { url: URL.createObjectURL(file), name: file.name }
    }
    const path = `${companyId}/expenses/${Date.now()}_${file.name}`
    const { error } = await supabase.storage
      .from('company-logos')
      .upload(path, file, { upsert: false, contentType: file.type })
    if (error) throw error
    const { data } = supabase.storage.from('company-logos').getPublicUrl(path)
    return { url: data.publicUrl, name: file.name }
  },

  /** Check for potential duplicates by invoice_number, vendor_nip, and amount */
  async checkDuplicate(companyId: string, invoiceNumber: string | null, vendorNip: string | null, amountGross: number | null): Promise<string | null> {
    if (isDemoMode || !supabase || !invoiceNumber) return null
    const { data } = await supabase
      .from('expense_invoices')
      .select('id, invoice_number')
      .eq('company_id', companyId)
      .eq('invoice_number', invoiceNumber)
      .limit(1)
    return data?.[0]?.id ?? null
  },
}
