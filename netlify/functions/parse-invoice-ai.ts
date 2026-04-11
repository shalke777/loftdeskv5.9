// =============================================================================
// Netlify Function: parse-invoice-ai  (v4 — OpenAI Responses API, verified extraction)
// =============================================================================
// AI extraction of invoice/receipt data via OpenAI Responses API with:
//   • Structured JSON output — text.format.type = 'json_schema' (required)
//   • Nullable fields via anyOf (strict schema — array types not supported)
//   • Vision input: gpt-4o for images (JPEG/PNG/WEBP only — not raw PDF)
//   • Text input: gpt-4o for PDF text layer / Tesseract output
//   • INSTRUCTIONS include explicit arithmetic + NIP + date verification steps
//
// Request (POST /.netlify/functions/parse-invoice-ai):
//   Content-Type: application/json
//   {
//     text_content?: string   // raw text from PDF text layer or Tesseract OCR
//     image_base64?: string   // base64-encoded image JPEG/PNG/WEBP (NOT PDF)
//     image_type?:  string    // MIME, e.g. "image/jpeg" — must be image/*
//     pdf_base64?:  string    // base64-encoded PDF (small files ≤4 MB)
//     pdf_url?:     string    // Supabase storage URL (large files — server downloads)
//   }
//
// Response 200: { ok: true, result: ParseInvoiceResult }
// Response 4xx/5xx: { ok: false, error: string, message: string }

import type { Handler, HandlerEvent } from '@netlify/functions'
import type { ParseInvoiceResult } from './parse-invoice'
import { extractTextFromPDF, extractEmbeddedJpegsFromPdf, isPdfTextUsable } from './parse-invoice'
import { createClient } from '@supabase/supabase-js'
import { isRateLimitedDb } from './shared/rate-limit'
import { captureAiError, flushSentry } from './shared/sentry'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

const MAX_URL_FILE_BYTES = 20_000_000 // 20 MB max for URL-downloaded files

async function fetchFileFromUrl(url: string): Promise<Buffer> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`)
  const ab = await resp.arrayBuffer()
  if (ab.byteLength > MAX_URL_FILE_BYTES) {
    throw new Error(`Downloaded file too large (${(ab.byteLength / 1024 / 1024).toFixed(1)} MB)`)
  }
  return Buffer.from(ab)
}

// ─── JWT check ───────────────────────────────────────────────────────────────
// Prevents unauthenticated callers from burning OpenAI API credits.
// If Supabase env vars are absent (local dev without backend), check is skipped.
// Returns a user identifier (user_id or 'dev') on success, null on failure.
async function verifyRequestAuth(event: HandlerEvent): Promise<string | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('[parse-invoice-ai] Supabase not configured — skipping JWT check (dev only)')
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

// ─── Rate limiting (persistent, per user, 10 req / 10 min) ────────────────────
const RATE_MAX       = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

function makeRateLimitClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function ok(result: ParseInvoiceResult, meta: { aiModelUsed: string }) {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: true, aiAttempted: true, aiModelUsed: meta.aiModelUsed, result }),
  }
}

function err(statusCode: number, error: string, message: string, meta?: { aiModelUsed?: string; aiAttempted?: boolean }) {
  console.error(`[parse-invoice-ai] ${error}: ${message}`)
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: false, error, message, aiAttempted: meta?.aiAttempted ?? false, aiModelUsed: meta?.aiModelUsed ?? null }),
  }
}

// ─── JSON Schema for Structured Output ───────────────────────────────────────
// FIX 1: Must include `type: 'json_schema'` as top-level property of `format`.
// FIX 2: Nullable fields must use anyOf — OpenAI strict mode does NOT support
//         type arrays like `type: ['string', 'null']`.

const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] }  // nullable string
const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] }  // nullable number

const LINE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name:         ns,
    quantity:     nn,
    unit:         ns,
    unit_net:     nn,
    vat_rate:     nn,
    net_amount:   nn,
    vat_amount:   nn,
    gross_amount: nn,
  },
  required: ['name', 'quantity', 'unit', 'unit_net', 'vat_rate', 'net_amount', 'vat_amount', 'gross_amount'],
  additionalProperties: false,
}

const INVOICE_SCHEMA_FORMAT = {
  type:   'json_schema',
  name:   'invoice_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      document_type:    { type: 'string', enum: ['invoice', 'receipt', 'bill', 'other'] },
      vendor_name:      ns,
      vendor_nip:       ns,
      vendor_address:   ns,
      document_number:  ns,
      issue_date:       ns,
      sale_date:        ns,
      payment_due_date: ns,
      payment_method:   ns,
      currency:         { type: 'string' },
      net_amount:       nn,
      vat_amount:       nn,
      gross_amount:     nn,
      buyer_name:       ns,
      buyer_nip:        ns,
      buyer_address:    ns,
      line_items:       { type: 'array', items: LINE_ITEM_SCHEMA },
      notes:            ns,
      confidence:       { type: 'number' },
      warnings:         { type: 'array', items: { type: 'string' } },
    },
    required: [
      'document_type', 'vendor_name', 'vendor_nip', 'vendor_address', 'document_number',
      'issue_date', 'sale_date', 'payment_due_date', 'payment_method',
      'currency', 'net_amount', 'vat_amount', 'gross_amount',
      'buyer_name', 'buyer_nip', 'buyer_address', 'line_items',
      'notes', 'confidence', 'warnings',
    ],
    additionalProperties: false,
  },
}

// ─── System instructions ──────────────────────────────────────────────────────

const INSTRUCTIONS = `You are a general-purpose purchase-document parser for Polish and EU invoices, receipts, bills, and scanned cost documents.
Extract structured accounting data from many document layouts, not from one fixed template.
Return ONLY valid JSON matching the provided schema — no extra text.

Extract:
- seller / issuer details (name, address, tax ID)
- buyer details (name, address, tax ID)
- document number
- issue date, sale date, due date (if present)
- currency
- line items (name, quantity, unit, unit net price, VAT rate, amounts)
- total net, VAT, and gross amounts
- document type and confidence

Rules:
- Identify seller / issuer and buyer as SEPARATE entities. Never merge them into one field.
- Do NOT include bank name, bank account number, IBAN, SWIFT, BIC, payment method, payment deadline, or amount due inside vendor_name, vendor_address, buyer_name, or buyer_address.
- Extract line items from table-like sections or line groups visible in the document.
- Prefer explicit labeled values over guesses.
- Prefer null over hallucination. Return a clean partial result if OCR quality is poor.
- Use semantic understanding of document layout, labels, grouping, and accounting context.
- Map gross_amount to the final payable total when clearly indicated.
- Return warnings (array of strings) for any ambiguous or uncertain fields.
- If line_items are not clearly present, return an empty array [].

Seller / vendor rules:
- Seller = the issuer / supplier / sprzedawca / wystawca / dostawca.
- Extract only the identity block: company name, optionally legal form and address.
- NEVER include bank account, IBAN, SWIFT, BIC, payment method, or amount due in vendor_name or vendor_address.
- If seller block is adjacent to payment details, stop at the end of the seller identity section.
- Prefer a shorter, clean value over a longer mixed value.

Buyer rules:
- Buyer = nabywca / odbiorca / customer / purchaser.
- Extract separately from seller. Do not merge.
- Same sanitisation rules as seller: no bank/payment data in buyer fields.

Line item rules:
- Extract each visible document item / position / pozycja.
- For each item provide: name, quantity (if available), unit (if available), unit net price, VAT rate (as number, e.g. 23 for 23%), and amounts.
- If quantity or unit is unclear, return null for those fields.
- Do not invent items that are not clearly visible.
- For receipts: items may not have explicit net/vat breakdown; extract what is visible.

Field rules:
- document_type: "invoice" for faktura VAT; "receipt" for paragon/kasa fiskalna/NR PARAGONU; "bill" for rachunki/proforma/zaliczka; "other" for WZ (wydanie zewnętrzne), delivery notes, packing lists, and any other cost document.
- IMPORTANT: For document_type "other" (WZ, delivery notes, etc.) — still extract ALL available fields: vendor_name, vendor_nip, buyer_name, buyer_nip, document_number, dates, line items, and amounts. Do NOT skip extraction just because the document is not a standard invoice.
- issue_date, sale_date, payment_due_date: ISO YYYY-MM-DD; convert from DD.MM.YYYY or MM/DD/YYYY.
- vendor_nip / buyer_nip: exactly 10 digits, no dashes/spaces, or null.
- currency: default "PLN" if not specified.
- Amounts: decimal with dot separator (e.g. 1234.56), never a string.
- confidence: 0–100, where 100 = all key fields read with full certainty.
- For receipts: document_number may be null.
- If rawText is provided as supplementary context: treat it as a hint; the image (if present) is the primary source.

VERIFICATION — run these checks before producing final JSON output:

1. ARITHMETIC
   Compute net_amount + vat_amount. If the result differs from gross_amount by more than 0.02:
   - Re-read the amounts carefully. Often the gross is printed as "DO ZAPŁATY" or "RAZEM BRUTTO" — make sure you are reading the correct total line.
   - If still inconsistent after re-reading, keep your best reading and add a warning: "Niezgodność arytmetyczna: netto + VAT ≠ brutto (różnica: X zł)"

2. POLISH DATE FORMAT
   Polish invoices use DD.MM.YYYY. Always convert to ISO YYYY-MM-DD.
   Examples: 15.03.2024 → 2024-03-15 | 01.12.2025 → 2025-12-01 | 5.1.2026 → 2026-01-05
   When day ≤ 12 and both day/month interpretations are possible, prefer DD.MM.YYYY (Polish standard).
   If a date is more than 60 days in the future, add a warning: "Data wystawienia w przyszłości — sprawdź"

3. NIP VALIDATION
   Polish NIP = exactly 10 digits. Checksum: weights [6,5,7,2,3,4,5,6,7].
   sum = Σ(weight[i] × digit[i]) for i=0..8; valid when sum mod 11 = digit[9].
   If NIP fails checksum: output the 10 digits anyway AND add warning: "NIP — niepoprawna suma kontrolna"
   Never output NIP with dashes, spaces, or "PL" prefix.

4. BUYER vs SELLER IDENTIFICATION — CRITICAL
   In Polish invoices the SELLER (SPRZEDAWCA / WYSTAWCA / DOSTAWCA) typically appears FIRST (top-left section).
   The BUYER (NABYWCA / ODBIORCA / KUPUJĄCY / ZAMAWIAJĄCY) appears SECOND (below or right of seller).
   RULE: The entity that ISSUED the invoice is the SELLER/VENDOR — map to vendor_name/vendor_nip.
   RULE: The entity that RECEIVES/PAYS for goods/services is the BUYER — map to buyer_name/buyer_nip.
   If both blocks look identical: they may be the same company in different roles — add warning: "Sprzedawca i nabywca wyglądają identycznie — sprawdź"
   If you see NIP next to "SPRZEDAWCA" or at the top of the document → that is vendor_nip.
   If you see NIP next to "NABYWCA" or in the second address block → that is buyer_nip.
   NEVER swap buyer and seller. If unsure, add warning: "Nie jestem pewien rozróżnienia nabywca/sprzedawca — zweryfikuj"
   Context keywords: sprzedawca, wystawca, dostawca → vendor | nabywca, odbiorca, kupujący, zamawiający → buyer
   WZ documents: "wystawił" / "wydał" / "dostawca" = vendor; "odbiorca" / "zamawiający" = buyer.

5. POLISH AMOUNT FORMAT
   Polish invoices use comma as decimal separator and space as thousands separator.
   Conversion rules:
   "1 234,56" or "1 234,56" → 1234.56 (space = thousands, comma = decimal)
   "10.000,00" → 10000.00 (dot = thousands when followed by comma-decimal)
   "1230.00" → 1230.00 (already a dot-decimal — keep as-is)
   "1234,56" → 1234.56 (plain comma-decimal)
   Never interpret a trailing comma-two-digits pattern as anything other than a decimal.

6. LINE ITEMS — EXTRACT EVERY SINGLE LINE
   Extract ALL line items from the invoice table/list — do not skip any.
   Each row in the invoice item table = one line_item object.
   Fields per item: name (description), quantity, unit, unit_price, net_amount, vat_rate, gross_amount.
   After extracting, sum their net_amount values.
   If the sum differs from net_amount total by more than 5 %: add warning listing the discrepancy.
   Do not fabricate line items — only extract what is explicitly visible.
   If there are 20+ items, extract ALL of them — never truncate.

7. FLAT TEXT HANDLING (PDF path)
   When input is plain extracted text (no visual layout), use keyword proximity to identify sections:
   - Text immediately after "NIP:" or "NIP " (without other label) is the tax ID of the owning block.
   - Block labeled "SPRZEDAWCA:" or "WYSTAWCA:" contains vendor fields.
   - Block labeled "NABYWCA:" or "ODBIORCA:" contains buyer fields.
   - Numbers after "RAZEM", "DO ZAPŁATY", "SUMA BRUTTO" are the totals.
   - Line items appear in tabular sections with repeating numeric patterns (quantity, price, rate, amounts).

- CRITICAL: If the input image shows a room, interior space, bathroom, kitchen, corridor, construction site, outdoor scene, or any non-document scene — return document_type: "other", all monetary values as null, confidence: 0, and add to warnings: "Zdjęcie nie wygląda na dokument kosztowy — prześlij skan faktury, paragonu lub PDF." Do NOT invent invoice fields from non-document images.
- A cost document must contain visibly readable text with labels, numbers, or dates. If no such document text is visible in the image, set confidence: 0 and document_type: "other".

8. NULL POLICY — MOST IMPORTANT RULE
   NEVER invent, guess, or infer data that is not clearly and explicitly visible in the document.
   Return null for ANY field you are not at least 90% certain about based on clearly readable text.
   This means:
   - If a company name is blurry, obscured, or ambiguous → vendor_name: null
   - If you see a partial number but can't read all digits → vendor_nip: null
   - If amounts are unclear or you are interpolating from context → all amounts: null
   - If line items are not explicitly listed in a table → line_items: []
   - If dates are unclear or partially visible → dates: null
   NEVER fill a field with "UNKNOWN", "N/A", "---", a made-up company name, or a plausible-sounding value.
   A result with many null fields and confidence 20 is FAR BETTER than a hallucinated result with confidence 80.
   Set confidence = 0–20 when image quality is poor or most fields cannot be read.
   Set confidence = 21–50 when some fields are clear but key fields (vendor, amounts) are uncertain.
   Set confidence = 51–100 only when critical fields are explicitly, unambiguously readable.`

// ─── OpenAI Responses API types ───────────────────────────────────────────────

interface ResponsesAPIResult {
  model?:  string
  output?: Array<{
    type: string
    content?: Array<{ type: string; text?: string }>
  }>
  error?: { message: string; code?: string }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST')    return err(405, 'method_not_allowed', 'Only POST allowed')

  // Auth guard: valid Supabase session required
  const userId = await verifyRequestAuth(event)
  if (!userId) return err(401, 'unauthorized', 'Valid authentication token required.')
  const rlClient = makeRateLimitClient()
  if (rlClient) {
    const rl = await isRateLimitedDb(rlClient, userId, 'parse-invoice-ai', RATE_MAX, RATE_WINDOW_MS)
    if (rl.limited) return err(429, 'too_many_requests', 'Za dużo żądań. Spróbuj za chwilę.')

    // ── Daily company limit ───────────────────────────────────────────────
    const { data: memberRow } = await rlClient
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (memberRow?.company_id) {
      const dailyLimit = parseInt(process.env.AI_DAILY_LIMIT ?? '50', 10)
      const { count: todayCount, error: countErr } = await rlClient
        .from('ai_analysis_runs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', memberRow.company_id as string)
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      if (!countErr && typeof todayCount === 'number' && todayCount >= dailyLimit) {
        console.warn('[parse-invoice-ai] Daily limit exceeded', { companyId: memberRow.company_id, todayCount, dailyLimit })
        return err(429, 'daily_limit_exceeded', `Dzienny limit analiz AI (${dailyLimit}) został wyczerpany. Spróbuj ponownie jutro.`)
      }
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return err(503, 'ai_not_configured', 'OPENAI_API_KEY is not set in Netlify environment variables', { aiAttempted: false })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return err(400, 'invalid_json', 'Request body must be valid JSON')
  }

  let textContent = body.text_content as string | undefined
  let imageBase64 = body.image_base64 as string | undefined
  let imageType   = String(body.image_type ?? 'image/jpeg')

  // ── PDF input: extract text layer or embedded JPEGs server-side ──────────
  // Accepts either inline base64 (small files) or a URL (large files).
  const pdfBase64 = body.pdf_base64 as string | undefined
  const pdfUrl    = body.pdf_url as string | undefined
  const hasPdf    = !!(pdfBase64 || pdfUrl)

  if (hasPdf) {
    try {
      let pdfBuffer: Buffer
      if (pdfUrl) {
        pdfBuffer = await fetchFileFromUrl(pdfUrl)
        console.info('PDF_FROM_URL', JSON.stringify({ bytes: pdfBuffer.length, url: pdfUrl.slice(0, 80) }))
      } else {
        pdfBuffer = Buffer.from(pdfBase64!, 'base64')
      }

      // 1. Try to extract text layer (works for all digitally-generated PDFs).
      //    isPdfTextUsable rejects both empty layers and subsetted-font garbage.
      //    The old length-only check (>= 40 chars) let garbage text through to AI.
      const extracted = await extractTextFromPDF(pdfBuffer)
      if (isPdfTextUsable(extracted)) {
        // Append to any locally-extracted text the caller may have passed
        textContent = extracted + (textContent ? '\n\n' + textContent : '')
        console.info('PDF_TEXT_EXTRACTED', JSON.stringify({ chars: extracted.length }))
      } else {
        // Text absent OR present but failed usability gate (subsetted-font garbage).
        if (extracted.trim().length >= 60) {
          console.warn('PDF_TEXT_UNUSABLE', JSON.stringify({ chars: extracted.length, reason: 'failed_usability_gate' }))
        }
        // 2. Scanned PDF — extract embedded JPEG images.
        //    Use first JPEG for vision input. For multi-page PDFs, note page count
        //    so AI knows amounts may be on a different page than page 1.
        const jpegs = extractEmbeddedJpegsFromPdf(pdfBuffer)
        if (jpegs.length > 0) {
          imageBase64 = jpegs[0].toString('base64')
          imageType   = 'image/jpeg'
          console.info('PDF_JPEG_EXTRACTED', JSON.stringify({ total: jpegs.length, usedIndex: 0, sizeBytes: jpegs[0].length }))
          if (jpegs.length > 1) {
            const pageNote = `[Dokument PDF ma ${jpegs.length} stron(y). Obraz pokazuje stronę 1.]`
            textContent = textContent ? pageNote + '\n' + textContent : pageNote
          }
        } else {
          console.warn('PDF_NO_CONTENT', 'No text layer and no embedded JPEGs found in PDF')
        }
      }
    } catch (pdfErr) {
      console.error('PDF_EXTRACT_ERROR', String(pdfErr))
      // Non-fatal — continue with whatever text_content was provided
    }
  }

  if (!textContent && !imageBase64) {
    // PDF was provided but yielded no extractable content — return graceful empty result
    // instead of 400, so the client can fall back to manual entry without an error toast.
    // Shape matches the normal ok() success path: { ok: true, result: ParseInvoiceResult }
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        aiAttempted: false,
        result: {
          document_type: null,
          vendor_name: null, vendor_nip: null, invoice_number: null,
          issue_date: null, sale_date: null, net_amount: null,
          vat_amount: null, vat_rate: null, gross_amount: null, currency: 'PLN',
          payment_due_date: null, notes: null,
          extraction_confidence: 0,
          extraction_warnings: ['Nie udało się odczytać treści z dokumentu — wpisz pola ręcznie.'],
          requires_user_confirmation: true,
          parser_source: 'ai',
        },
      }),
    }
  }

  // ── Validate image MIME — never accept PDF in vision path ────────────────
  // FIX 3: Raw PDF base64 sent to vision endpoint causes OpenAI 400.
  //        If the client accidentally sends a PDF, fall back to text mode.

  const isValidImageMime = imageBase64 &&
    /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i.test(imageType)

  const useVision = !!isValidImageMime

  // Use gpt-4o as default — stable, vision-capable, well-tested for structured extraction
  const DEFAULT_OPENAI_MODEL = 'gpt-4o'
  const model =
    process.env.OPENAI_DEBUG_FORCE_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_MODEL

  console.info('OPENAI_MODEL_SELECTED', JSON.stringify({
    model,
    defaultModel:  DEFAULT_OPENAI_MODEL,
    forcedByEnv:   !!process.env.OPENAI_DEBUG_FORCE_MODEL?.trim(),
    envModel:      process.env.OPENAI_MODEL?.trim() || null,
  }))

  const docKind = useVision ? 'image' : 'text'

  // ── DIAGNOSTIC LOG ────────────────────────────────────────────────────────
  console.info('OPENAI_AI_START', JSON.stringify({
    model,
    docKind,
    mimeType:      imageType,
    hasImage:      !!imageBase64,
    hasRawText:    !!textContent,
    rawTextLength: textContent?.length ?? 0,
    requestSource: 'expenses-ai-fallback',
    forcedModel:   !!process.env.OPENAI_DEBUG_FORCE_MODEL,
  }))

  // ── Build Responses API input ─────────────────────────────────────────────

  type InputItem = { type: string; text?: string; image_url?: string }
  const content: InputItem[] = []

  const rawTextLength = textContent?.length ?? 0
  const ocrTextLength = 0  // resolved by caller; we receive final text

  if (useVision) {
    content.push({
      type:      'input_image',
      image_url: `data:${imageType};base64,${imageBase64}`,
    })
    const hint = textContent?.trim()
      ? `\n\nDodatkowy tekst z lokalnego OCR (traktuj jako wskazówkę):\n${textContent.slice(0, 3_000)}`
      : ''
    content.push({
      type: 'input_text',
      text: `Extract all data from this document.${hint}`,
    })
    console.info('AI_INPUT_SOURCE_SELECTED', JSON.stringify({
      docKind,
      isScannedPdf:       false,
      usedImageInput:     true,
      usedFullRawText:    !!hint,
      usedFullOcrText:    false,
      usedSyntheticText:  false,
      rawTextLength,
      ocrTextLength,
      syntheticTextLength: 0,
    }))
  } else {
    const txt = textContent?.trim()
      ? textContent.slice(0, 12_000)
      : 'Brak wyodrębnionego tekstu — proszę podać dane dokumentu.'
    const usedFull = !!textContent?.trim()
    console.info('AI_INPUT_SOURCE_SELECTED', JSON.stringify({
      docKind,
      isScannedPdf:       false,
      usedImageInput:     false,
      usedFullRawText:    usedFull,
      usedFullOcrText:    false,
      usedSyntheticText:  !usedFull,
      rawTextLength,
      ocrTextLength,
      syntheticTextLength: usedFull ? 0 : txt.length,
    }))
    content.push({
      type: 'input_text',
      text: `Extract all data from the following document text:\n\n${txt}`,
    })
  }

  // ── Call OpenAI Responses API (with retry) ──────────────────────────────────

  let aiRaw: string
  try {
    const { callOpenAIWithRetry } = await import('./shared/openai-retry')
    const resp = await callOpenAIWithRetry({
      apiKey, model, instructions: INSTRUCTIONS,
      input: [{ role: 'user', content }],
      text: { format: INVOICE_SCHEMA_FORMAT },
      max_output_tokens: 4_000,
    }, 'parse-invoice-ai')

    if (resp.retried) console.info('OPENAI_RETRIED', JSON.stringify({ model, docKind, elapsed_ms: Date.now() - t0 }))

    // ── DIAGNOSTIC LOG ──────────────────────────────────────────────────────
    if (resp.ok) {
      console.info('OPENAI_AI_RESPONSE', JSON.stringify({
        model,
        status:     resp.status,
        ok:         true,
        bodyLength: resp.body.length,
        docKind,
      }))
    } else {
      console.error('OPENAI_AI_ERROR', JSON.stringify({
        model,
        status:       resp.status,
        ok:           false,
        docKind,
        bodyPreview:  resp.body.slice(0, 300),
      }))
    }

    if (!resp.ok) {
      let oaiErr: Record<string, unknown> = {}
      try { oaiErr = JSON.parse(resp.body) as Record<string, unknown> } catch { /* noop */ }
      const errObj    = oaiErr.error as Record<string, unknown> | undefined
      const errDetail = errObj?.message ?? errObj?.code ?? resp.body.slice(0, 200)

      // Propagate quota/billing errors with a meaningful status (not 502)
      if (resp.status === 429) {
        const msg = 'OpenAI quota exceeded or billing is not active for the current API project.'
        console.error('OPENAI_AI_ERROR', JSON.stringify({ model, docKind, status: 429, errorMessage: msg, detail: String(errDetail) }))
        return err(429, 'openai_quota_exceeded', msg, { aiModelUsed: model, aiAttempted: true })
      }

      throw new Error(`OpenAI ${resp.status}: ${String(errDetail)}`)
    }

    const data = JSON.parse(resp.body) as ResponsesAPIResult
    const requestId = resp.headers.get('x-request-id') ?? resp.headers.get('cf-ray') ?? null
    console.info('OPENAI_PROVIDER_CONFIRM', JSON.stringify({
      requestedModel: model,
      returnedModel:  data.model ?? null,
      requestId,
      status:         resp.status,
      ok:             true,
      docKind,
    }))
    // Responses API: output[0].content[] where type=='output_text'
    aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('OPENAI_AI_ERROR', JSON.stringify({ model, docKind, errorMessage: msg }))
    captureAiError(e, {
      endpoint: 'parse-invoice-ai', requestId: null, category: 'provider_error',
      userId, extra: { model, docKind },
    })
    await flushSentry()
    return err(502, 'ai_call_failed', msg, { aiModelUsed: model, aiAttempted: true })
  }

  // ── Parse AI response ─────────────────────────────────────────────────────

  let ai: Record<string, unknown>
  try {
    ai = JSON.parse(aiRaw) as Record<string, unknown>
  } catch {
    console.error('OPENAI_AI_ERROR', JSON.stringify({ model, docKind, errorMessage: 'ai_invalid_json', preview: aiRaw.slice(0, 300) }))
    captureAiError(new Error('AI returned non-JSON response'), {
      endpoint: 'parse-invoice-ai', requestId: null, category: 'provider_error',
      userId, extra: { model, docKind, rawPreview: aiRaw.slice(0, 300) },
    })
    await flushSentry()
    return err(502, 'ai_invalid_json', 'AI returned non-JSON response', { aiModelUsed: model, aiAttempted: true })
  }

  // ── Normalize helpers ─────────────────────────────────────────────────────

  function normDate(raw: unknown): string | null {
    if (!raw || typeof raw !== 'string') return null
    const clean = raw.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
    const parts = clean.split(/[.\/-]/)
    if (parts.length === 3) {
      if (parts[0].length <= 2 && parts[2].length === 4)
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      if (parts[0].length === 4)
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
    }
    return null
  }

  function toNum(v: unknown): number | null {
    if (v == null) return null
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
  }

  function toStr(v: unknown): string | null {
    if (v == null || v === '') return null
    return String(v).trim() || null
  }

  // ── NIP checksum (Polish 10-digit tax ID) ──────────────────────────────────
  function validatedNip(raw: string | null): string | null {
    if (!raw) return null
    const d = raw.replace(/\D/g, '')
    if (d.length !== 10) return null
    const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    const sum = w.reduce((acc, wt, i) => acc + wt * parseInt(d[i]), 0)
    return sum % 11 === parseInt(d[9]) ? d : null
  }

  // ── Vendor sanity: reject obvious document-label hallucinations ───────────
  function sanitizedVendor(raw: string | null): string | null {
    if (!raw) return null
    const BAD = /^(faktura|paragon|nip|data wystawienia|data sprzeda|termin|razem|brutto|netto|do zap.?aty|suma|nr faktury|nr dok)/i
    if (BAD.test(raw.trim())) return null
    if (/^\d+$/.test(raw.replace(/[\s\-]/g, ''))) return null  // purely numeric — hallucinated NIP
    return raw.trim() || null
  }

  // ── Amount sanity ──────────────────────────────────────────────────────────
  function sanityAmount(v: number | null): number | null {
    if (v == null || !isFinite(v) || v < 0 || v > 10_000_000) return null
    return v
  }

  // ── General party text sanitizer — removes payment/bank noise lines ────────
  function cleanPartyText(value?: string | null): string | null {
    if (!value) return null
    const forbidden = [
      /\bbank\b/i,
      /\biban\b/i,
      /\bswift\b/i,
      /\bbic\b/i,
      /\bkonto\b/i,
      /\brachunek\b/i,
      /\bnr rachunku\b/i,
      /\bnumer rachunku\b/i,
      /\bp.atno.{0,4}\b/i,
      /\bforma p.atno.ci\b/i,
      /\btermin p.atno.ci\b/i,
      /\bdo zap.aty\b/i,
      /\bPL\d{2}[A-Z0-9]{10,}\b/i,
      /\b\d{26}\b/,
    ]
    const cleaned = value
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((line) => !forbidden.some((rx) => rx.test(line)))
      .join(', ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/,+/g, ',')
      .replace(/^,\s*|\s*,\s*$/g, '')
      .trim()
    return cleaned || null
  }

  const nipRaw  = toStr(ai.vendor_nip)
  let   netAmt  = sanityAmount(toNum(ai.net_amount))
  let   vatAmt  = sanityAmount(toNum(ai.vat_amount))
  let   grossAmt = sanityAmount(toNum(ai.gross_amount))

  // Derive missing amount
  if (grossAmt == null && netAmt != null && vatAmt != null)
    grossAmt = Math.round((netAmt + vatAmt) * 100) / 100

  // Cross-check: if net+vat deviates from gross by > 5%, add warning
  const extraWarnings: string[] = []
  if (netAmt != null && vatAmt != null && grossAmt != null) {
    const derived   = Math.round((netAmt + vatAmt) * 100) / 100
    const tolerance = Math.max(0.10, grossAmt * 0.05)
    if (Math.abs(derived - grossAmt) > tolerance) {
      extraWarnings.push(`Niespójność kwot: netto(${netAmt})+VAT(${vatAmt})=${derived} ≠ brutto(${grossAmt})`)
      vatAmt = Math.round((grossAmt - netAmt) * 100) / 100  // derive vat from gross
    }
  }

  const rawVendor        = toStr(ai.vendor_name)
  const rawVendorAddress = toStr(ai.vendor_address)
  const rawBuyerName     = toStr(ai.buyer_name)
  const rawBuyerAddress  = toStr(ai.buyer_address)

  const cleanedVendor        = cleanPartyText(rawVendor)
  const cleanedVendorAddress = cleanPartyText(rawVendorAddress)
  const cleanedBuyerName     = cleanPartyText(rawBuyerName)
  const cleanedBuyerAddress  = cleanPartyText(rawBuyerAddress)

  const docType   = toStr(ai.document_type) ?? 'unknown'
  let   aiConf    = typeof ai.confidence === 'number' ? Math.min(100, Math.max(0, ai.confidence)) : 50
  const warnings  = [...(Array.isArray(ai.warnings) ? (ai.warnings as unknown[]).map(String) : []), ...extraWarnings]

  // Lower confidence when critical fields failed validation
  const validVendorVal = sanitizedVendor(cleanedVendor)
  const validNipVal    = validatedNip(nipRaw)
  const validBuyerNip  = validatedNip(toStr(ai.buyer_nip))

  console.info('AI_PARTY_SANITIZE', JSON.stringify({
    beforeVendorName:    rawVendor ?? null,
    afterVendorName:     cleanedVendor ?? null,
    beforeVendorAddress: rawVendorAddress ?? null,
    afterVendorAddress:  cleanedVendorAddress ?? null,
    beforeBuyerName:     rawBuyerName ?? null,
    afterBuyerName:      cleanedBuyerName ?? null,
    beforeBuyerAddress:  rawBuyerAddress ?? null,
    afterBuyerAddress:   cleanedBuyerAddress ?? null,
  }))

  if (!validVendorVal) { aiConf = Math.min(aiConf, 60); warnings.push('Nazwa sprzedawcy odrzucona (podejrzana wartość)') }
  if (nipRaw && !validNipVal) warnings.push(`NIP "${nipRaw}" odrzucony — niepoprawna suma kontrolna`)

  // Normalize line items
  const aiLineItems = Array.isArray(ai.line_items) ? ai.line_items as unknown[] : []
  const lineItems = aiLineItems
    .map((item) => {
      const it = item as Record<string, unknown>
      return {
        name:         toStr(it.name),
        quantity:     toNum(it.quantity),
        unit:         toStr(it.unit),
        unit_net:     sanityAmount(toNum(it.unit_net)),
        vat_rate:     toNum(it.vat_rate),
        net_amount:   sanityAmount(toNum(it.net_amount)),
        vat_amount:   sanityAmount(toNum(it.vat_amount)),
        gross_amount: sanityAmount(toNum(it.gross_amount)),
      }
    })
    .filter((it) => it.name != null)

  const normalizedDocType = (docType === 'invoice' || docType === 'receipt' || docType === 'bill' || docType === 'other')
    ? docType as ParseInvoiceResult['document_type']
    : null

  const result: ParseInvoiceResult = {
    document_type:              normalizedDocType,
    vendor_name:                validVendorVal,
    vendor_nip:                 validNipVal,
    vendor_address:             cleanedVendorAddress,
    buyer_name:                 cleanedBuyerName,
    buyer_nip:                  validBuyerNip,
    buyer_address:              cleanedBuyerAddress,
    line_items:                 lineItems,
    invoice_number:             toStr(ai.document_number),
    issue_date:                 normDate(ai.issue_date),
    sale_date:                  normDate(ai.sale_date),
    net_amount:                 netAmt,
    vat_amount:                 vatAmt,
    // Derive dominant VAT rate from line items (most common), or null
    vat_rate: (() => {
      const rates = lineItems.map(it => it.vat_rate).filter((r): r is number => r != null)
      if (!rates.length) return null
      const freq = rates.reduce((m, r) => { m.set(r, (m.get(r) ?? 0) + 1); return m }, new Map<number, number>())
      return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
    })(),
    gross_amount:               grossAmt,
    currency:                   toStr(ai.currency) ?? 'PLN',
    payment_due_date:           normDate(ai.payment_due_date),
    notes:                      toStr(ai.notes) ?? (docType === 'receipt' ? 'Paragon fiskalny' : null),
    extraction_confidence:      aiConf,
    extraction_warnings:        warnings,
    requires_user_confirmation: aiConf < 80,
    parser_source:              'ai',
  }

  console.info('OPENAI_AI_DONE', JSON.stringify({
    model,
    docKind,
    confidence:    aiConf,
    hasVendor:     !!result.vendor_name,
    hasGross:      result.gross_amount != null,
    hasNip:        !!result.vendor_nip,
    hasBuyer:      !!result.buyer_name,
    lineItemCount: lineItems.length,
    warningCount:  warnings.length,
  }))
  return ok(result, { aiModelUsed: model })
}

