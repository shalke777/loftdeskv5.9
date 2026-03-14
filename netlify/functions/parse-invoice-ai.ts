// =============================================================================
// Netlify Function: parse-invoice-ai  (v3 — OpenAI Responses API, fixed)
// =============================================================================
// AI extraction of invoice/receipt data via OpenAI Responses API with:
//   • Structured JSON output — text.format.type = 'json_schema' (required)
//   • Nullable fields via anyOf (strict schema — array types not supported)
//   • Vision input: gpt-4o for images (JPEG/PNG/WEBP only — not raw PDF)
//   • Text input: gpt-4o-mini for PDF text layer / Tesseract output
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
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

// BUG 4 FIX: Responses API (and Chat Completions) require name/strict/schema
// to be nested under a `json_schema` key inside `format`:
//   { type: 'json_schema', json_schema: { name, strict, schema } }
// Previously these were placed at the top level — OpenAI returned 400.
const INVOICE_SCHEMA_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name:   'invoice_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        document_type:    { type: 'string', enum: ['invoice', 'receipt', 'unknown'] },
        vendor_name:      ns,
        vendor_nip:       ns,
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
        notes:            ns,
        confidence:       { type: 'number' },
        warnings:         { type: 'array', items: { type: 'string' } },
      },
      required: [
        'document_type', 'vendor_name', 'vendor_nip', 'document_number',
        'issue_date', 'sale_date', 'payment_due_date', 'payment_method',
        'currency', 'net_amount', 'vat_amount', 'gross_amount',
        'buyer_name', 'buyer_nip', 'notes', 'confidence', 'warnings',
      ],
      additionalProperties: false,
    },
  },
}

// ─── System instructions ──────────────────────────────────────────────────────

const INSTRUCTIONS = `Jesteś parserem dokumentów kosztowych dla polskiej aplikacji SaaS.
Masz przeanalizować obraz faktury lub paragonu i zwrócić WYŁĄCZNIE poprawny JSON zgodny ze schemą.

Rozpoznaj:
- typ dokumentu: invoice / receipt / unknown
- sprzedawcę i jego NIP
- numer dokumentu
- datę wystawienia i datę sprzedaży
- termin płatności i metodę płatności
- walutę
- kwotę netto, VAT, brutto
- nabywcę i jego NIP (jeśli podany)
- uwagi, jeśli relevantne

Zasady:
- preferuj dokładność nad zgadywaniem — jeśli nie jesteś pewny, zostaw pole null
- kwoty jako liczby dziesiętne z kropką (np. 1234.56), nigdy jako string
- daty w formacie ISO YYYY-MM-DD (konwertuj z DD.MM.YYYY lub MM/DD/YYYY)
- vendor_nip: dokładnie 10 cyfr, bez myślników ani spacji
- document_type: "receipt" gdy widzisz paragon / kasa fiskalna / PTU / NR PARAGONU
- currency domyślnie "PLN" jeśli nie widać innej
- confidence: 0–100 (100 = wszystkie kluczowe pola odczytane pewnie)
- dla paragonów document_number może być null
- jeśli masz rawText jako kontekst pomocniczy — traktuj go jako wskazówkę, obraz jest źródłem nadrzędnym`

// ─── OpenAI Responses API types ───────────────────────────────────────────────

interface ResponsesAPIResult {
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

  const textContent = body.text_content as string | undefined
  const imageBase64 = body.image_base64 as string | undefined
  const imageType   = String(body.image_type ?? 'image/jpeg')

  if (!textContent && !imageBase64) {
    return err(400, 'missing_input', 'Provide text_content or image_base64', { aiAttempted: false })
  }

  // ── Validate image MIME — never accept PDF in vision path ────────────────
  // FIX 3: Raw PDF base64 sent to vision endpoint causes OpenAI 400.
  //        If the client accidentally sends a PDF, fall back to text mode.

  const isValidImageMime = imageBase64 &&
    /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i.test(imageType)

  const useVision = !!isValidImageMime
  // Allow forced model override for diagnostics (set OPENAI_DEBUG_FORCE_MODEL in Netlify env)
  const model = process.env.OPENAI_DEBUG_FORCE_MODEL
    ?? (useVision ? 'gpt-4o' : 'gpt-4o-mini')

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
      text: `Wyekstrahuj dane z tego dokumentu.${hint}`,
    })
  } else {
    // Text mode: use textContent OR degrade gracefully when imageBase64 is PDF
    const txt = textContent?.trim()
      ? textContent.slice(0, 12_000)
      : 'Brak wyodrębnionego tekstu — proszę podać dane dokumentu.'
    content.push({
      type: 'input_text',
      text: `Wyekstrahuj dane z poniższego tekstu dokumentu:\n\n${txt}`,
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
        max_output_tokens: 1_500,
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
      throw new Error(`OpenAI ${resp.status}: ${String(errDetail)}`)
    }

    const data = JSON.parse(rawBody) as ResponsesAPIResult
    // Responses API: output[0].content[] where type=='output_text'
    aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
    console.info('[parse-invoice-ai] AI raw response len=' + aiRaw.length)
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

  const rawVendor = toStr(ai.vendor_name)
  const docType   = toStr(ai.document_type) ?? 'unknown'
  let   aiConf    = typeof ai.confidence === 'number' ? Math.min(100, Math.max(0, ai.confidence)) : 50
  const warnings  = [...(Array.isArray(ai.warnings) ? (ai.warnings as unknown[]).map(String) : []), ...extraWarnings]

  // Lower confidence when critical fields failed validation
  const validVendorVal = sanitizedVendor(rawVendor)
  const validNipVal    = validatedNip(nipRaw)
  if (!validVendorVal) { aiConf = Math.min(aiConf, 60); warnings.push('Nazwa sprzedawcy odrzucona (podejrzana wartość)') }
  if (nipRaw && !validNipVal) warnings.push(`NIP "${nipRaw}" odrzucony — niepoprawna suma kontrolna`)

  const result: ParseInvoiceResult = {
    vendor_name:                validVendorVal,
    vendor_nip:                 validNipVal,
    invoice_number:             toStr(ai.document_number),
    issue_date:                 normDate(ai.issue_date),
    sale_date:                  normDate(ai.sale_date),
    net_amount:                 netAmt,
    vat_amount:                 vatAmt,
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
    confidence: aiConf,
    hasVendor:  !!result.vendor_name,
    hasGross:   result.gross_amount != null,
    hasNip:     !!result.vendor_nip,
    warningCount: warnings.length,
  }))
  return ok(result, { aiModelUsed: model })
}

