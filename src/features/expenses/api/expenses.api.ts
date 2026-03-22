// =============================================================================
// Expense Invoices API — scan/upload cost invoices, assign to projects
// =============================================================================

import { isDemoMode, supabase } from '@/shared/lib/supabase'

/**
 * Pick a meaningful initial status based on OCR extraction confidence and
 * whether the expense is already linked to a project.
 *   ≥ 70 % + project  → 'assigned'   (high confidence, project known)
 *   ≥ 70 %            → 'parsed'     (high confidence, no project yet)
 *   anything else     → 'review'     (needs manual verification)
 */
function deriveExpenseStatus(
  confidence: number | null | undefined,
  projectId:  string | null | undefined,
): 'new' | 'parsed' | 'review' | 'assigned' | 'error' {
  if (confidence != null && confidence >= 70) {
    return projectId ? 'assigned' : 'parsed'
  }
  return 'review'
}

/** Remove diacritics and replace unsafe Storage path characters */
function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics (ą→a, ę→e, etc.)
    .replace(/[^a-zA-Z0-9._-]/g, '_') // replace spaces / special chars
}

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

  // ── Normalize whitespace (PDF text is often token-per-space) ────────────
  const t = text.replace(/\s+/g, ' ')

  // ── Document type detection ──────────────────────────────────────────────
  const RECEIPT_KEYWORDS = /paragon|kasa\s+fiskalna|nr\s*paragonu|fiskaln|kasowy|kasy\s+fiskal/i
  const isReceipt = RECEIPT_KEYWORDS.test(t)

  // ── Invoice number — 5-pass ──────────────────────────────────────────────
  // Pass 1: compound label "Numer faktury:", "Nr faktury:", "Faktura VAT Nr"
  const numMatch1 = t.match(
    /(?:numer\s+faktury|nr\.?\s+faktury|faktura(?:\s+(?:vat|korektora?|nr|numer))*)[^A-Z0-9\n]{0,20}((?:[A-Z0-9]{1,6}[\/\-]){1,3}[A-Z0-9]{1,10})/i
  )
  if (numMatch1) result.invoice_number = numMatch1[1].trim().toUpperCase()

  // Pass 2: simple "Nr:" / "Nr FV/..."
  if (!result.invoice_number) {
    const numMatch2 = t.match(/(?<![A-Z])nr[:\s.]+([A-Z][A-Z0-9]{0,5}(?:[\/\-][A-Z0-9]{1,8}){1,3})/i)
    if (numMatch2) result.invoice_number = numMatch2[1].trim().toUpperCase()
  }

  // Pass 3: standalone FV/FA/FS/FZ prefix — FV/2026/001, FVAT-001-2026
  if (!result.invoice_number) {
    const numMatch3 = t.match(/\b((?:FV|FA|FS|FZ|RF|RV)(?:AT)?(?:[\/\-\s][A-Z0-9]{1,8}){2,4})\b/i)
    if (numMatch3) result.invoice_number = numMatch3[1].trim().replace(/\s+/g, '/').toUpperCase()
  }

  // Pass 4: generic X…X/NNN/NNN
  if (!result.invoice_number) {
    const numMatch4 = t.match(/\b([A-Z]{1,5}[\/\-][0-9]{1,8}[\/\-][0-9]{1,6})\b/)
    if (numMatch4) result.invoice_number = numMatch4[1].trim().toUpperCase()
  }

  // Pass 5: receipt / paragon number
  if (!result.invoice_number && isReceipt) {
    const receiptNum = t.match(/(?:paragon\s+(?:nr|numer)?\s*|\bnr\s*[:\s])([A-Z0-9]{3,20})/i)
    if (receiptNum) result.invoice_number = 'PAR/' + receiptNum[1].trim().toUpperCase()
  }

  // ── NIP (handles 10 digits, with or without dashes/spaces) ───────────────
  const nipMatch = t.match(/NIP[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/i)
  if (nipMatch) {
    const digits = nipMatch[1].replace(/[\s\-]/g, '')
    if (digits.length === 10) result.vendor_nip = digits
  }

  // ── Vendor / seller name ─────────────────────────────────────────────────
  // Look for lines after "Sprzedawca", "Wystawca", "Sprzedający", "Firma", "Nazwa"
  const vendorLabelMatch = t.match(
    /(?:sprzedawca|wystawca|sprzedaj[aą]cy|firma|dostawca|wykonawca)[:\s]+([^\n,;(]{4,60}(?:sp\.\s*z\.?\s*o\.?\.?o\.?|s\.?a\.?|sp\.\s*j\.?|ltd|gmbh)?[^\n,;(]{0,30})/i
  )
  if (vendorLabelMatch) {
    result.vendor = vendorLabelMatch[1].trim().replace(/\s{2,}/g, ' ')
  }

  // Fallback: find a line that looks like a company name (contains "Sp. z o.o.", "S.A.", "Sp. j.", etc.)
  if (!result.vendor) {
    const companyMatch = t.match(/([A-ZŁÓŚĄŹĆĘŃ][A-Za-ząęółśźćń\s\.\-"]{3,50}(?:Sp\.\s*z\s*o\.o\.|S\.A\.|Sp\.\s*j\.|Ltd\.|GmbH|s\.c\.))/i)
    if (companyMatch) result.vendor = companyMatch[1].trim().replace(/\s{2,}/g, ' ')
  }

  // Last-resort: scan first 15 non-empty lines for any company-like content
  if (!result.vendor) {
    const SKIP_LINE = /^(?:faktura|fv|fa|fs|fz|vat|nip[:\s]|pesel[:\s]|data[\s:]|nr[\s:.]|numer|suma|brutto|netto|razem|wystawiono|termin|zaliczka|orygi|kopia|\d{4}[\-.\/]\d{2}|\d{1,2}[\-.\/]\d{1,2}[\-.\/]\d{4})/i
    const candidateLines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 4 && /[a-zA-ZąęółśźćńĄĘÓŁŚŹĆŃ]{3}/.test(l) && !SKIP_LINE.test(l))
      .slice(0, 15)
    if (candidateLines.length > 0) result.vendor = candidateLines[0].slice(0, 80)
  }

  // Receipt vendor fallback: fiscal receipts often begin with ALL-CAPS store name
  if (!result.vendor && isReceipt) {
    const capsLine = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length >= 5 && l.length <= 60 && /^[A-ZŁÓŚĄŹĆĘŃ][A-ZŁÓŚĄŹĆĘŃ\s\-",.]{4,}$/.test(l))
      .slice(0, 5)
      .find(Boolean)
    if (capsLine) result.vendor = capsLine.slice(0, 60)
  }

  // ── Issue date ────────────────────────────────────────────────────────────
  const dateMatch = t.match(
    /(?:data\s+(?:wystawienia|sprzeda[żz]y|faktury|wyst\.?)|wystawiono|data\s+fv|data)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i
  )
  if (dateMatch) {
    result.issue_date = normalizeDatePl(dateMatch[1])
  }
  if (!result.issue_date) {
    const isoDate = t.match(/\b(202\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/)
    if (isoDate) result.issue_date = isoDate[1]
  }
  if (!result.issue_date) {
    const plDate = t.match(/\b((?:0?[1-9]|[12]\d|3[01])[.\-\/](?:0?[1-9]|1[0-2])[.\-\/]202\d)\b/)
    if (plDate) result.issue_date = normalizeDatePl(plDate[1])
  }

  // ── Amounts (gross / net) — currency suffix is optional ──────────────────
  const grossMatch = t.match(
    /(?:do\s+zap[łl]aty|razem\s+brutto|kwota\s+brutto|warto[śs][ćc]\s+brutto|sum[ma]?\s+brutto|brutto\s+p[łl]atno[śs][ćc]?|brutto)[:\s]+([0-9]+[,. ][0-9]{0,3}[,. ]?[0-9]{0,2})\s*(?:PLN|z[łl]|EUR)?/i
  )
  if (grossMatch) {
    const v = parsePolishAmount(grossMatch[1])
    if (v > 0) result.amount_gross = v
  }

  // Receipt total fallback: "SUMA: 45,00" / "RAZEM: 45,00"
  if (!result.amount_gross) {
    const receiptTotal = t.match(/(?:^|\s)(?:suma|razem|total)[:\s]+([0-9]+[\s]?[0-9]{0,3}[,.][0-9]{1,2})\s*(?:PLN|z[łl]|EUR)?/im)
    if (receiptTotal) { const v = parsePolishAmount(receiptTotal[1]); if (v > 0) result.amount_gross = v }
  }

  const netMatch = t.match(
    /(?:razem\s+netto|kwota\s+netto|warto[śs][ćc]\s+netto|suma\s+netto|netto)[:\s]+([0-9]+[,. ][0-9]{0,3}[,. ]?[0-9]{0,2})\s*(?:PLN|z[łl]|EUR)?/i
  )
  if (netMatch) {
    const v = parsePolishAmount(netMatch[1])
    if (v > 0) result.amount_net = v
  }

  // VAT amount
  const vatMatch = t.match(
    /(?:kwota\s+vat|podatek\s+vat|vat\s+razem|suma\s+vat|vat)[:\s]+([0-9]+[,. ][0-9]{0,3}[,. ]?[0-9]{0,2})\s*(?:PLN|z[łl]|EUR)?/i
  )
  if (vatMatch) {
    const v = parsePolishAmount(vatMatch[1])
    if (v > 0) result.amount_vat = v
  }

  // Derive missing amount from the other two
  if (result.amount_gross && result.amount_net && !result.amount_vat) {
    result.amount_vat = Math.round((result.amount_gross - result.amount_net) * 100) / 100
  } else if (result.amount_gross && result.amount_vat && !result.amount_net) {
    result.amount_net = Math.round((result.amount_gross - result.amount_vat) * 100) / 100
  } else if (result.amount_net && result.amount_vat && !result.amount_gross) {
    result.amount_gross = Math.round((result.amount_net + result.amount_vat) * 100) / 100
  }

  return result
}

/** Parse a number written in Polish locale (12 345,67 or 12345.67 or 12,345.67) */
function parsePolishAmount(raw: string): number {
  const s = raw.trim()
  // Determine if comma or dot is the decimal separator
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized: string
  if (lastComma > lastDot) {
    // European: 1.234,56 → 1234.56
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else {
    // US-style: 1,234.56 → 1234.56
    normalized = s.replace(/,/g, '')
  }
  return parseFloat(normalized.replace(/\s/g, '')) || 0
}

/** Normalize a date string to YYYY-MM-DD */
function normalizeDatePl(raw: string): string {
  const clean = raw.trim()
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const parts = clean.split(/[.\/\-]/)
  if (parts.length === 3) {
    if (parts[0].length <= 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
    if (parts[0].length === 4 && parts[2].length <= 2) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
    }
  }
  return clean
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
    /** Override the auto-derived status. Defaults to confidence-based logic. */
    status?: ExpenseInvoice['status']
    /** Raw OCR confidence (0–100) used to auto-derive status when `status` is omitted. */
    extractionConfidence?: number | null
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
        status: input.status ?? deriveExpenseStatus(input.extractionConfidence, input.projectId),
        duplicate_of: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      demoExpenses.unshift(item)
      return item
    }

    // Insert expense — no user_id column in this table
    const { data, error } = await supabase
      .from('expense_invoices')
      .insert({
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
        status: input.status ?? deriveExpenseStatus(input.extractionConfidence, input.projectId),
      })
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
    const safeName = sanitizeFilename(file.name)
    const contentType = file.type || 'application/octet-stream'
    const path = `${companyId}/expenses/${Date.now()}_${safeName}`
    const { error } = await supabase.storage
      .from('company-files')
      .upload(path, file, { upsert: false, contentType })
    if (error) throw error
    const { data } = supabase.storage.from('company-files').getPublicUrl(path)
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

// =============================================================================
// Etap 4 — Project-centric expenses with OCR metadata (new types + methods)
// =============================================================================

export type ExpenseSourceType    = 'camera' | 'gallery' | 'pdf' | 'manual'
export type ExpenseCostType      = 'material' | 'service' | 'equipment' | 'labor' | 'transport' | 'other'
export type ExpenseApprovalStatus = 'not_sent' | 'pending_client' | 'accepted' | 'rejected' | 'questioned'

/** Extended ExpenseInvoice — adds Etap 1 new columns (all optional for backward compat) */
export interface ExpenseInvoiceV4 extends ExpenseInvoice {
  // vendor_name is aliased from "vendor" for clarity in new code
  vendor_name?:              string | null
  source_type?:              ExpenseSourceType | null
  cost_type?:                ExpenseCostType | string | null
  approval_status?:          ExpenseApprovalStatus | null
  extraction_confidence?:    number | null
  extraction_warnings?:      string[] | null
  requires_user_confirmation?: boolean | null
  parser_source?:            'ai' | 'regex' | 'manual' | null
  possible_duplicate?:       boolean | null
  duplicate_of_expense_id?:  string | null
  category?:                 string | null
  currency?:                 string | null
  sale_date?:                string | null
  payment_due_date?:         string | null
}

/** The result returned by /.netlify/functions/parse-invoice */
export interface ParseInvoiceResult {
  document_type:  'invoice' | 'receipt' | 'bill' | 'other' | null  // detected doc type
  vendor_name:      string | null
  vendor_nip:       string | null
  buyer_name?:      string | null  // from AI path
  buyer_nip?:       string | null  // from AI path
  invoice_number:   string | null
  issue_date:       string | null
  sale_date:        string | null
  net_amount:       number | null
  vat_amount:       number | null
  vat_rate:         number | null   // dominant VAT rate e.g. 23, 8, 5, 0
  gross_amount:     number | null
  currency:         string
  payment_due_date: string | null
  notes:            string | null
  // metadata
  extraction_confidence:      number   // 0–100
  extraction_warnings:        string[]
  requires_user_confirmation: boolean
  parser_source:              'ai' | 'regex' | 'manual'
}

/** Input to create an expense and link it to a project */
export interface CreateExpenseForProjectInput {
  company_id:    string
  project_id:    string
  // file (already uploaded)
  file_url?:     string | null
  file_name?:    string | null
  // core fields
  vendor_name:   string
  vendor_nip?:   string | null
  invoice_number?: string | null
  issue_date?:   string | null
  sale_date?:    string | null
  net_amount?:   number | null
  vat_amount?:   number | null
  gross_amount?: number | null
  currency?:     string
  payment_due_date?: string | null
  category?:     string | null
  cost_type?:    ExpenseCostType | string | null
  notes?:        string | null
  // OCR metadata
  source_type:                ExpenseSourceType
  extraction_confidence?:     number | null
  extraction_warnings?:       string[] | null
  requires_user_confirmation?: boolean | null
  parser_source?:              'ai' | 'regex' | 'manual' | null
}

// In-memory demo store for v4 project expenses
const demoProjectExpenses: ExpenseInvoiceV4[] = [
  {
    id: 'exp-v4-demo-1',
    company_id: 'demo-company',
    project_id: 'demo-project-1',
    project_name: 'Remont łazienki',
    file_url: null,
    file_name: 'faktura_v4.pdf',
    invoice_number: 'FV/2026/00999',
    vendor: 'Ceramika Design Sp. z o.o.',
    vendor_name: 'Ceramika Design Sp. z o.o.',
    vendor_nip: '5221234567',
    issue_date: '2026-04-01',
    amount_net: 2000.00,
    amount_vat: 460.00,
    amount_gross: 2460.00,
    description: 'Płytki wielkoformatowe 120x60',
    status: 'assigned',
    duplicate_of: null,
    source_type: 'pdf',
    cost_type: 'material',
    approval_status: 'accepted',
    extraction_confidence: 82,
    extraction_warnings: [],
    requires_user_confirmation: false,
    parser_source: 'regex',
    possible_duplicate: false,
    duplicate_of_expense_id: null,
    category: 'Materiały budowlane',
    currency: 'PLN',
    sale_date: '2026-04-01',
    payment_due_date: '2026-04-15',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export const projectExpensesApi = {
  /** List expenses for a specific project */
  async listForProject(projectId: string, companyId: string): Promise<ExpenseInvoiceV4[]> {
    if (isDemoMode || !supabase) {
      return demoProjectExpenses.filter((e) => e.project_id === projectId)
    }

    const { data, error } = await supabase
      .from('expense_invoices')
      .select('*')
      .eq('company_id', companyId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as ExpenseInvoiceV4[]
  },

  /** Create an expense and link it to a project. Checks for soft duplicates. */
  async createForProject(input: CreateExpenseForProjectInput): Promise<ExpenseInvoiceV4> {
    if (isDemoMode || !supabase) {
      const item: ExpenseInvoiceV4 = {
        id: `exp-v4-${Date.now()}`,
        company_id: input.company_id,
        project_id: input.project_id,
        file_url: input.file_url ?? null,
        file_name: input.file_name ?? null,
        invoice_number: input.invoice_number ?? null,
        vendor: input.vendor_name,
        vendor_name: input.vendor_name,
        vendor_nip: input.vendor_nip ?? null,
        issue_date: input.issue_date ?? null,
        amount_net: input.net_amount ?? null,
        amount_vat: input.vat_amount ?? null,
        amount_gross: input.gross_amount ?? null,
        description: input.notes ?? null,
        status: deriveExpenseStatus(input.extraction_confidence, input.project_id),
        duplicate_of: null,
        source_type: input.source_type,
        cost_type: input.cost_type ?? null,
        approval_status: 'not_sent',
        extraction_confidence: input.extraction_confidence ?? null,
        extraction_warnings: input.extraction_warnings ?? null,
        requires_user_confirmation: input.requires_user_confirmation ?? null,
        parser_source: input.parser_source ?? null,
        possible_duplicate: false,
        duplicate_of_expense_id: null,
        category: input.category ?? null,
        currency: input.currency ?? 'PLN',
        sale_date: input.sale_date ?? null,
        payment_due_date: input.payment_due_date ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      demoProjectExpenses.unshift(item)
      return item
    }

    // Soft duplicate check (non-blocking — just sets flag on new record)
    let possibleDuplicate = false
    if (input.invoice_number && input.vendor_nip) {
      const { data: dupCheck } = await supabase
        .from('expense_invoices')
        .select('id')
        .eq('company_id', input.company_id)
        .eq('invoice_number', input.invoice_number)
        .eq('vendor_nip', input.vendor_nip)
        .limit(1)
      if (dupCheck && dupCheck.length > 0) possibleDuplicate = true
    }

    const { data, error } = await supabase
      .from('expense_invoices')
      .insert({
        company_id:    input.company_id,
        project_id:    input.project_id,
        file_url:      input.file_url ?? null,
        file_name:     input.file_name ?? null,
        invoice_number: input.invoice_number ?? null,
        vendor:        input.vendor_name,
        vendor_nip:    input.vendor_nip ?? null,
        issue_date:    input.issue_date ?? null,
        sale_date:     input.sale_date ?? null,
        amount_net:    input.net_amount ?? null,
        amount_vat:    input.vat_amount ?? null,
        amount_gross:  input.gross_amount ?? null,
        description:   input.notes ?? null,
        status: deriveExpenseStatus(input.extraction_confidence, input.project_id),
        source_type:   input.source_type,
        cost_type:     input.cost_type ?? null,
        approval_status: 'not_sent',
        extraction_confidence:      input.extraction_confidence ?? null,
        extraction_warnings:        input.extraction_warnings ?? null,
        requires_user_confirmation: input.requires_user_confirmation ?? null,
        parser_source:              input.parser_source ?? null,
        possible_duplicate:         possibleDuplicate,
        category:      input.category ?? null,
        currency:      input.currency ?? 'PLN',
        payment_due_date: input.payment_due_date ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    return data as ExpenseInvoiceV4
  },
}
