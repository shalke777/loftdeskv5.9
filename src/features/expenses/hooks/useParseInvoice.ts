import { useMutation } from '@tanstack/react-query'
import { netlifyFn } from '@/shared/lib/functions'
import type { ParseInvoiceResult, ExpenseSourceType } from '@/features/expenses/api/expenses.api'
import type { AnalysisResult } from '@/services/ai/analysis.types'
import { toAnalysisResult, classifyInputType } from '@/services/ai/analysis.types'
import { supabase } from '@/shared/lib/supabase'

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

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
  } catch (err) {
    console.warn('[OCR] image preprocessing failed, using original:', err)
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

// ── Pre-parse image screen ───────────────────────────────────────────────────
// Classifies an image as a likely cost document or a non-document (room / site
// photo) using edge-density analysis on a small 400 px thumbnail.
// Called BEFORE any OCR / AI network request so room photos never enter the
// invoice extraction path.
//
// Threshold: 7 % edge-pixel ratio.
//  • Documents (text pages):                15–40 % — well above cutoff ✓
//  • Rooms / walls / construction sites:    1–6 %  — blocked ✓
// Returns 'cost_document' on any canvas/image error (fail-open — never block
// a real invoice due to an unexpected browser quirk).

const IMAGE_EDGE_CUTOFF = 0.07  // below this → likely non-document image
const SCREEN_THUMB_PX  = 400   // thumbnail width for fast analysis
const SCREEN_DELTA_THR = 40    // greyscale per-channel delta to count as edge

const INVOICE_FILE_KWDS = [
  'faktura', 'fvat', 'fv_', '_fv', '-fv', 'fv-',
  'paragon', 'rachunek', 'invoice', 'receipt', 'nota_', '_nota',
]

/**
 * Screens a file before invoice extraction.
 * Returns 'non_document_image' when the image strongly lacks document content.
 * PDFs and non-image files always return 'cost_document'.
 */
export async function screenImageForInvoice(
  file: File,
): Promise<'cost_document' | 'non_document_image'> {
  const isPDF = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImg = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
  if (isPDF || !isImg) return 'cost_document'

  // Strong positive filename signal: clearly an invoice file
  const lname = file.name.toLowerCase()
  if (INVOICE_FILE_KWDS.some(kw => lname.includes(kw))) return 'cost_document'

  if (typeof document === 'undefined') return 'cost_document' // SSR / non-browser

  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image()
      el.onload  = () => res(el)
      el.onerror = () => rej(new Error('load'))
      el.src = url
    })
    URL.revokeObjectURL(url)

    const scale = Math.min(1, SCREEN_THUMB_PX / Math.max(img.naturalWidth, 1))
    const w = Math.max(1, Math.round(img.naturalWidth  * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    if (w < 10 || h < 10) return 'cost_document'

    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'cost_document'

    ctx.drawImage(img, 0, 0, w, h)
    const id = ctx.getImageData(0, 0, w, h)
    const d  = id.data

    // Greyscale in-place
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = g
    }

    // Count high-contrast adjacent pixels (horizontal + vertical neighbours)
    let edgeCount = 0
    const total = (w - 1) * (h - 1)
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const i    = (y * w + x) * 4
        const rIdx = i + 4
        const dIdx = i + w * 4
        if (
          Math.abs(d[rIdx] - d[i]) > SCREEN_DELTA_THR ||
          Math.abs(d[dIdx] - d[i]) > SCREEN_DELTA_THR
        ) edgeCount++
      }
    }

    return edgeCount / total < IMAGE_EDGE_CUTOFF ? 'non_document_image' : 'cost_document'
  } catch {
    return 'cost_document' // fail open — never block a real invoice
  }
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
      document_type: null,
      vendor_name: null, vendor_nip: null, invoice_number: null,
      issue_date: null, sale_date: null, net_amount: null,
      vat_amount: null, vat_rate: null, gross_amount: null, currency: 'PLN',
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
    resp = await fetch(netlifyFn('parse-invoice'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
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
    const errData = await resp.json().catch((jsonErr) => {
      console.warn('[OCR] error response body is not JSON:', jsonErr)
      return {}
    }) as Record<string, unknown>
    if (resp.status === 401 || errData.error === 'unauthorized')
      throw new Error('Sesja wygasła — zaloguj się ponownie, aby korzystać z OCR.')
    if (resp.status === 429 || errData.error === 'too_many_requests')
      throw new Error('Za dużo żądań OCR. Spróbuj za chwilę.')
    throw new Error(String(errData.message ?? errData.error ?? `HTTP ${resp.status}`))
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
 * Calls the parse-invoice-ai Netlify function (OpenAI Responses API).
 * Use as fallback when OCR is unavailable or returns low confidence.
 * Requires OPENAI_API_KEY in Netlify env vars — throws if not configured.
 *
 * @param file          The invoice file (image or PDF)
 * @param extractedText Optional raw text already extracted (e.g. from PDF text layer)
 */
export async function callParseInvoiceAI(file: File, extractedText?: string): Promise<ParseInvoiceResult> {
  const isImage = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
  const isPDF   = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

  const body: Record<string, string> = {}

  if (isImage) {
    // Preprocess and encode image for vision API
    const processedFile = await preprocessForOCR(file)
    body.image_base64 = await fileToBase64(processedFile)
    body.image_type   = 'image/jpeg'
  } else if (isPDF) {
    // Send raw PDF bytes — server extracts text layer or embedded JPEGs
    body.pdf_base64 = await fileToBase64(file)
  }

  if (extractedText?.trim()) {
    body.text_content = extractedText.slice(0, 12_000)
  }

  if (!body.image_base64 && !body.text_content && !body.pdf_base64) {
    return {
      document_type: null,
      vendor_name: null, vendor_nip: null, invoice_number: null,
      issue_date: null, sale_date: null, net_amount: null,
      vat_amount: null, vat_rate: null, gross_amount: null, currency: 'PLN',
      payment_due_date: null, notes: null,
      extraction_confidence: 0,
      extraction_warnings: ['Brak danych wejściowych dla AI — wpisz pola ręcznie.'],
      requires_user_confirmation: true,
      parser_source: 'manual',
    }
  }

  let resp: Response
  try {
    resp = await fetch(netlifyFn('parse-invoice-ai'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body:    JSON.stringify(body),
    })
  } catch {
    throw new Error('Serwer AI niedostępny.')
  }

  const data = await resp.json().catch(() => ({})) as Record<string, unknown>

  if (!resp.ok) {
    const errCode = String(data.error ?? '')
    if (resp.status === 401 || errCode === 'unauthorized')
      throw new Error('Sesja wygasła — zaloguj się ponownie, aby korzystać z AI.')
    if (resp.status === 429 || errCode === 'too_many_requests')
      throw new Error('Za dużo żądań AI. Spróbuj za chwilę.')
    if (errCode === 'ai_not_configured')   throw new Error('AI nie jest skonfigurowane (brak OPENAI_API_KEY)')
    if (errCode === 'openai_quota_exceeded') throw new Error('Quota OpenAI wyczerpana — sprawdź billing')
    throw new Error(String(data.message ?? `HTTP ${resp.status}`))
  }

  return (data.result ?? data) as ParseInvoiceResult
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

// ── Normalized ingestion boundary ────────────────────────────────────────────

/**
 * Normalize a flat ParseInvoiceResult from any source (OCR / AI / manual) into
 * the canonical AnalysisResult envelope.
 *
 * Call this at the ingestion point — immediately after receiving the result from
 * the Netlify function. All downstream state should hold AnalysisResult.
 */
export function normalizeParseResult(
  flat: ParseInvoiceResult,
  file: File | null,
  sourceType: ExpenseSourceType,
): AnalysisResult {
  const inputType = classifyInputType(file, sourceType)
  return toAnalysisResult(flat, inputType)
}

/**
 * Hook variant that parses AND normalizes in one step.
 * Returns AnalysisResult instead of flat ParseInvoiceResult.
 */
export function useParseAndNormalize() {
  return useMutation({
    mutationFn: async ({ file, sourceType }: { file: File; sourceType: ExpenseSourceType }): Promise<AnalysisResult> => {
      const flat = await callParseInvoice(file, sourceType)
      return normalizeParseResult(flat, file, sourceType)
    },
  })
}

// ── Room photo / non-document gate ───────────────────────────────────────────
// Invoice keywords that should be present in any real cost document.
const INVOICE_KEYWORDS = /faktura|paragon|sprzedawca|nabywca|nip[:\s#]|netto[:\s]|brutto[:\s]|vat[:\s%]|termin.*p.at|nr.*faktury|do zap.aty/i

/**
 * Returns true when an OCR/AI result strongly suggests the input image was NOT
 * a cost document — e.g. a room, interior, construction-progress photo, or a
 * completely blank frame.
 *
 * ALL four conditions must hold to avoid false-positives on legitimate low-quality scans:
 *  1. document_type is NOT invoice/receipt/bill
 *  2. extraction_confidence < 15
 *  3. No key financial identity field was extracted
 *  4. No invoice-like keyword found in any text field
 */
export function isNonDocumentImage(result: ParseInvoiceResult): boolean {
  const docType = result.document_type
  // If AI confidently identified it as a cost document — let it through
  if (docType === 'invoice' || docType === 'receipt' || docType === 'bill') return false
  if ((result.extraction_confidence ?? 0) >= 15) return false
  // Any one key financial field present means something was extracted
  if (result.vendor_name || result.vendor_nip || result.invoice_number) return false
  if (result.gross_amount != null || result.net_amount != null) return false
  // Check textual hints — a stray invoice keyword disqualifies the block
  const textHints = [result.notes ?? '', ...(result.extraction_warnings ?? [])].join(' ')
  if (INVOICE_KEYWORDS.test(textHints)) return false
  return true
}

/**
 * Normalize AI fallback result into AnalysisResult.
 * Pass the real sourceType so input_type is classified correctly (camera_capture, scanned_pdf, etc.)
 */
export async function callParseInvoiceAINormalized(
  file: File,
  extractedText?: string,
  sourceType: ExpenseSourceType = 'manual',
): Promise<AnalysisResult> {
  const flat = await callParseInvoiceAI(file, extractedText)
  return normalizeParseResult(flat, file, sourceType)
}
