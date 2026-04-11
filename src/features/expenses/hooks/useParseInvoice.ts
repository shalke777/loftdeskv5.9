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

const MAX_FILE_SIZE  = 20 * 1024 * 1024 // 20 MB — large files use URL path (server downloads from storage)
const URL_THRESHOLD  = 4 * 1024 * 1024  // 4 MB — above this, send URL instead of base64 (Lambda body ≤6 MB)
const MAX_OCR_WIDTH  = 1800             // px — keeps detail, reduces payload

const IMAGE_MIME_SET = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif',
])

// ── Image preprocessing (resize + grayscale + deskew + adaptive binarization)
// Improves Tesseract OCR quality on mobile camera invoice photos.
// HEIC/HEIF from iOS are decoded by the browser before reaching canvas.
//
// Pipeline:
//   1. Resize to MAX_OCR_WIDTH (payload reduction, stays sharp)
//   2. Grayscale conversion
//   3. Deskew — detect rotation angle via horizontal-projection variance on a
//      small thumbnail; correct if |angle| is 0.5–12° (fail-safe: skip if unsure)
//   4. Adaptive block thresholding — binarize using local block means so that
//      uneven illumination / shadows are handled per-region (much better than
//      a single linear contrast boost for documents under imperfect lighting)

const DESKEW_THUMB_W = 300  // px — small thumbnail used for angle detection only

/**
 * Otsu's method — finds the global optimal binarization threshold from a
 * compact grayscale array.  O(256 + n) time, O(1) extra space.
 */
function otsuThreshold(gray: Uint8Array, count: number): number {
  const hist = new Int32Array(256)
  for (let i = 0; i < count; i++) hist[gray[i]]++
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, max = 0, threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = count - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > max) { max = between; threshold = t }
  }
  return threshold
}

/**
 * Estimates document skew angle (degrees) using horizontal projection profiles.
 * For each candidate angle the pixel rows of the binarized image are summed;
 * the angle with maximum variance (sharpest row-sum distribution = text lines
 * most aligned with horizontal) is the true skew angle.
 * Returns 0 when signal is too weak to make a reliable estimate.
 */
function estimateSkewDeg(gray: Uint8Array, w: number, h: number, thresh: number): number {
  let bestAngle = 0
  let bestVar   = -1
  const cx = w >> 1
  const cy = h >> 1
  const pLen = h + w   // rotation can shift projection index by up to ±w/2

  for (let deg = -12; deg <= 12; deg++) {
    const cos = Math.cos(deg * Math.PI / 180)
    const sin = Math.sin(deg * Math.PI / 180)
    const profile = new Float32Array(pLen)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (gray[y * w + x] < thresh) {           // dark (text) pixel
          const py = Math.round((y - cy) * cos - (x - cx) * sin + cy)
          if (py >= 0 && py < pLen) profile[py]++
        }
      }
    }

    // Variance of occupied row-buckets: peaks sharply when lines are horizontal
    let s = 0, sq = 0, n = 0
    for (let i = 0; i < pLen; i++) {
      if (profile[i] > 0) { s += profile[i]; sq += profile[i] * profile[i]; n++ }
    }
    if (n < 3) continue
    const variance = sq / n - (s / n) ** 2
    if (variance > bestVar) { bestVar = variance; bestAngle = deg }
  }

  return bestAngle
}

/**
 * Adaptive block binarization — divides the image into blockSize×blockSize
 * tiles, computes the local mean for each tile, and applies the threshold
 * (mean − offset) per tile.  Handles uneven illumination far better than a
 * global linear contrast boost.  Modifies the RGBA buffer d in place.
 */
function adaptiveThreshold(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  blockSize: number,
  offset: number,
): void {
  // Snapshot grayscale channel before writing — prevents reading modified values
  const src = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) src[i] = d[i * 4]  // R == G == B (already gray)

  for (let by = 0; by < h; by += blockSize) {
    const yEnd = Math.min(by + blockSize, h)
    for (let bx = 0; bx < w; bx += blockSize) {
      const xEnd = Math.min(bx + blockSize, w)

      // Local block mean
      let sum = 0, count = 0
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) { sum += src[y * w + x]; count++ }
      }
      const localThresh = (sum / count) - offset

      // Apply — pixel darker than local threshold → black (text), else white
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const val = src[y * w + x] < localThresh ? 0 : 255
          const p = (y * w + x) * 4
          d[p] = d[p + 1] = d[p + 2] = val
          // d[p+3] (alpha) unchanged
        }
      }
    }
  }
}

async function preprocessForOCR(file: File): Promise<File> {
  const isImg = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  if (!isImg || typeof document === 'undefined') return file

  try {
    // ── 1. Load + resize ────────────────────────────────────────────────────
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

    let canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    let ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, w, h)

    // ── 2. Grayscale ─────────────────────────────────────────────────────────
    let id = ctx.getImageData(0, 0, w, h)
    let d  = id.data
    const gray = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const p = i * 4
      const g = Math.round(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2])
      gray[i] = g
      d[p] = d[p + 1] = d[p + 2] = g
    }
    ctx.putImageData(id, 0, 0)

    // ── 3. Deskew detection + correction ─────────────────────────────────────
    // Runs on a 300 px thumbnail to stay fast on mobile; corrects the main canvas.
    try {
      const thumbW  = Math.min(DESKEW_THUMB_W, w)
      const thumbH  = Math.round(h * thumbW / w)
      const tCanvas = document.createElement('canvas')
      tCanvas.width  = thumbW
      tCanvas.height = thumbH
      const tCtx = tCanvas.getContext('2d')
      if (tCtx) {
        tCtx.drawImage(canvas, 0, 0, thumbW, thumbH)
        const tId = tCtx.getImageData(0, 0, thumbW, thumbH)
        // Build compact grayscale array for helpers
        const tGray = new Uint8Array(thumbW * thumbH)
        for (let i = 0; i < thumbW * thumbH; i++) tGray[i] = tId.data[i * 4]

        const thresh   = otsuThreshold(tGray, thumbW * thumbH)
        const skewDeg  = estimateSkewDeg(tGray, thumbW, thumbH, thresh)

        if (Math.abs(skewDeg) >= 0.5 && Math.abs(skewDeg) <= 12) {
          // Expand canvas so rotated content doesn't get clipped
          const rad  = skewDeg * Math.PI / 180
          const absC = Math.abs(Math.cos(rad))
          const absS = Math.abs(Math.sin(rad))
          const newW = Math.round(w * absC + h * absS)
          const newH = Math.round(w * absS + h * absC)

          const rotCanvas = document.createElement('canvas')
          rotCanvas.width  = newW
          rotCanvas.height = newH
          const rotCtx = rotCanvas.getContext('2d')
          if (rotCtx) {
            rotCtx.fillStyle = '#ffffff'   // white fill for rotation padding
            rotCtx.fillRect(0, 0, newW, newH)
            rotCtx.translate(newW / 2, newH / 2)
            rotCtx.rotate(-skewDeg * Math.PI / 180)
            rotCtx.drawImage(canvas, -w / 2, -h / 2)

            // Swap main canvas reference
            canvas        = rotCanvas
            canvas.width  = newW
            canvas.height = newH
            ctx = canvas.getContext('2d')!
          }
        }
      }
    } catch (deskewErr) {
      console.warn('[OCR] deskew skipped:', deskewErr)
      // canvas still holds valid grayscale — continue
    }

    // ── 4. Adaptive block binarization ───────────────────────────────────────
    // 64 px blocks, offset = 12 — handles uneven illumination and thin fonts.
    try {
      const { width: fw, height: fh } = canvas
      id = ctx.getImageData(0, 0, fw, fh)
      d  = id.data
      adaptiveThreshold(d, fw, fh, 64, 12)
      ctx.putImageData(id, 0, 0)
    } catch (threshErr) {
      console.warn('[OCR] adaptive threshold skipped:', threshErr)
      // canvas still has grayscale — perfectly acceptable fallback
    }

    // ── 5. Encode ─────────────────────────────────────────────────────────────
    return await new Promise<File>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const name = file.name.replace(/\.[^.]+$/, '') + '_ocr.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.92,   // slightly higher quality — preserves thin strokes after binarization
      )
    })
  } catch (err) {
    console.warn('[OCR] image preprocessing failed, using original:', err)
    return file  // graceful fallback — never fail the upload
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
export async function callParseInvoice(file: File, sourceType: ExpenseSourceType, fileUrl?: string, companyNip?: string): Promise<ParseInvoiceResult> {
  // Client-side file size guard
  if (file.size > MAX_FILE_SIZE) {
    return {
      document_type: null,
      vendor_name: null, vendor_nip: null, invoice_number: null,
      issue_date: null, sale_date: null, net_amount: null,
      vat_amount: null, vat_rate: null, gross_amount: null, currency: 'PLN',
      payment_due_date: null, notes: null,
      extraction_confidence: 0,
      extraction_warnings: [`Plik jest za duży (${(file.size / 1024 / 1024).toFixed(0)} MB — max 20 MB). Uzupełnij dane ręcznie.`],
      requires_user_confirmation: true,
      parser_source: 'manual',
    }
  }

  // Preprocess images before OCR (resize + grayscale + contrast boost)
  const isImage = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
  const processedFile = isImage ? await preprocessForOCR(file) : file

  // For large files, use URL path (server downloads from Supabase Storage)
  // to avoid exceeding the ~6 MB Lambda request body limit.
  const useLargeFilePath = fileUrl && processedFile.size > URL_THRESHOLD

  const payload: Record<string, string> = {
    file_name:   processedFile.name,
    file_type:   processedFile.type,
    source_type: sourceType,
  }
  if (companyNip) payload.company_nip = companyNip

  if (useLargeFilePath) {
    payload.file_url = fileUrl
  } else {
    payload.file_base64 = await fileToBase64(processedFile)
  }

  let resp: Response
  try {
    resp = await fetch(netlifyFn('parse-invoice'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify(payload),
    })
  } catch {
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
export async function callParseInvoiceAI(file: File, extractedText?: string, fileUrl?: string): Promise<ParseInvoiceResult> {
  const isImage = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
  const isPDF   = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

  const body: Record<string, string> = {}

  if (isImage) {
    // Preprocess and encode image for vision API
    const processedFile = await preprocessForOCR(file)
    body.image_base64 = await fileToBase64(processedFile)
    body.image_type   = 'image/jpeg'
  } else if (isPDF) {
    // For large PDFs, send URL so server downloads from storage (avoids Lambda body limit)
    if (fileUrl && file.size > URL_THRESHOLD) {
      body.pdf_url = fileUrl
    } else {
      body.pdf_base64 = await fileToBase64(file)
    }
  }

  if (extractedText?.trim()) {
    body.text_content = extractedText.slice(0, 12_000)
  }

  if (!body.image_base64 && !body.text_content && !body.pdf_base64 && !body.pdf_url) {
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
const INVOICE_KEYWORDS = /faktura|paragon|sprzedawca|nabywca|nip[:\s#]|netto[:\s]|brutto[:\s]|vat[:\s%]|termin.*p.at|nr.*faktury|do zap.aty|wydanie|dostawca|odbiorca|wz\s*nr|warto[sś][cć]/i

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
