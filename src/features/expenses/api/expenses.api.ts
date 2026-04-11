// =============================================================================
// Expense Invoices API — scan/upload cost invoices, assign to projects
// =============================================================================

import { isDemoMode, supabase } from '@/shared/lib/supabase'
import type { DocumentLineItem, AnalysisResult } from '@/services/ai/analysis.types'

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

/**
 * Normalize extraction_confidence from JS scale (0–100) to DB scale (0.00–1.00).
 * The numeric(3,2) column with CHECK(>=0 AND <=1) rejects values >1.
 */
function normalizeConfidenceForDb(confidence: number | null | undefined): number | null {
  if (confidence == null) return null
  // Already in 0–1 range (e.g. from a future fix) — pass through
  if (confidence >= 0 && confidence <= 1) return Math.round(confidence * 100) / 100
  // 0–100 → 0.00–1.00
  return Math.round(Math.min(100, Math.max(0, confidence))) / 100
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
  /** Sale date from document (migration 038 column). */
  sale_date?: string | null
  /** Payment due date from document (migration 038 column). */
  payment_due_date?: string | null
  /** Invoice currency (migration 038 column, default 'PLN'). */
  currency?: string | null
  /** Full OCR/AI parse envelope — populated by Flow A (AnalysisResult) or Flow B (FlowBParseRaw). */
  parse_raw?: AnalysisResult | Record<string, unknown> | null
}

export interface ParsedExpenseData {
  invoice_number?: string
  vendor?: string
  vendor_nip?: string
  /** Parsed from document — display only. Not persisted in legacy expense_invoices columns. */
  buyer_name?: string | null
  /** Parsed from document — display only. Not persisted in legacy expense_invoices columns. */
  buyer_nip?: string | null
  issue_date?: string
  amount_net?: number
  amount_vat?: number
  amount_gross?: number
  description?: string
  /** Line items from AI path — display only. Not persisted via legacy expensesApi.create(). */
  line_items?: DocumentLineItem[]
  /** Sale date — persisted to DB (sale_date column, migration 038). */
  sale_date?: string | null
  /** Payment due date — persisted to DB (payment_due_date column, migration 038). */
  payment_due_date?: string | null
  /** Currency code — persisted to DB (currency column, migration 038). Defaults to 'PLN'. */
  currency?: string | null
}
/**
 * Compact payload stored in parse_raw JSONB by Flow B (legacy expensesApi.create()).
 * Preserves buyer_name, buyer_nip, and line_items that have no dedicated DB columns,
 * along with extraction metadata for debugging. Allows rehydration on edit/view.
 */
export interface FlowBParseRaw {
  /** Identifies this as a Flow B parse_raw payload. */
  flow: 'b'
  buyer_name?: string | null
  buyer_nip?: string | null
  line_items?: DocumentLineItem[]
  parser_source?: string | null
  extraction_confidence?: number | null
  extraction_warnings?: string[] | null
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
  // Also normalize non-breaking spaces that PDF generators use as thousands separators.
  const t = text
    .replace(/[\u00A0\u2009\u202F\u2007]/g, ' ')
    .replace(/\s+/g, ' ')

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

  // ── NIP — extract first as vendor, labelled/second as buyer (mirrors parse-invoice.ts) ───
  // Buyer NIP — try labelled form first ("NIP nabywcy", "NIP kupującego", etc.)
  const buyerNipLabelMatch = t.match(/NIP\s*(?:nabywcy|kupuj[aą]cego|odbiorcy|zamawiaj[aą]cego)[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/i)
  if (buyerNipLabelMatch) {
    const digits = buyerNipLabelMatch[1].replace(/[\s\-]/g, '')
    if (digits.length === 10) result.buyer_nip = digits
  }
  const nipMatch = t.match(/NIP[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/i)
  if (nipMatch) {
    const digits = nipMatch[1].replace(/[\s\-]/g, '')
    if (digits.length === 10) result.vendor_nip = digits
  }
  // If no labelled buyer NIP, pick second NIP occurrence as potential buyer
  if (!result.buyer_nip) {
    const allNips = [...t.matchAll(/NIP[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/gi)]
    if (allNips.length >= 2) {
      const secondDigits = allNips[1][1].replace(/[\s\-]/g, '')
      if (secondDigits.length === 10 && secondDigits !== result.vendor_nip) result.buyer_nip = secondDigits
    }
  }

  // ── Buyer name ────────────────────────────────────────────────────────────
  const buyerLabelMatch = t.match(/(?:nabywca|kupuj[aą]cy|odbiorca|zamawiaj[aą]cy)[:\s]+([^\n,;(]{4,60})/i)
  if (buyerLabelMatch) result.buyer_name = buyerLabelMatch[1].trim().replace(/\s{2,}/g, ' ').slice(0, 80)

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

  // Last-resort: scan first 15 non-empty lines for any company-like content.
  // Skips headings, dates, NIP lines, and buyer-section labels — same logic as
  // parse-invoice.ts to avoid grabbing nabywca/odbiorca name as vendor.
  if (!result.vendor) {
    const SKIP_LINE = /^(?:faktura|fv|fa|fs|fz|vat|nip[:\s]|pesel[:\s]|data[\s:]|nr[\s:.]|numer|suma|brutto|netto|razem|wystawiono|termin|zaliczka|orygi|kopia|nabywca|kupuj[aą]cy|odbiorca|zamawiaj[aą]cy|\d{4}[\-.\/]\d{2}|\d{1,2}[\-.\/]\d{1,2}[\-.\/]\d{4})/i
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

  // ── Sale date ─────────────────────────────────────────────────────────────
  const saleDateMatch = t.match(
    /(?:data\s+sprzeda[żz]y(?:\s*[/\\]?\s*dostawy)?|data\s+dostawy|data\s+us[łl]ugi|data\s+wykonania)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{4}|\d{4}[.\/\-]\d{1,2}[.\/\-]\d{1,2})/i
  )
  if (saleDateMatch) result.sale_date = normalizeDatePl(saleDateMatch[1])

  // ── Payment due date ──────────────────────────────────────────────────────
  const dueDateMatch = t.match(
    /(?:termin\s+zap[łl]aty|termin\s+p[łl]atno[śs]ci|p[łl]atno[śs][ćc]\s+do|zap[łl]ata\s+do|data\s+zap[łl]aty|p[łl]atne\s+do|zap[łl]a[ćc]\s+do)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{4}|\d{4}[.\/\-]\d{1,2}[.\/\-]\d{1,2})/i
  )
  if (dueDateMatch) result.payment_due_date = normalizeDatePl(dueDateMatch[1])

  // ── Currency ──────────────────────────────────────────────────────────────
  const currencyMatch = t.match(/\b(PLN|EUR|USD|GBP|CHF|CZK|NOK|SEK|DKK)\b/i)
  result.currency = currencyMatch ? currencyMatch[1].toUpperCase() : 'PLN'

  // ── Amounts (gross / net) — currency suffix is optional ──────────────────
  // Broadened to catch more Polish label variants (ogółem, łączna kwota, wartość faktury)
  const grossMatch = t.match(
    /(?:do\s+zap[łl]aty|razem\s+brutto|kwota\s+brutto|warto[śs][ćc]\s+brutto|sum[ma]?\s+brutto|brutto\s+p[łl]atno[śs][ćc]?|brutto|og[oó][łl]em\s+(?:do\s+zap[łl]aty|brutto)?|[łl][aą]czna\s+kwota|warto[śs][ćc]\s+faktury|kwota\s+og[oó][łl]em)[:\s]+([0-9]+[,. ][0-9]{0,3}[,. ]?[0-9]{0,2})\s*(?:PLN|z[łl]|EUR)?/i
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

  // ── Line items extraction ─────────────────────────────────────────────────
  // Polish invoice tables typically have rows like:
  //   1. Płytki ceramiczne  40  m²  30,00  1200,00  23  276,00  1476,00
  // We look for lines starting with a row number or containing a pattern of
  // name + numbers that looks like an invoice item row.
  result.line_items = extractLineItems(text)

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

/**
 * Extract line items from raw invoice text using regex patterns.
 * Matches rows like: "1. Płytki ceramiczne 40 m² 30,00 1200,00 23% 276,00 1476,00"
 * or tab/space-separated table rows with numeric patterns at the end.
 */
function extractLineItems(rawText: string): DocumentLineItem[] {
  const items: DocumentLineItem[] = []
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3)

  // Pattern: row number + item name + quantity + unit + amounts
  // Captures: [rowNum] name qty unit price net [vat%] [vatAmt] gross
  const ROW_PATTERN = /^(\d{1,3})[.)\s]+(.{3,80}?)\s+(\d+[.,]?\d*)\s+(szt|m[²2³3]?|mb|kg|l|kpl|op|rbh?|godz?|h|ton|pal|ark)\s+(\d+[\s]?\d*[.,]\d{2})/i

  // Simpler pattern: just name followed by amounts at end of line
  const SIMPLE_ROW = /^(\d{1,3})[.)\s]+(.{3,60}?)\s+(\d+[\s]?\d*[.,]\d{2})\s+(\d+[\s]?\d*[.,]\d{2})\s*$/

  for (const line of lines) {
    const match = line.match(ROW_PATTERN)
    if (match) {
      const name = match[2].trim()
      const qty = parseFloat(match[3].replace(',', '.'))
      const unit = match[4]
      // Extract all amounts from the rest of the line after unit
      const afterUnit = line.slice(line.indexOf(match[4]) + match[4].length)
      const amounts = [...afterUnit.matchAll(/(\d+[\s]?\d*[.,]\d{2})/g)].map(m => parsePolishAmount(m[1]))

      const item: DocumentLineItem = {
        name,
        quantity: qty,
        unit,
        unit_net: amounts.length >= 1 ? amounts[0] : null,
        net_amount: amounts.length >= 2 ? amounts[1] : amounts[0] ?? null,
        vat_rate: null,
        vat_amount: null,
        gross_amount: amounts.length >= 3 ? amounts[amounts.length - 1] : null,
      }
      // Try to find vat rate (a number like 23, 8, 5, 0 possibly with %)
      const vatRateMatch = afterUnit.match(/\b(23|8|5|0|7)\s*%/)
      if (vatRateMatch) item.vat_rate = parseInt(vatRateMatch[1], 10)

      if (amounts.length >= 4) {
        item.net_amount = amounts[1]
        item.vat_amount = amounts[amounts.length - 2]
        item.gross_amount = amounts[amounts.length - 1]
      }

      items.push(item)
      continue
    }

    // Try simpler pattern for minimal table rows
    const simpleMatch = line.match(SIMPLE_ROW)
    if (simpleMatch) {
      items.push({
        name: simpleMatch[2].trim(),
        quantity: null,
        unit: null,
        unit_net: null,
        net_amount: parsePolishAmount(simpleMatch[3]),
        vat_rate: null,
        vat_amount: null,
        gross_amount: parsePolishAmount(simpleMatch[4]),
      })
    }
  }

  return items
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
    /** Parser that produced this result ('ai' | 'regex' | 'manual' | 'vision'). */
    parserSource?: 'ai' | 'regex' | 'manual' | 'vision' | null
    /** Raw extraction warnings from OCR/AI — persisted to extraction_warnings column. */
    extractionWarnings?: string[] | null
    /** Compact parse_raw payload to persist buyer/line_items (no dedicated DB columns). */
    parseRaw?: Record<string, unknown> | null
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
        sale_date: input.parsed?.sale_date ?? null,
        payment_due_date: input.parsed?.payment_due_date ?? null,
        currency: input.parsed?.currency ?? 'PLN',
        parse_raw: input.parseRaw ?? null,
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
        extraction_confidence: normalizeConfidenceForDb(input.extractionConfidence),
        sale_date: input.parsed?.sale_date ?? null,
        payment_due_date: input.parsed?.payment_due_date ?? null,
        currency: input.parsed?.currency ?? 'PLN',
        parser_source: input.parserSource ?? null,
        extraction_warnings: input.extractionWarnings ?? [],
        parse_raw: input.parseRaw ?? null,
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
    delete payload.parse_raw   // never overwrite parse_raw via edit-form path
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

export type ExpenseSourceType    = 'camera' | 'gallery' | 'pdf' | 'manual' | 'room_photo'
export type ExpenseCostType      = 'material' | 'service' | 'equipment' | 'labor' | 'transport' | 'other'
export type ExpenseApprovalStatus = 'not_sent' | 'pending_client' | 'accepted' | 'rejected' | 'questioned'

/** Extended ExpenseInvoice — adds Etap 1 new columns (all optional for backward compat) */
export interface ExpenseInvoiceV4 extends ExpenseInvoice {
  // vendor_name is aliased from "vendor" for clarity in new code
  vendor_name?:              string | null
  source_type?:              ExpenseSourceType | null
  cost_type?:                ExpenseCostType | string | null
  billing_type?:             'included' | 'additional' | null
  approval_status?:          ExpenseApprovalStatus | null
  extraction_confidence?:    number | null
  extraction_warnings?:      string[] | null
  requires_user_confirmation?: boolean | null
  parser_source?:            'ai' | 'regex' | 'manual' | 'vision' | null
  possible_duplicate?:       boolean | null
  duplicate_of_expense_id?:  string | null
  category?:                 string | null
  currency?:                 string | null
  sale_date?:                string | null
  payment_due_date?:         string | null
  // Full analysis envelope (from parse_raw JSONB)
  parse_raw?:                AnalysisResult | Record<string, unknown> | null
}

/** The result returned by /.netlify/functions/parse-invoice */
export type { DocumentLineItem as ParseInvoiceLineItem } from '@/services/ai/analysis.types'
export type { AnalysisResult as ParseDocumentResult }     from '@/services/ai/analysis.types'
export {       toAnalysisResult, flattenAnalysisResult, classifyInputType, rehydrateAnalysisResult } from '@/services/ai/analysis.types'
export type {
  AnalysisResult,
  AnalysisInputType,
  AnalysisDocumentType,
  DocumentFields,
  DocumentLineItem,
  DetectedEntity,
  DetectedMaterial,
  WorkScopeItem,
  SuggestedEstimateItem,
  SectionConfidence,
} from '@/services/ai/analysis.types'

/**
 * Flat parse result from Netlify OCR/AI functions.
 * Active consumers use this shape directly — it maps 1:1 from the server response.
 * For the generalized envelope, see AnalysisResult (via toAnalysisResult()).
 */
export interface ParseInvoiceResult {
  document_type:  'invoice' | 'receipt' | 'bill' | 'other' | null
  vendor_name:      string | null
  vendor_nip:       string | null
  vendor_address?:  string | null
  buyer_name?:      string | null
  buyer_nip?:       string | null
  buyer_address?:   string | null
  line_items?:      DocumentLineItem[]
  invoice_number:   string | null
  issue_date:       string | null
  sale_date:        string | null
  net_amount:       number | null
  vat_amount:       number | null
  vat_rate:         number | null
  gross_amount:     number | null
  currency:         string
  payment_due_date: string | null
  notes:            string | null
  // metadata
  extraction_confidence:      number   // 0–100
  extraction_warnings:        string[]
  requires_user_confirmation: boolean
  parser_source:              'ai' | 'regex' | 'manual' | 'vision'
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
  billing_type?: 'included' | 'additional' | null
  notes?:        string | null
  // OCR metadata
  source_type:                ExpenseSourceType
  extraction_confidence?:     number | null
  extraction_warnings?:       string[] | null
  requires_user_confirmation?: boolean | null
  parser_source?:              'ai' | 'regex' | 'manual' | 'vision' | null
  // Full analysis envelope (persisted to parse_raw JSONB for future use)
  analysis_payload?:          AnalysisResult | null
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
        extraction_confidence: normalizeConfidenceForDb(input.extraction_confidence),
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
        parse_raw: input.analysis_payload ?? null,
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
        // Omit when null so DB DEFAULT applies (explicit null bypasses DEFAULT in PostgreSQL)
        ...(input.cost_type != null ? { cost_type: input.cost_type } : {}),
        ...(input.billing_type != null ? { billing_type: input.billing_type } : {}),
        approval_status: 'not_sent',
        // extraction_confidence: nullable smallint, null is fine
        extraction_confidence: normalizeConfidenceForDb(input.extraction_confidence),
        // extraction_warnings: NOT NULL DEFAULT '{}'::text[] — omit when absent so DEFAULT applies
        ...(input.extraction_warnings != null ? { extraction_warnings: input.extraction_warnings } : {}),
        // requires_user_confirmation: NOT NULL DEFAULT false — omit when absent so DEFAULT applies
        ...(input.requires_user_confirmation != null ? { requires_user_confirmation: input.requires_user_confirmation } : {}),
        parser_source:   input.parser_source ?? null,
        possible_duplicate: possibleDuplicate,
        category:      input.category ?? null,
        currency:      input.currency ?? 'PLN',
        payment_due_date: input.payment_due_date ?? null,
        parse_raw:     input.analysis_payload ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    return data as ExpenseInvoiceV4
  },
}
