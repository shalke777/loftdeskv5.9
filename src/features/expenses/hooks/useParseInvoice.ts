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
 * Local values take priority; AI fills missing / empty fields.
 */
export function mergeIntoExpenseData(
  local: ParsedExpenseData,
  ai: ParseInvoiceResult,
): ParsedExpenseData {
  function pickStr(localVal: string | undefined, aiVal: string | null): string | undefined {
    if (localVal && localVal.trim()) return localVal
    return aiVal ?? undefined
  }
  function pickNum(localVal: number | undefined, aiVal: number | null): number | undefined {
    if (localVal != null && localVal > 0) return localVal
    return aiVal ?? undefined
  }
  return {
    vendor:         pickStr(local.vendor,         ai.vendor_name),
    vendor_nip:     pickStr(local.vendor_nip,     ai.vendor_nip),
    invoice_number: pickStr(local.invoice_number, ai.invoice_number),
    issue_date:     pickStr(local.issue_date,     ai.issue_date),
    amount_net:     pickNum(local.amount_net,     ai.net_amount),
    amount_vat:     pickNum(local.amount_vat,     ai.vat_amount),
    amount_gross:   pickNum(local.amount_gross,   ai.gross_amount),
    description:    pickStr(local.description,    ai.notes),
  }
}

/**
 * Call the parse-invoice-ai Netlify function.
 * Accepts either extracted text or a base64 image.
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
    throw new Error('AI fallback niedostępny')
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(String(err.message ?? err.error ?? `AI HTTP ${resp.status}`))
  }
  return resp.json() as Promise<ParseInvoiceResult>
}
