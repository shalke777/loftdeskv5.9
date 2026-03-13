// =============================================================================
// Netlify Function: parse-invoice
// =============================================================================
// Parses expense invoice data from a file (image or PDF with text layer).
//
// Two execution paths:
//   A. PDF with text layer  → buffer scan + regex parser → confidence based on filled fields
//   B. Image               → Tesseract.js OCR (pol+eng) → regex parser
//
// Image OCR is always available — no API key required.
//
// Request:
//   POST /.netlify/functions/parse-invoice
//   Content-Type: application/json
//   Body: { file_base64: string, file_name: string, file_type: string, source_type: string }
//
// Response 200:
//   { vendor_name, vendor_nip, invoice_number, issue_date, sale_date,
//     net_amount, vat_amount, gross_amount, currency, payment_due_date, notes,
//     extraction_confidence, extraction_warnings, requires_user_confirmation, parser_source }
//
// Response 4xx: { error: string }

import type { Handler, HandlerEvent } from '@netlify/functions'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParseInvoiceResult {
  vendor_name:    string | null
  vendor_nip:     string | null
  invoice_number: string | null
  issue_date:     string | null
  sale_date:      string | null
  net_amount:     number | null
  vat_amount:     number | null
  gross_amount:   number | null
  currency:       string
  payment_due_date: string | null
  notes:          string | null
  // metadata
  extraction_confidence:    number   // 0–100
  extraction_warnings:      string[]
  requires_user_confirmation: boolean
  parser_source:            'ai' | 'regex' | 'manual'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_BASE64_CHARS = 7_000_000 // ~5MB raw file
const IMAGE_TYPES      = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif']

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) }
}

// ─── Tesseract OCR extraction ────────────────────────────────────────────────

async function extractViaOCR(
  fileBase64: string,
): Promise<{ text: string; warnings: string[] }> {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — tesseract.js is installed in netlify/functions/node_modules, not root
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker(['pol', 'eng'], 1, {
      logger: () => {}, // suppress progress output in function logs
    })
    const buffer = Buffer.from(fileBase64, 'base64')
    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()

    const trimmed = text.trim()
    if (trimmed.length < 10) {
      return { text: '', warnings: ['OCR nie wykrył tekstu na obrazie — uzupełnij dane ręcznie'] }
    }
    return { text: trimmed, warnings: [] }
  } catch (e: unknown) {
    return {
      text: '',
      warnings: [`Błąd OCR: ${e instanceof Error ? e.message : String(e)}`],
    }
  }
}

// ─── PDF text extraction ─────────────────────────────────────────────────────

/**
 * Basic text extraction from PDF buffer.
 * Works for PDFs with embedded text layer (generated PDFs, e-invoices).
 * Does NOT work for scanned PDFs (image-only) — those return empty string.
 */
function extractTextFromPDF(buffer: Buffer): string {
  const chunks: string[] = []

  try {
    const str = buffer.toString('binary')

    // Extract BT...ET text blocks (PDF text operators)
    const btEtRegex = /BT([\s\S]{1,4096}?)ET/g
    let m: RegExpExecArray | null
    while ((m = btEtRegex.exec(str)) !== null) {
      const block = m[1]
      const strRegex = /\(([^)]{1,200})\)/g
      let sm: RegExpExecArray | null
      while ((sm = strRegex.exec(block)) !== null) {
        const decoded = sm[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, ' ')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\')
          // Keep printable ASCII + Polish chars
          .replace(/[^\x20-\x7E\u00C0-\u017E\n]/g, ' ')
        const clean = decoded.trim()
        if (clean.length > 1) chunks.push(clean)
      }
    }

    // Also try /F (font) strings between parentheses at top level
    if (chunks.length < 3) {
      const topRegex = /\(([^\)]{3,120})\)\s*Tj/g
      let tm: RegExpExecArray | null
      while ((tm = topRegex.exec(str)) !== null) {
        const clean = tm[1].replace(/[^\x20-\x7E\u00C0-\u017E]/g, ' ').trim()
        if (clean.length > 2) chunks.push(clean)
      }
    }
  } catch {
    // Ignore extraction errors — just return empty
  }

  return chunks.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 50_000)
}

// ─── Regex parser (inline from expenses.api.ts logic) ───────────────────────

function parseTextWithRegex(text: string): Omit<ParseInvoiceResult, 'extraction_confidence' | 'extraction_warnings' | 'requires_user_confirmation' | 'parser_source'> {
  const t = text.replace(/\s+/g, ' ')
  const result: Record<string, unknown> = { currency: 'PLN', notes: null }

  // Invoice number
  const numMatch = t.match(/(?:(?:nr|numer|faktura(?:\s+(?:nr|numer|vat))?|fv(?:at)?|fs(?:vat)?|rachun(?:ek|ku))[\s:#\/]*)((?:[A-Z0-9]{1,6}[\/\-\s]){1,3}[A-Z0-9]{1,8})/i)
  if (numMatch) result.invoice_number = numMatch[1].trim().replace(/\s*\/\s*/g, '/').toUpperCase()

  // Fallback: standalone FV… pattern (OCR may omit leading keyword)
  if (!result.invoice_number) {
    const fvAlone = t.match(/\b((?:FV|FA|FS|FZ|RF|RV)(?:AT)?[\s\/\-]?(?:\d{4}[\s\/\-])?\d{1,5}[\s\/\-]\d{1,4})\b/i)
    if (fvAlone) {
      result.invoice_number = fvAlone[1]
        .trim()
        .replace(/\s+([\/ \-])\s+/g, '$1')
        .replace(/\s+/g, '/')
        .toUpperCase()
    }
  }

  // NIP
  const nipMatch = t.match(/NIP[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/i)
  if (nipMatch) {
    const digits = nipMatch[1].replace(/[\s\-]/g, '')
    if (digits.length === 10) result.vendor_nip = digits
  }

  // Vendor name
  const vendorLabelMatch = t.match(/(?:sprzedawca|wystawca|sprzedaj[aą]cy|firma|dostawca|wykonawca)[:\s]+([^\n,;(]{4,60}(?:sp\.\s*z\.?\s*o\.?\.?o\.?|s\.?a\.?|sp\.\s*j\.?|ltd|gmbh)?[^\n,;(]{0,30})/i)
  if (vendorLabelMatch) result.vendor_name = vendorLabelMatch[1].trim().replace(/\s{2,}/g, ' ')
  if (!result.vendor_name) {
    const companyMatch = t.match(/([A-ZŁÓŚĄŹĆĘŃ][A-Za-ząęółśźćń\s\.\-"]{3,50}(?:Sp\.\s*z\s*o\.o\.|S\.A\.|Sp\.\s*j\.|Ltd\.|GmbH|s\.c\.))/i)
    if (companyMatch) result.vendor_name = companyMatch[1].trim()
  }

  // Issue date
  const dateMatch = t.match(/(?:data\s+(?:wystawienia|sprzeda[żz]y|faktury|wyst\.?)|wystawiono|data\s+fv|data)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i)
  if (dateMatch) result.issue_date = normalizeDatePl(dateMatch[1])

  // Sale date
  const saleDateMatch = t.match(/(?:data\s+sprzeda[żz]y|data\s+dostawy|data\s+wykonania)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i)
  if (saleDateMatch) result.sale_date = normalizeDatePl(saleDateMatch[1])

  // Due date
  const dueMatch = t.match(/(?:termin\s+p[łl]atno[śs][ćc]i?|termin\s+zap[łl]aty|p[łl]atno[śs][ćc]\s+do)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i)
  if (dueMatch) result.payment_due_date = normalizeDatePl(dueMatch[1])

  // Currency
  if (/\bEUR\b/i.test(t)) result.currency = 'EUR'
  else if (/\bUSD\b/i.test(t)) result.currency = 'USD'
  else if (/\bGBP\b/i.test(t)) result.currency = 'GBP'

  // Gross amount
  const grossMatch = t.match(/(?:do\s+zap[\u0142l]aty|razem\s+brutto|kwota\s+brutto|warto[\u015bs][\u0107c]\s+brutto|sum[ma]?\s+brutto|brutto)[:\s]+([0-9]+[\s]?[0-9]{0,3}[,.][0-9]{1,2})\s*(?:PLN|z[\u0142l]|EUR|USD)?/i)
  if (grossMatch) { const v = parsePolishAmount(grossMatch[1]); if (v > 0) result.gross_amount = v }

  // Net amount
  const netMatch = t.match(/(?:razem\s+netto|kwota\s+netto|warto[\u015bs][\u0107c]\s+netto|suma\s+netto|netto)[:\s]+([0-9]+[\s]?[0-9]{0,3}[,.][0-9]{1,2})\s*(?:PLN|z[\u0142l]|EUR)?/i)
  if (netMatch) { const v = parsePolishAmount(netMatch[1]); if (v > 0) result.net_amount = v }

  // VAT
  const vatMatch = t.match(/(?:kwota\s+vat|podatek\s+vat|vat\s+razem|suma\s+vat)[:\s]+([0-9]+[\s]?[0-9]{0,3}[,.][0-9]{1,2})\s*(?:PLN|z[\u0142l]|EUR)?/i)
  if (vatMatch) { const v = parsePolishAmount(vatMatch[1]); if (v > 0) result.vat_amount = v }

  // Fallback gross: look for "do zaplaty" (no diacritics from OCR) + number
  if (!result.gross_amount) {
    const fallbackGross = t.match(/(?:do\s+zaplaty|do\s+zap[\u0142l]aty|total|ogolnie|ogolna|summary)[:\s]+([0-9]{1,6}[\s]?[0-9]{0,3}[,.][0-9]{1,2})/i)
    if (fallbackGross) { const v = parsePolishAmount(fallbackGross[1]); if (v > 0) result.gross_amount = v }
  }

  // Fallback gross: last decimal number preceded or followed by currency
  if (!result.gross_amount) {
    const allWithCurrency = [...t.matchAll(/([0-9]{1,6}(?:[\s][0-9]{3})*[,.][0-9]{2})\s*(?:PLN|z[\u0142l])/gi)]
    if (allWithCurrency.length > 0) {
      const amounts = allWithCurrency.map(m => parsePolishAmount(m[1])).filter(v => v > 0)
      if (amounts.length > 0) result.gross_amount = amounts[amounts.length - 1] // last = likely total
    }
  }

  // Derive missing amount
  const g = result.gross_amount as number | undefined
  const n = result.net_amount  as number | undefined
  const va = result.vat_amount  as number | undefined
  if (g && n && !va) result.vat_amount  = Math.round((g - n) * 100) / 100
  else if (g && va && !n) result.net_amount   = Math.round((g - va) * 100) / 100
  else if (n && va && !g) result.gross_amount = Math.round((n + va) * 100) / 100

  return {
    vendor_name:      (result.vendor_name as string) ?? null,
    vendor_nip:       (result.vendor_nip as string) ?? null,
    invoice_number:   (result.invoice_number as string) ?? null,
    issue_date:       (result.issue_date as string) ?? null,
    sale_date:        (result.sale_date as string) ?? null,
    net_amount:       (result.net_amount as number) ?? null,
    vat_amount:       (result.vat_amount as number) ?? null,
    gross_amount:     (result.gross_amount as number) ?? null,
    currency:         result.currency as string,
    payment_due_date: (result.payment_due_date as string) ?? null,
    notes:            null,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePolishAmount(raw: string): number {
  const s = raw.trim()
  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')
  const normalized = lastComma > lastDot
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '')
  return parseFloat(normalized.replace(/\s/g, '')) || 0
}

function normalizeDatePl(raw: string): string {
  const clean = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  const parts = clean.split(/[.\/\-]/)
  if (parts.length === 3) {
    if (parts[0].length <= 2 && parts[2].length === 4)
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
    if (parts[0].length === 4 && parts[2].length <= 2)
      return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
  }
  return clean
}

function validateDate(raw: string): string | null {
  if (!raw || raw === 'null') return null
  const d = normalizeDatePl(raw)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

function calcConfidence(r: Partial<ParseInvoiceResult>): number {
  let score = 0
  if (r.vendor_name)                          score += 20
  if (r.invoice_number)                       score += 25
  if (r.issue_date)                           score += 20
  if (r.gross_amount != null && r.gross_amount > 0) score += 25
  if (r.vendor_nip)                           score += 10
  return score
}

function buildWarnings(r: Partial<ParseInvoiceResult>): string[] {
  const w: string[] = []
  if (!r.vendor_name)    w.push('Nie rozpoznano nazwy sprzedawcy')
  if (!r.invoice_number) w.push('Nie rozpoznano numeru faktury')
  if (!r.gross_amount)   w.push('Nie rozpoznano kwoty do zapłaty')
  if (!r.issue_date)     w.push('Nie rozpoznano daty wystawienia')
  if (r.issue_date) {
    const d = new Date(r.issue_date)
    if (d > new Date()) w.push('Data wystawienia jest w przyszłości — sprawdź')
  }
  if (r.net_amount && r.vat_amount && r.gross_amount) {
    const calc = Math.round((r.net_amount + r.vat_amount) * 100) / 100
    if (Math.abs(calc - r.gross_amount) > 0.02)
      w.push(`Sprzeczne kwoty: netto ${r.net_amount} + VAT ${r.vat_amount} ≠ brutto ${r.gross_amount}`)
  }
  if (r.vendor_nip && !/^\d{10}$/.test(r.vendor_nip))
    w.push('NIP nie ma dokładnie 10 cyfr — zweryfikuj')
  return w
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST')    return json(405, { error: 'method_not_allowed' })

  // ── Parse request body ────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  const file_base64 = body.file_base64 as string | undefined
  const file_name   = String(body.file_name  ?? 'file')
  const file_type   = String(body.file_type  ?? 'application/octet-stream').toLowerCase()
  const source_type = String(body.source_type ?? 'manual')

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!file_base64) {
    // No file → manual entry mode → return empty result
    return json(200, {
      ...emptyResult(),
      parser_source: 'manual',
      extraction_confidence: 0,
      extraction_warnings:   ['Brak pliku — uzupełnij dane ręcznie'],
      requires_user_confirmation: true,
    })
  }

  if (file_base64.length > MAX_BASE64_CHARS) {
    return json(413, { error: 'file_too_large', message: 'Plik jest za duży (max ~5 MB). Skompresuj lub wybierz mniejszy plik.' })
  }

  // ── Decode ────────────────────────────────────────────────────────────────
  let buffer: Buffer
  try {
    buffer = Buffer.from(file_base64, 'base64')
  } catch {
    return json(400, { error: 'invalid_base64' })
  }

  // ── Extract text ──────────────────────────────────────────────────────────
  const isPDF   = file_type === 'application/pdf' || file_name.toLowerCase().endsWith('.pdf')
  const isImage = IMAGE_TYPES.includes(file_type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file_name)

  let extractedText  = ''
  let parserSource: ParseInvoiceResult['parser_source'] = 'regex'
  const baseWarnings: string[] = []

  if (isPDF) {
    extractedText = extractTextFromPDF(buffer)
    if (!extractedText.trim()) {
      baseWarnings.push('Nie udało się wyodrębnić tekstu z PDF (prawdopodobnie skan — uzupełnij dane ręcznie)')
    }
  } else if (isImage) {
    const ocrResult = await extractViaOCR(file_base64)
    extractedText   = ocrResult.text
    baseWarnings.push(...ocrResult.warnings)
    parserSource    = 'regex'
  } else {
    baseWarnings.push(`Nieobsługiwany typ pliku: ${file_type}`)
    parserSource = 'manual'
  }

  // ── Regex parse ───────────────────────────────────────────────────────────
  const parsed     = parseTextWithRegex(extractedText)
  const confidence = calcConfidence(parsed)
  const warnings   = [...baseWarnings, ...buildWarnings(parsed)]

  return json(200, {
    ...parsed,
    parser_source: parserSource,
    extraction_confidence:    confidence,
    extraction_warnings:      warnings,
    requires_user_confirmation: confidence < 70 || warnings.length > 0,
  } satisfies ParseInvoiceResult)
}

function emptyResult(): Omit<ParseInvoiceResult, 'extraction_confidence' | 'extraction_warnings' | 'requires_user_confirmation' | 'parser_source'> {
  return {
    vendor_name: null, vendor_nip: null, invoice_number: null,
    issue_date: null,  sale_date: null,  net_amount: null,
    vat_amount: null,  gross_amount: null, currency: 'PLN',
    payment_due_date: null, notes: null,
  }
}
