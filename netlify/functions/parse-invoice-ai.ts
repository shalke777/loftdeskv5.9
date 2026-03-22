// =============================================================================
// Netlify Function: parse-invoice-ai  (v3 — OpenAI Responses API, fixed)
// =============================================================================
// AI extraction of invoice/receipt data via OpenAI Responses API with:
//   • Structured JSON output — text.format.type = 'json_schema' (required)
//   • Nullable fields via anyOf (strict schema — array types not supported)
//   • Vision input: gpt-4.5-preview for images (JPEG/PNG/WEBP only — not raw PDF)
//   • Text input: gpt-4.5-preview for PDF text layer / Tesseract output
//
// Request (POST /.netlify/functions/parse-invoice-ai):
//   Content-Type: application/json
//   {
//     text_content?: string   // raw text from PDF text layer or Tesseract OCR
//     image_base64?: string   // base64-encoded image JPEG/PNG/WEBP (NOT PDF)
//     image_type?:  string    // MIME, e.g. "image/jpeg" — must be image/*
//   }
//
// Response 200: { ok: true, result: ParseInvoiceResult }
// Response 4xx/5xx: { ok: false, error: string, message: string }

import type { Handler, HandlerEvent } from '@netlify/functions'
import type { ParseInvoiceResult } from './parse-invoice'
import { extractTextFromPDF, extractEmbeddedJpegsFromPdf } from './parse-invoice'
import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
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

// ─── Rate limiting (in-memory, per user, 10 req / 10 min) ────────────────────
// Stricter than OCR because each request calls the OpenAI API.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_MAX       = 10
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
- document_type: "invoice" for faktura VAT; "receipt" for paragon/kasa fiskalna/NR PARAGONU; "bill" for rachunki/proforma/zaliczka; "other" for anything else.
- issue_date, sale_date, payment_due_date: ISO YYYY-MM-DD; convert from DD.MM.YYYY or MM/DD/YYYY.
- vendor_nip / buyer_nip: exactly 10 digits, no dashes/spaces, or null.
- currency: default "PLN" if not specified.
- Amounts: decimal with dot separator (e.g. 1234.56), never a string.
- confidence: 0–100, where 100 = all key fields read with full certainty.
- For receipts: document_number may be null.
- If rawText is provided as supplementary context: treat it as a hint; the image (if present) is the primary source.`

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
  if (isRateLimited(userId)) return err(429, 'too_many_requests', 'Za dużo żądań. Spróbuj za chwilę.')

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
  // This enables the same AI quality for PDFs as for scanned images.
  const pdfBase64 = body.pdf_base64 as string | undefined
  if (pdfBase64) {
    try {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64')

      // 1. Try to extract text layer (works for all digitally-generated PDFs)
      const extracted = await extractTextFromPDF(pdfBuffer)
      if (extracted.trim().length >= 40) {
        // Append to any locally-extracted text the caller may have passed
        textContent = extracted + (textContent ? '\n\n' + textContent : '')
        console.info('PDF_TEXT_EXTRACTED', JSON.stringify({ chars: extracted.length }))
      } else {
        // 2. Scanned PDF — extract embedded JPEG images and use first one for vision
        const jpegs = extractEmbeddedJpegsFromPdf(pdfBuffer)
        if (jpegs.length > 0) {
          imageBase64 = jpegs[0].toString('base64')
          imageType   = 'image/jpeg'
          console.info('PDF_JPEG_EXTRACTED', JSON.stringify({ total: jpegs.length, usedIndex: 0, sizeBytes: jpegs[0].length }))
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
    return err(400, 'missing_input', 'Provide text_content, image_base64, or pdf_base64', { aiAttempted: false })
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

  // ── Call OpenAI Responses API ─────────────────────────────────────────────

  let aiRaw: string
  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: INSTRUCTIONS,
        input: [{ role: 'user', content }],
        // FIX 1: text.format must include type:'json_schema' as a top-level property
        // FIX 4: name/strict/schema must be nested under json_schema key
        text:  { format: INVOICE_SCHEMA_FORMAT },
        max_output_tokens: 2_500,
      }),
    })

    const rawBody = await resp.text()

    // ── DIAGNOSTIC LOG ──────────────────────────────────────────────────────
    if (resp.ok) {
      console.info('OPENAI_AI_RESPONSE', JSON.stringify({
        model,
        status:     resp.status,
        ok:         true,
        bodyLength: rawBody.length,
        docKind,
      }))
    } else {
      console.error('OPENAI_AI_ERROR', JSON.stringify({
        model,
        status:       resp.status,
        ok:           false,
        docKind,
        bodyPreview:  rawBody.slice(0, 300),
      }))
    }

    if (!resp.ok) {
      let oaiErr: Record<string, unknown> = {}
      try { oaiErr = JSON.parse(rawBody) as Record<string, unknown> } catch { /* noop */ }
      const errObj    = oaiErr.error as Record<string, unknown> | undefined
      const errDetail = errObj?.message ?? errObj?.code ?? rawBody.slice(0, 200)

      // Propagate quota/billing errors with a meaningful status (not 502)
      if (resp.status === 429) {
        const msg = 'OpenAI quota exceeded or billing is not active for the current API project.'
        console.error('OPENAI_AI_ERROR', JSON.stringify({ model, docKind, status: 429, errorMessage: msg, detail: String(errDetail) }))
        return err(429, 'openai_quota_exceeded', msg, { aiModelUsed: model, aiAttempted: true })
      }

      throw new Error(`OpenAI ${resp.status}: ${String(errDetail)}`)
    }

    const data = JSON.parse(rawBody) as ResponsesAPIResult
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
    return err(502, 'ai_call_failed', msg, { aiModelUsed: model, aiAttempted: true })
  }

  // ── Parse AI response ─────────────────────────────────────────────────────

  let ai: Record<string, unknown>
  try {
    ai = JSON.parse(aiRaw) as Record<string, unknown>
  } catch {
    console.error('OPENAI_AI_ERROR', JSON.stringify({ model, docKind, errorMessage: 'ai_invalid_json', preview: aiRaw.slice(0, 300) }))
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

