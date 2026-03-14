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
import * as zlib from 'node:zlib'
import { promisify } from 'node:util'

const inflateRawAsync = promisify(zlib.inflateRaw)
const inflateAsync    = promisify(zlib.inflate)

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

// ─── PDF embedded JPEG extraction ────────────────────────────────────────────

/**
 * Finds JPEG images embedded inside a PDF binary (FF D8 FF … FF D9 pattern).
 * Most office scanners and phone PDF-print tools store each page as a DCTDecode
 * (JPEG) image, so this works for the common "scanned PDF" case without needing
 * pdfjs-dist or the native `canvas` package.
 */
function extractEmbeddedJpegsFromPdf(buffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = []
  const SOI = Buffer.from([0xFF, 0xD8, 0xFF]) // JPEG start-of-image
  const EOI = Buffer.from([0xFF, 0xD9])        // JPEG end-of-image
  let pos = 0
  while (pos < buffer.length - 3) {
    const soiIdx = buffer.indexOf(SOI, pos)
    if (soiIdx < 0) break
    // Start scanning for EOI at least 500 bytes in (skip JPEG headers / metadata)
    const eoiSearch = soiIdx + 500
    const eoiIdx    = eoiSearch < buffer.length ? buffer.indexOf(EOI, eoiSearch) : -1
    if (eoiIdx < 0) { pos = soiIdx + 3; continue }
    const end = eoiIdx + 2 // include the 2-byte EOI marker
    // Accept only images > 10 KB — skip tiny thumbnails / color-space descriptors
    if (end - soiIdx > 10_000) {
      const jpeg = Buffer.allocUnsafe(end - soiIdx)
      buffer.copy(jpeg, 0, soiIdx, end)
      jpegs.push(jpeg)
    }
    pos = end
  }
  return jpegs
}

// ─── PDF text helpers ─────────────────────────────────────────────────────────

/** Extract Tj/TJ text-show operators from a decompressed PDF content stream */
function extractTjFromStream(stream: string): string {
  const parts: string[] = []

  // (text) Tj — single string
  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g
  let m: RegExpExecArray | null
  while ((m = tjRe.exec(stream)) !== null) {
    const t = decodePdfStr(m[1])
    if (t.trim()) parts.push(t.trim())
  }

  // [(text) kern ...] TJ — text array (kerned)
  const tjArrRe = /\[([^\]]+)\]\s*TJ/g
  while ((m = tjArrRe.exec(stream)) !== null) {
    const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g
    let sm: RegExpExecArray | null
    while ((sm = strRe.exec(m[1])) !== null) {
      const t = decodePdfStr(sm[1])
      if (t.trim()) parts.push(t.trim())
    }
  }

  return parts.join(' ')
}

function decodePdfStr(s: string): string {
  return s
    .replace(/\\n/g, ' ').replace(/\\r/g, '').replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    // strip remaining control chars, keep printable ASCII + Polish latin-1
    .replace(/[^\x20-\x7E\u00C0-\u017E]/g, ' ')
}

// ─── PDF text extraction ─────────────────────────────────────────────────────

/**
 * Extracts embedded text from a PDF buffer using Node.js zlib to decompress
 * FlateDecode content streams (used by all modern PDFs generated by iFirma,
 * Fakturownia, Comarch, Word, LibreOffice etc.).
 *
 * Scanned PDFs (image-only) have no text streams — those return empty string
 * and fall through to the JPEG OCR extraction path.
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const chunks: string[] = []
  const str = buffer.toString('binary')

  const streamRe = /stream\r?\n/g
  let m: RegExpExecArray | null
  while ((m = streamRe.exec(str)) !== null) {
    const streamStart = m.index + m[0].length
    const streamEnd   = str.indexOf('endstream', streamStart)
    if (streamEnd === -1) continue

    // Check the stream's filter dict (look back up to 500 chars for the dict)
    const dict    = str.substring(Math.max(0, m.index - 500), m.index)
    const isFlate = /\/Filter\s*\/FlateDecode|\/FlateDecode\b|\/Fl\b/.test(dict)
    const isASCII = /ASCIIHexDecode|ASCII85Decode/.test(dict)
    if (isASCII) continue

    let content: string
    if (isFlate) {
      try {
        // PDF spec §7.3.8.1 — strip the mandatory end-of-line before 'endstream'
        // to avoid "Junk found after end of compressed data" errors
        let sliceEnd = streamEnd
        if (sliceEnd > streamStart && str[sliceEnd - 1] === '\n') sliceEnd--
        if (sliceEnd > streamStart && str[sliceEnd - 1] === '\r') sliceEnd--

        const compressed = buffer.slice(streamStart, sliceEnd)
        let decompressed: Buffer
        try {
          // PDFs use raw deflate (no zlib header)
          decompressed = await inflateRawAsync(compressed)
        } catch {
          // A few generators wrap in zlib header — try as fallback
          decompressed = await inflateAsync(compressed)
        }
        content = decompressed.toString('latin1')
      } catch {
        continue // stream failed to decompress — skip it
      }
    } else {
      content = str.substring(streamStart, streamEnd)
    }

    const text = extractTjFromStream(content)
    if (text) chunks.push(text)
  }

  return chunks.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 50_000)
}

// ─── Regex parser (inline from expenses.api.ts logic) ───────────────────────

function parseTextWithRegex(text: string): Omit<ParseInvoiceResult, 'extraction_confidence' | 'extraction_warnings' | 'requires_user_confirmation' | 'parser_source'> {
  const t = text.replace(/\s+/g, ' ')
  const result: Record<string, unknown> = { currency: 'PLN', notes: null }

  // ── Invoice number ─────────────────────────────────────────────────────────
  // Approach: 4 progressive passes. OCR text varies wildly in how labels appear.

  // Pass 1: labeled with compound phrase, e.g. "Numer faktury: FV/2026/001"
  //         or "Nr faktury: FV-001-26" or "Faktura VAT nr: FVAT/..."
  //  [^A-Z0-9\n]{0,20} = up to 20 separator chars (colon, space, slash, dot, letters
  //  that are part of a label word) — stops at first uppercase/digit of the invoice number
  const numMatch1 = t.match(
    /(?:numer\s+faktury|nr\.?\s+faktury|faktura(?:\s+(?:vat|korektora?|nr|numer))*)[^A-Z0-9\n]{0,20}((?:[A-Z0-9]{1,6}[\/\-]){1,3}[A-Z0-9]{1,10})/i
  )
  if (numMatch1) result.invoice_number = numMatch1[1].trim().toUpperCase()

  // Pass 2: simple "Nr:" or "Nr " pattern, e.g. "Nr: FV/2026/001" or "Nr FV-001/26"
  if (!result.invoice_number) {
    const numMatch2 = t.match(
      /(?<![A-Z])nr[:\s.]+([A-Z][A-Z0-9]{0,5}(?:[\/\-][A-Z0-9]{1,8}){1,3})/i
    )
    if (numMatch2) result.invoice_number = numMatch2[1].trim().toUpperCase()
  }

  // Pass 3: standalone FV/FA/FS/FZ prefix — FV/2026/001, FVAT-001-2026, FV 001/03/26
  if (!result.invoice_number) {
    const numMatch3 = t.match(
      /\b((?:FV|FA|FS|FZ|RF|RV)(?:AT)?(?:[\/\-\s][A-Z0-9]{1,8}){2,4})\b/i
    )
    if (numMatch3) {
      result.invoice_number = numMatch3[1]
        .trim().replace(/\s+/g, '/').toUpperCase()
    }
  }

  // Pass 4: generic X…X/NNN/NNN (anything that looks like an invoice number)
  if (!result.invoice_number) {
    const numMatch4 = t.match(/\b([A-Z]{1,5}[\/\-][0-9]{1,8}[\/\-][0-9]{1,6})\b/)
    if (numMatch4) result.invoice_number = numMatch4[1].trim().toUpperCase()
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
  // Vendor last-resort: scan first 15 non-empty lines for any company-like content.
  // Skips headings (FAKTURA/VAT), dates, NIP lines, numeric junk and very short strings.
  if (!result.vendor_name) {
    const SKIP_LINE = /^(?:faktura|fv|fa|fs|fz|vat|nip[:\s]|pesel[:\s]|data[\s:]|nr[\s:.]|numer|suma|brutto|netto|razem|wystawiono|termin|zaliczka|orygi|kopia|\d{4}[\-.\/]\d{2}|\d{1,2}[\-.\/]\d{1,2}[\-.\/]\d{4})/i
    const candidateLines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 4 && /[a-zA-ZąęółśźćńĄĘÓŁŚŹĆŃ]{3}/.test(l) && !SKIP_LINE.test(l))
      .slice(0, 15)
    if (candidateLines.length > 0) result.vendor_name = candidateLines[0].slice(0, 80)
  }

  // Issue date
  const dateMatch = t.match(/(?:data\s+(?:wystawienia|sprzeda[żz]y|faktury|wyst\.?)|wystawiono|data\s+fv|data)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i)
  if (dateMatch) result.issue_date = normalizeDatePl(dateMatch[1])  // Last-resort: any ISO date in the text that isn't in the far future / past
  if (!result.issue_date) {
    const isoDate = t.match(/\b(202\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/)
    if (isoDate) result.issue_date = isoDate[1]
  }
  // Last-resort date fallback: Polish formats without a label (DD.MM.YYYY / DD-MM-YYYY)
  if (!result.issue_date) {
    const plDate = t.match(/\b((?:0?[1-9]|[12]\d|3[01])[.\-\/](?:0?[1-9]|1[0-2])[.\-\/]202\d)\b/)
    if (plDate) result.issue_date = normalizeDatePl(plDate[1])
  }
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
    extractedText = await extractTextFromPDF(buffer)

    // Determine whether the extracted text is actually usable
    const PDF_KEYWORDS = ['faktura', 'fvat', 'nip', 'netto', 'brutto', 'zaplat', 'termin', 'faktur']
    const hasUsableText = extractedText.trim().length >= 80 &&
      PDF_KEYWORDS.some(kw => extractedText.toLowerCase().includes(kw))

    if (!hasUsableText) {
      // Scanned / image-only PDF — try to extract embedded JPEG pages and OCR them
      const jpegs = extractEmbeddedJpegsFromPdf(buffer)
      if (jpegs.length > 0) {
        const ocrTexts: string[] = []
        for (const jpeg of jpegs.slice(0, 3)) { // limit to first 3 pages
          const b64                        = jpeg.toString('base64')
          const { text, warnings: ocrW }   = await extractViaOCR(b64)
          if (text) ocrTexts.push(text)
          // propagate only non-trivial OCR warnings (skip "fill manually" duplicates)
          baseWarnings.push(...ocrW.filter(w => !w.includes('ręcznie')))
        }
        if (ocrTexts.length > 0) {
          extractedText = ocrTexts.join('\n\n')
          parserSource  = 'regex'
        } else {
          baseWarnings.push('Skanowany PDF: OCR nie wykrył czytelnego tekstu — uzupełnij dane ręcznie')
          parserSource = 'manual'
        }
      } else {
        // No embedded JPEGs (e.g. FlateDecode image or unusual encoding)
        baseWarnings.push('PDF nie zawiera warstwy tekstowej ani obrazów JPEG — uzupełnij dane ręcznie')
        parserSource = 'manual'
      }
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
