import { useMutation } from '@tanstack/react-query'
import { netlifyFn } from '@/shared/lib/functions'
import type { ParseInvoiceResult, ExpenseSourceType } from '@/features/expenses/api/expenses.api'
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
    const errData = await resp.json().catch(() => ({})) as Record<string, unknown>
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
      vendor_name: null, vendor_nip: null, invoice_number: null,
      issue_date: null, sale_date: null, net_amount: null,
      vat_amount: null, gross_amount: null, currency: 'PLN',
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
