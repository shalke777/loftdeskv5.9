import { useMutation } from '@tanstack/react-query'
import type { ParseInvoiceResult, ExpenseSourceType, ParsedExpenseData } from '@/features/expenses/api/expenses.api'

const MAX_FILE_SIZE  = 5 * 1024 * 1024 // 5 MB
const MAX_OCR_WIDTH  = 1800             // px — keeps detail, reduces payload

const IMAGE_MIME_SET = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif',
])

// ── Image preprocessing (resize + grayscale + contrast) ──────────────────────
// Dramatically improves Tesseract OCR quality on mobile camera photos.
// HEIC/HEIF from iOS are decoded by the browser before reaching canvas.

async function preprocessForOCR(file: File): Promise<File> {
  const isImg = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  if (!isImg || typeof document === 'undefined') return file

  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image()
      el.onload  = () => res(el)
      el.onerror = () => rej(new Error('img load failed'))
      el.src = url
    })
    URL.revokeObjectURL(url)

    const scale = Math.min(1, MAX_OCR_WIDTH / (img.naturalWidth || 1))
    const w = Math.round(img.naturalWidth  * scale)
    const h = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(img, 0, 0, w, h)

    // Convert to grayscale + mild contrast boost (improves OCR edge detection)
    const id = ctx.getImageData(0, 0, w, h)
    const d  = id.data
    for (let i = 0; i < d.length; i += 4) {
      const gray    = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const boosted = Math.min(255, Math.max(0, (gray - 128) * 1.3 + 128))
      d[i] = d[i + 1] = d[i + 2] = boosted
      // d[i+3] (alpha) unchanged
    }
    ctx.putImageData(id, 0, 0)

    return await new Promise<File>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const name = file.name.replace(/\.[^.]+$/, '') + '_ocr.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.90,
      )
    })
  } catch {
    return file // graceful fallback — use original
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a File to base64 string (without the data URL prefix).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? result)
    }
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

/**
 * Calls the parse-invoice Netlify function with a file and returns ParseInvoiceResult.
 * If the file is too large or the call fails, returns a manual fallback result.
 *
 * Exported so that non-hook components (e.g. ExpensesPage) can call it directly.
 */
export async function callParseInvoice(file: File, sourceType: ExpenseSourceType): Promise<ParseInvoiceResult> {
  // Client-side file size guard
  if (file.size > MAX_FILE_SIZE) {
    return {
      vendor_name: null, vendor_nip: null, invoice_number: null,
      issue_date: null, sale_date: null, net_amount: null,
      vat_amount: null, gross_amount: null, currency: 'PLN',
      payment_due_date: null, notes: null,
      extraction_confidence: 0,
      extraction_warnings: ['Plik jest za duży (max 5 MB). Uzupełnij dane ręcznie.'],
      requires_user_confirmation: true,
      parser_source: 'manual',
    }
  }

  // Preprocess images before OCR (resize + grayscale + contrast boost)
  const isImage = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
  const processedFile = isImage ? await preprocessForOCR(file) : file

  const file_base64 = await fileToBase64(processedFile)

  let resp: Response
  try {
    resp = await fetch('/.netlify/functions/parse-invoice', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_base64,
        file_name:   processedFile.name,
        file_type:   processedFile.type,
        source_type: sourceType,
      }),
    })
  } catch {
    // Network-level failure: proxy configured but backend not running, or no internet
    throw new Error('Serwer OCR niedostępny. W trybie dev uruchom: netlify dev (port 8888). W produkcji sprawdź logi Netlify.')
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(String(err.message ?? err.error ?? `HTTP ${resp.status}`))
  }

  try {
    return await resp.json() as ParseInvoiceResult
  } catch {
    // Server returned non-JSON (e.g. HTML 404 page from SPA redirect in dev without `netlify dev`)
    throw new Error(
      'Serwer OCR niedostępny. W trybie dev uruchom: netlify dev (port 8888). W produkcji sprawdź logi Netlify.'
    )
  }
}

/**
 * Hook that wraps the parse-invoice Netlify function as a React Query mutation.
 *
 * Usage:
 *   const parse = useParseInvoice()
 *   parse.mutate({ file, sourceType: 'camera' })
 *   // parse.data → ParseInvoiceResult | undefined
 */
export function useParseInvoice() {
  return useMutation({
    mutationFn: ({ file, sourceType }: { file: File; sourceType: ExpenseSourceType }) =>
      callParseInvoice(file, sourceType),
  })
}

// ── AI fallback helpers ───────────────────────────────────────────────────────

/**
 * Detect if raw OCR/PDF text looks like a receipt rather than an invoice.
 */
export function detectDocumentType(text: string): 'invoice' | 'receipt' | 'unknown' {
  const t = text.toLowerCase()
  const receiptHits = ['paragon', 'fiskalny', 'fiskalna', 'kasa fisk', 'ptu', 'suma pln', 'nr paragonu']
    .filter(kw => t.includes(kw)).length
  const invoiceHits = ['faktura', 'fvat', 'numer faktury', 'nr faktury']
    .filter(kw => t.includes(kw)).length
  if (receiptHits >= 2 || (receiptHits >= 1 && invoiceHits === 0)) return 'receipt'
  if (invoiceHits >= 1) return 'invoice'
  return 'unknown'
}

/**
 * Decide whether AI fallback is needed based on local parse quality.
 * Triggers when: receipt, confidence < 70, < 4 of 7 key fields filled,
 * or any of the three most critical fields (vendor, gross, invoice number) are missing.
 */
export function shouldUseAI(
  confidence: number,
  parsed: ParsedExpenseData,
  docType: 'invoice' | 'receipt' | 'unknown',
): boolean {
  if (docType === 'receipt') return true
  if (confidence < 70) return true
  // Count how many of the 7 key fields are populated
  const keyFilled = [
    parsed.vendor,
    parsed.vendor_nip,
    parsed.invoice_number,
    parsed.issue_date,
    parsed.amount_gross,
    parsed.amount_net,
    parsed.amount_vat,
  ].filter(v => v != null && v !== '' && v !== 0).length
  if (keyFilled < 4) return true
  // Always use AI when the most critical fields are still missing
  if (!parsed.vendor || !parsed.amount_gross) return true
  return false
}

/**
 * Merge AI ParseInvoiceResult into existing ParsedExpenseData.
 *
 * Rules (applied per field):
 *  - Local value wins if it is non-empty and passes quality checks.
 *  - AI fills genuinely missing fields.
 *  - AI wins when it produces a more complete value (e.g. longer invoice number
 *    with recognisable prefix, full company name vs. fragment).
 *  - Sanity checks guard against hallucinated amounts or bad dates.
 */
export function mergeIntoExpenseData(
  local: ParsedExpenseData,
  ai: ParseInvoiceResult,
): ParsedExpenseData {

  // ── Date validator ──────────────────────────────────────────────────────────
  function validDate(v: string | null | undefined): string | undefined {
    if (!v) return undefined
    // Accept ISO YYYY-MM-DD only after normDate normalisation already ran in the backend
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
    const d = new Date(v)
    if (isNaN(d.getTime())) return undefined
    const year = d.getFullYear()
    if (year < 2000 || year > 2035) return undefined   // sanity range
    return v
  }

  // ── Invoice number scorer — returns numeric quality score 0-3 ──────────────
  // Higher = more trustworthy:  3 = known prefix + long  2 = long  1 = short  0 = empty/junk
  function invoiceNumberScore(v: string | null | undefined): number {
    if (!v || v.trim().length < 2) return 0
    const upper = v.trim().toUpperCase()
    // Reject values that look like field labels, not numbers
    if (/^(FAKTURA|PARAGON|NIP|DATA|BRUTTO|NETTO|VAT|RAZEM)/.test(upper)) return 0
    const hasPrefix = /^(FV|FA|FS|FZ|FVAT|F\/|FK|FR|VAT)/.test(upper)
    const len = upper.length
    if (hasPrefix && len >= 8) return 3
    if (hasPrefix) return 2
    if (len >= 6) return 1
    return 0
  }

  // ── Vendor name validator ───────────────────────────────────────────────────
  // Rejects obvious hallucinations: document headers, field labels, NIP lines.
  const BAD_VENDOR_PATTERNS = [
    /^faktura/i, /^paragon/i, /^nip$/i, /^data wystawienia/i,
    /^data sprzeda/i, /^termin/i, /^razem/i, /^brutto/i,
    /^netto/i, /^do zap/i, /^suma/i, /^nr faktury/i, /^nr dok/i,
  ]
  function validVendor(v: string | null | undefined): string | undefined {
    if (!v || v.trim().length < 2) return undefined
    const t = v.trim()
    if (BAD_VENDOR_PATTERNS.some(re => re.test(t))) return undefined
    // Reject if value looks purely numeric (e.g. hallucinated NIP as vendor)
    if (/^\d+$/.test(t.replace(/[\s\-]/g, ''))) return undefined
    return t
  }

  // ── NIP validator (Polish 10-digit tax ID) ──────────────────────────────────
  function validNip(v: string | null | undefined): string | undefined {
    if (!v) return undefined
    const digits = v.replace(/\D/g, '')
    if (digits.length !== 10) return undefined
    // NIP checksum
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i]), 0)
    if (sum % 11 !== parseInt(digits[9])) return undefined
    return digits
  }

  // ── Amount sanity checks ───────────────────────────────────────────────────
  function validAmount(v: number | null | undefined): number | undefined {
    if (v == null) return undefined
    if (!isFinite(v) || v < 0 || v > 10_000_000) return undefined   // > 10M PLN is suspect
    return Math.round(v * 100) / 100
  }

  // ── Pick best invoice number ────────────────────────────────────────────────
  const localInvScore = invoiceNumberScore(local.invoice_number)
  const aiInvScore    = invoiceNumberScore(ai.invoice_number)
  const bestInvoiceNumber = (
    aiInvScore > localInvScore ? ai.invoice_number :
    localInvScore > 0          ? local.invoice_number :
    ai.invoice_number          // both zero — take AI (it might be a receipt)
  ) ?? undefined

  // ── Pick best vendor ────────────────────────────────────────────────────────
  const localVendor = validVendor(local.vendor)
  const aiVendor    = validVendor(ai.vendor_name)
  let bestVendor = localVendor   // local wins by default
  if (!localVendor && aiVendor) {
    bestVendor = aiVendor
  } else if (localVendor && aiVendor) {
    // Prefer the longer, more complete name
    bestVendor = aiVendor.length > localVendor.length + 3 ? aiVendor : localVendor
  }

  // ── Pick best NIP ───────────────────────────────────────────────────────────
  const localNip = validNip(local.vendor_nip) ?? (local.vendor_nip || undefined)
  const aiNip    = validNip(ai.vendor_nip)
  // If local NIP passes checksum but AI does not, always keep local
  const bestNip  = validNip(local.vendor_nip)
    ? local.vendor_nip
    : (aiNip ?? local.vendor_nip ?? undefined)

  // ── Pick best dates ─────────────────────────────────────────────────────────
  const bestIssueDate = validDate(local.issue_date) ?? validDate(ai.issue_date)

  // ── Pick best amounts ───────────────────────────────────────────────────────
  const localNet   = validAmount(local.amount_net)
  const localVat   = validAmount(local.amount_vat)
  const localGross = validAmount(local.amount_gross)
  const aiNet      = validAmount(ai.net_amount)
  const aiVat      = validAmount(ai.vat_amount)
  const aiGross    = validAmount(ai.gross_amount)

  // Local wins for any already-set amount; AI fills gaps only
  let bestNet   = localNet   ?? aiNet
  let bestVat   = localVat   ?? aiVat
  let bestGross = localGross ?? aiGross

  // Amounts sanity cross-check: net + vat ≈ gross (within 5%)
  if (bestNet != null && bestVat != null && bestGross != null) {
    const derived = Math.round((bestNet + bestVat) * 100) / 100
    const tolerance = Math.max(0.10, bestGross * 0.05)
    if (Math.abs(derived - bestGross) > tolerance) {
      // Inconsistency — trust gross (user sees it first), try to derive vat
      bestVat = Math.round((bestGross - bestNet) * 100) / 100
    }
  } else if (bestNet != null && bestVat != null && bestGross == null) {
    bestGross = Math.round((bestNet + bestVat) * 100) / 100
  }

  // ── Pick description ────────────────────────────────────────────────────────
  const localDesc = local.description?.trim() || undefined
  const aiNotes   = ai.notes?.trim() || undefined
  const bestDesc  = localDesc ?? aiNotes

  return {
    invoice_number: bestInvoiceNumber,
    vendor:         bestVendor,
    vendor_nip:     bestNip,
    issue_date:     bestIssueDate,
    amount_net:     bestNet,
    amount_vat:     bestVat,
    amount_gross:   bestGross,
    description:    bestDesc,
  }
}


/**
 * Call the parse-invoice-ai Netlify function.
 * Accepts either extracted text or a base64 image (JPEG/PNG/WEBP — NOT raw PDF).
 * NOTE: For scanned PDFs without a text layer, skip this call entirely on the
 *       frontend — sending raw PDF bytes to the vision endpoint causes 400/502.
 *
 * Response contract: { ok: true, result: ParseInvoiceResult } | { ok: false, error, message }
 */
export async function callParseInvoiceAI(params: {
  textContent?: string
  imageBase64?: string
  imageType?: string
}): Promise<ParseInvoiceResult> {
  let resp: Response
  try {
    resp = await fetch('/.netlify/functions/parse-invoice-ai', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text_content: params.textContent,
        image_base64: params.imageBase64,
        image_type:   params.imageType,
      }),
    })
  } catch {
    throw new Error('AI fallback niedostępny — brak połączenia z funkcją')
  }

  // Always parse JSON — the function now returns { ok, result } or { ok, error, message }
  let data: Record<string, unknown>
  try {
    data = await resp.json() as Record<string, unknown>
  } catch {
    throw new Error(`AI HTTP ${resp.status}: niepoprawna odpowiedź serwera`)
  }

  if (!data.ok) {
    throw new Error(String(data.message ?? data.error ?? `AI HTTP ${resp.status}`))
  }

  return data.result as ParseInvoiceResult
}
