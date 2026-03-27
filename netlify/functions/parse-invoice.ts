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
import { createClient } from '@supabase/supabase-js'

const inflateRawAsync = promisify(zlib.inflateRaw)
const inflateAsync    = promisify(zlib.inflate)

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParseInvoiceLineItem {
  name:         string | null
  quantity:     number | null
  unit:         string | null
  unit_net:     number | null
  vat_rate:     number | null
  net_amount:   number | null
  vat_amount:   number | null
  gross_amount: number | null
}

export interface ParseInvoiceResult {
  document_type:  'invoice' | 'receipt' | 'bill' | 'other' | null  // detected document type
  vendor_name:    string | null
  vendor_nip:     string | null
  vendor_address?: string | null   // from AI path
  buyer_name?:    string | null    // from AI path
  buyer_nip?:     string | null    // from AI path
  buyer_address?: string | null    // from AI path
  line_items?:    ParseInvoiceLineItem[]  // from AI path
  invoice_number: string | null
  issue_date:     string | null
  sale_date:      string | null
  net_amount:     number | null
  vat_amount:     number | null
  vat_rate:       number | null   // dominant VAT rate, e.g. 23, 8, 5 or 0
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

// ─── JWT check ───────────────────────────────────────────────────────────────
// Prevents unauthenticated file uploads to the OCR endpoint.
// If Supabase env vars are absent (local dev without backend), check is skipped.
// Returns a user identifier (user_id or 'dev') on success, null on failure.
async function verifyRequestAuth(event: HandlerEvent): Promise<string | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('[parse-invoice] Supabase not configured — skipping JWT check (dev only)')
    return 'dev'
  }
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(authHeader.slice(7))
    return user?.id ?? null
  } catch {
    return null
  }
}

// ─── Rate limiting (in-memory, per user, 20 req / 10 min) ────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_MAX       = 20
const RATE_WINDOW_MS = 10 * 60 * 1000

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX
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
export function extractEmbeddedJpegsFromPdf(buffer: Buffer): Buffer[] {
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
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
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

// ─── PDF text usability gate ──────────────────────────────────────────────────

/**
 * Returns true only when extracted PDF text looks like genuine invoice content.
 *
 * Designed to reject two common failure modes:
 *  1. Empty / too-short extractions from scanned PDFs with no text layer
 *  2. Garbage text produced by subsetted fonts — high char count but wrong glyphs,
 *     e.g. "Ú ü ¹ Ä ¿ ÷ ù Ý ð ý À ¿" decoded from PDF octal escapes via latin-1
 *
 * Three checks applied in order:
 *  a) Minimum length: at least 60 characters
 *  b) Keyword density: at least 2 distinct invoice-vocabulary keywords present.
 *     A single keyword ("nip", "netto") can appear as plain ASCII even in otherwise
 *     garbage subsetted-font output — two independent keywords are reliably unlikely.
 *  c) Readable character ratio: ≥ 60 % of characters must be ASCII printable
 *     (U+0020–U+007E) or one of the 16 Polish diacritic letters.
 *     Latin-extended garbage (Ä ¿ ¾ » ½ ¼ etc.) fails this threshold.
 */
export function isPdfTextUsable(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 60) return false

  const lower = trimmed.toLowerCase()
  const INVOICE_KEYWORDS = [
    'faktura', 'paragon', 'rachunek', 'proforma',
    'nip', 'netto', 'brutto', 'vat',
    'sprzedawca', 'nabywca', 'wystawca', 'dostawca',
    'termin', 'zaplat', 'platno',
    'suma', 'razem', 'kwota',
    'data wystawienia', 'data sprzed',
  ]
  let keywordMatches = 0
  for (const kw of INVOICE_KEYWORDS) {
    if (lower.includes(kw)) {
      keywordMatches++
      if (keywordMatches >= 2) break
    }
  }
  if (keywordMatches < 2) return false

  // Readable character ratio: ASCII printable + exact Polish diacritic set.
  // Subsetted-font garbage fills this range with wrong latin-extended glyphs.
  const POLISH_DIACRITICS = 'ąęółśźćńĄĘÓŁŚŹĆŃ'
  let readable = 0
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x20 && cp <= 0x7E) { readable++; continue }
    if (POLISH_DIACRITICS.includes(ch)) readable++
  }
  return (readable / trimmed.length) >= 0.60
}

/**
 * Returns false when a name string is likely subsetted-font garbage
 * (too many non-ASCII / non-Polish characters relative to its length).
 */
function isReadableName(name: string): boolean {
  if (!name || name.length < 3) return false
  const POLISH_DIACRITICS = 'ąęółśźćńĄĘÓŁŚŹĆŃ'
  let readable = 0
  for (const ch of name) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x20 && cp <= 0x7E) { readable++; continue }
    if (POLISH_DIACRITICS.includes(ch)) readable++
  }
  return (readable / name.length) >= 0.70
}

// ─── Regex parser (inline from expenses.api.ts logic) ───────────────────────

function parseTextWithRegex(text: string): Omit<ParseInvoiceResult, 'extraction_confidence' | 'extraction_warnings' | 'requires_user_confirmation' | 'parser_source'> {
  const t = text.replace(/\s+/g, ' ')
  const result: Record<string, unknown> = { currency: 'PLN', notes: null }

  // ── Document type detection ────────────────────────────────────────────────
  // Must run first — affects confidence scoring and warning generation below.
  const RECEIPT_KEYWORDS = /paragon|kasa\s+fiskalna|nr\s*paragonu|fiskaln|kasowy|kasy\s+fiskal|sprzeda[zż]\s+kasow/i
  const BILL_KEYWORDS    = /proforma|zaliczk(?:owa|owy)|rachunek\s+(?:nr|numer)/i
  const docType: ParseInvoiceResult['document_type'] =
    RECEIPT_KEYWORDS.test(t) ? 'receipt'
    : BILL_KEYWORDS.test(t)  ? 'bill'
    : 'invoice'
  result.document_type = docType

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

  // Pass 5: receipt / paragon number (NR XXXXX, NR: XXXXX, PARAGON NR XXXXX)
  if (!result.invoice_number) {
    const receiptNum = t.match(/(?:paragon\s+(?:nr|numer)?\s*|\bnr\s*[:\s])([A-Z0-9]{3,20})/i)
    if (receiptNum) result.invoice_number = 'PAR/' + receiptNum[1].trim().toUpperCase()
  }

  // NIP — extract first occurrence as vendor, second (if present) as buyer
  // Buyer NIP is often labelled "NIP nabywcy", "NIP kupującego", "NIP odbiorcy" etc.
  const buyerNipLabelMatch = t.match(/NIP\s*(?:nabywcy|kupuj[aą]cego|odbiorcy|zamawiaj[aą]cego)[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/i)
  if (buyerNipLabelMatch) {
    const digits = buyerNipLabelMatch[1].replace(/[\s\-]/g, '')
    if (digits.length === 10) result.buyer_nip = digits
  }
  const nipMatch = t.match(/NIP[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/i)
  if (nipMatch) {
    const digits = nipMatch[1].replace(/[\s\-]/g, '')
    if (digits.length === 10 && validateNip(digits)) result.vendor_nip = digits
    else if (digits.length === 10) result.vendor_nip = digits  // keep even if checksum fails — warn later
  }
  // If no labelled buyer NIP found, look for a second NIP occurrence in the text
  if (!result.buyer_nip) {
    const allNips = [...t.matchAll(/NIP[:\s#]*([0-9]{3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2,4})/gi)]
    if (allNips.length >= 2) {
      const secondDigits = allNips[1][1].replace(/[\s\-]/g, '')
      if (secondDigits.length === 10 && secondDigits !== result.vendor_nip) {
        result.buyer_nip = secondDigits
      }
    }
  }

  // Vendor name
  const vendorLabelMatch = t.match(/(?:sprzedawca|wystawca|sprzedaj[aą]cy|firma|dostawca|wykonawca)[:\s]+([^\n,;(]{4,60}(?:sp\.\s*z\.?\s*o\.?\.?o\.?|s\.?a\.?|sp\.\s*j\.?|ltd|gmbh)?[^\n,;(]{0,30})/i)
  if (vendorLabelMatch) result.vendor_name = vendorLabelMatch[1].trim().replace(/\s{2,}/g, ' ')
  if (!result.vendor_name) {
    const companyMatch = t.match(/([A-ZŁÓŚĄŹĆĘŃ][A-Za-ząęółśźćń\s\.\-"]{3,50}(?:Sp\.\s*z\s*o\.o\.|S\.A\.|Sp\.\s*j\.|Ltd\.|GmbH|s\.c\.))/i)
    if (companyMatch) result.vendor_name = companyMatch[1].trim()
  }
  // Buyer name — try labelled match first
  if (!result.buyer_name) {
    const buyerLabelMatch = t.match(/(?:nabywca|kupuj[aą]cy|odbiorca|zamawiaj[aą]cy)[:\s]+([^\n,;(]{4,60})/i)
    if (buyerLabelMatch) result.buyer_name = buyerLabelMatch[1].trim().replace(/\s{2,}/g, ' ').slice(0, 80)
  }

  // Vendor last-resort: scan first 15 non-empty lines for any company-like content.
  // Skips headings (FAKTURA/VAT), dates, NIP lines, numeric junk, very short strings,
  // and buyer-section labels (nabywca, kupujący, odbiorca, zamawiający) to avoid
  // accidentally picking up the buyer name when OCR text order puts buyer before seller.
  if (!result.vendor_name) {
    const SKIP_LINE = /^(?:faktura|fv|fa|fs|fz|vat|nip[:\s]|pesel[:\s]|data[\s:]|nr[\s:.]|numer|suma|brutto|netto|razem|wystawiono|termin|zaliczka|orygi|kopia|nabywca|kupuj[aą]cy|odbiorca|zamawiaj[aą]cy|\d{4}[\-.\/]\d{2}|\d{1,2}[\-.\/]\d{1,2}[\-.\/]\d{4})/i
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

  // Gross fallback for receipts: SUMA: 45,00 / RAZEM: 45,00 (without "brutto")
  if (!result.gross_amount) {
    const receiptTotal = t.match(/(?:^|\s)(?:suma|razem|total|sum[ma]?)[:\s]+([0-9]+[\s]?[0-9]{0,3}[,.][0-9]{1,2})\s*(?:PLN|z[\u0142l]|EUR|USD)?/im)
    if (receiptTotal) { const v = parsePolishAmount(receiptTotal[1]); if (v > 0) result.gross_amount = v }
  }

  // Net amount
  const netMatch = t.match(/(?:razem\s+netto|kwota\s+netto|warto[\u015bs][\u0107c]\s+netto|suma\s+netto|netto)[:\s]+([0-9]+[\s]?[0-9]{0,3}[,.][0-9]{1,2})\s*(?:PLN|z[\u0142l]|EUR)?/i)
  if (netMatch) { const v = parsePolishAmount(netMatch[1]); if (v > 0) result.net_amount = v }

  // VAT
  const vatMatch = t.match(/(?:kwota\s+vat|podatek\s+vat|vat\s+razem|suma\s+vat)[:\s]+([0-9]+[\s]?[0-9]{0,3}[,.][0-9]{1,2})\s*(?:PLN|z[\u0142l]|EUR)?/i)
  if (vatMatch) { const v = parsePolishAmount(vatMatch[1]); if (v > 0) result.vat_amount = v }

  // VAT rate (first recognized rate in document — single dominant rate for construction)
  const vatRateMatch = t.match(/(?:stawka\s+vat|podatku\s+vat|vat\s*%?)[:\s]+(\d{1,2})\s*%/i)
  if (vatRateMatch) result.vat_rate = parseInt(vatRateMatch[1], 10)

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

  // Receipt-specific gross fallback: fiscal receipt "SUMA FISKAL", "GOTOWKA", "PLATNOSC"
  if (!result.gross_amount && docType === 'receipt') {
    const fiscalMatch = t.match(
      /(?:suma\s+fiskal|suma\s+pln|gotow[kc]a|p[lł]atno[sś][cć]\s+got|p[lł]atno[sś][cć])[:\s]+([0-9]+[,\.][0-9]{1,2})/i
    )
    if (fiscalMatch) { const v = parsePolishAmount(fiscalMatch[1]); if (v > 0) result.gross_amount = v }
  }

  // Receipt vendor fallback: fiscal receipts often start with ALL-CAPS store name
  if (!result.vendor_name && docType === 'receipt') {
    const capsLine = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length >= 5 && l.length <= 60 && /^[A-ZŁÓŚĄŹĆĘŃ][A-ZŁÓŚĄŹĆĘŃ\s\-".,]{4,}$/.test(l))
      .slice(0, 5)
      .find(Boolean)
    if (capsLine) result.vendor_name = capsLine.slice(0, 60)
  }

  // Derive missing amount
  const g = result.gross_amount as number | undefined
  const n = result.net_amount  as number | undefined
  const va = result.vat_amount  as number | undefined
  if (g && n && !va) result.vat_amount  = Math.round((g - n) * 100) / 100
  else if (g && va && !n) result.net_amount   = Math.round((g - va) * 100) / 100
  else if (n && va && !g) result.gross_amount = Math.round((n + va) * 100) / 100

  return {
    document_type:    (result.document_type as ParseInvoiceResult['document_type']) ?? null,
    vendor_name:      (result.vendor_name as string) ?? null,
    vendor_nip:       (result.vendor_nip as string) ?? null,
    buyer_name:       (result.buyer_name as string) ?? null,
    buyer_nip:        (result.buyer_nip as string) ?? null,
    invoice_number:   (result.invoice_number as string) ?? null,
    issue_date:       (result.issue_date as string) ?? null,
    sale_date:        (result.sale_date as string) ?? null,
    net_amount:       (result.net_amount as number) ?? null,
    vat_amount:       (result.vat_amount as number) ?? null,
    vat_rate:         (result.vat_rate as number) ?? null,
    gross_amount:     (result.gross_amount as number) ?? null,
    currency:         result.currency as string,
    payment_due_date: (result.payment_due_date as string) ?? null,
    notes:            docType === 'receipt' ? 'Paragon fiskalny' : null,
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

/** Polish NIP checksum validation (weighted sum mod 11) */
function validateNip(digits: string): boolean {
  if (digits.length !== 10) return false
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = w.reduce((acc, wt, i) => acc + wt * parseInt(digits[i], 10), 0)
  return sum % 11 === parseInt(digits[9], 10)
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
  const isReceipt = r.document_type === 'receipt'
  if (r.vendor_name)                               score += 20
  // Receipts don't require an invoice number — give partial credit for being a paragon
  if (r.invoice_number)                            score += 25
  else if (isReceipt)                              score += 15
  if (r.issue_date)                                score += 20
  if (r.gross_amount != null && r.gross_amount > 0) score += 25
  if (r.vendor_nip)                                score += 10
  return score
}

function buildWarnings(r: Partial<ParseInvoiceResult>): string[] {
  const w: string[] = []
  const isReceipt = r.document_type === 'receipt'
  if (!r.vendor_name)                        w.push('Nie rozpoznano nazwy sprzedawcy')
  if (!r.invoice_number && !isReceipt)       w.push('Nie rozpoznano numeru faktury')
  if (!r.gross_amount)                       w.push('Nie rozpoznano kwoty do zapłaty')
  if (!r.issue_date)                         w.push('Nie rozpoznano daty wystawienia')
  if (r.issue_date) {
    const d = new Date(r.issue_date)
    if (d > new Date()) w.push('Data wystawienia jest w przyszłości — sprawdź')
  }
  if (r.net_amount && r.vat_amount && r.gross_amount) {
    const calc = Math.round((r.net_amount + r.vat_amount) * 100) / 100
    if (Math.abs(calc - r.gross_amount) > 0.02)
      w.push(`Sprzeczne kwoty: netto ${r.net_amount} + VAT ${r.vat_amount} ≠ brutto ${r.gross_amount}`)
  }
  if (r.vendor_nip) {
    const d = r.vendor_nip.replace(/\D/g, '')
    if (d.length !== 10) w.push('NIP nie ma dokładnie 10 cyfr — zweryfikuj')
    else if (!validateNip(d)) w.push('NIP ma niepoprawną sumę kontrolną — zweryfikuj')
  }
  return w
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST')    return json(405, { error: 'method_not_allowed' })

  // Auth guard: valid Supabase session required
  const userId = await verifyRequestAuth(event)
  if (!userId) return json(401, { error: 'unauthorized', message: 'Valid authentication token required.' })
  if (isRateLimited(userId)) return json(429, { error: 'too_many_requests', message: 'Za dużo żądań. Spróbuj za chwilę.' })

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

    // Gate: is this text actually usable invoice content?
    // Rejects both empty PDF text layers AND garbage from subsetted/embedded fonts.
    const hasUsableText = isPdfTextUsable(extractedText)

    if (!hasUsableText) {
      // If text was present but failed the gate, it's likely subsetted-font garbage.
      // Warn the user so they know extraction degraded — then try JPEG fallback.
      if (extractedText.trim().length >= 60) {
        baseWarnings.push('PDF zawiera zniekształcone znaki fontowe — próba odczytu obrazów ze strony')
      }
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
  const parsed = parseTextWithRegex(extractedText)

  // Post-parse sanitization: null out vendor/buyer names that look like
  // subsetted-font garbage. Only applied when text came from a PDF text layer
  // (parserSource === 'regex' after PDF path) — image OCR names are kept as-is.
  const nameOverrides: { vendor_name?: null; buyer_name?: null } = {}
  if (isPDF && parserSource === 'regex') {
    if (parsed.vendor_name && !isReadableName(parsed.vendor_name)) {
      nameOverrides.vendor_name = null
      baseWarnings.push('Nazwa sprzedawcy zawiera nieczytelne znaki — uzupełnij ręcznie')
    }
    if (parsed.buyer_name && !isReadableName(parsed.buyer_name)) {
      nameOverrides.buyer_name = null
      baseWarnings.push('Nazwa nabywcy zawiera nieczytelne znaki — uzupełnij ręcznie')
    }
  }

  const finalParsed = { ...parsed, ...nameOverrides }
  const confidence  = calcConfidence(finalParsed)
  const warnings    = [...baseWarnings, ...buildWarnings(finalParsed)]

  // Only require confirmation for critical issues — not minor advisory warnings
  const CRITICAL_KEYWORDS = ['Nie rozpoznano', 'Sprzeczne kwoty', 'niepoprawną sumę kontrolną']
  const hasCriticalWarning = warnings.some(w => CRITICAL_KEYWORDS.some(kw => w.includes(kw)))
  return json(200, {
    ...finalParsed,
    parser_source: parserSource,
    extraction_confidence:    confidence,
    extraction_warnings:      warnings,
    requires_user_confirmation: confidence < 70 || hasCriticalWarning,
  } satisfies ParseInvoiceResult)
}

function emptyResult(): Omit<ParseInvoiceResult, 'extraction_confidence' | 'extraction_warnings' | 'requires_user_confirmation' | 'parser_source'> {
  return {
    document_type: null,
    vendor_name: null, vendor_nip: null, invoice_number: null,
    issue_date: null,  sale_date: null,  net_amount: null,
    vat_amount: null,  vat_rate: null,   gross_amount: null, currency: 'PLN',
    payment_due_date: null, notes: null,
  }
}
