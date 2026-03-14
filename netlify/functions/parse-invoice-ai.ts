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

function ok(result: ParseInvoiceResult) {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: true, result }),
  }
}

function err(statusCode: number, error: string, message: string) {
  console.error(`[parse-invoice-ai] ${error}: ${message}`)
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: false, error, message }),
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
    return err(503, 'ai_not_configured', 'OPENAI_API_KEY is not set in Netlify environment variables')
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
    return err(400, 'missing_input', 'Provide text_content or image_base64')
  }

  // ── Validate image MIME — never accept PDF in vision path ────────────────
  // FIX 3: Raw PDF base64 sent to vision endpoint causes OpenAI 400.
  //        If the client accidentally sends a PDF, fall back to text mode.

  const isValidImageMime = imageBase64 &&
    /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i.test(imageType)

  const useVision = !!isValidImageMime
  const model     = useVision ? 'gpt-4o' : 'gpt-4o-mini'

  console.log(`[parse-invoice-ai] doc_kind=${useVision ? 'image' : 'text'} mime=${imageType} text_len=${textContent?.length ?? 0} b64_len=${imageBase64?.length ?? 0} model=${model}`)

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

  console.log(`[parse-invoice-ai] Sending request to OpenAI Responses API, model=${model}`)

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
    console.log(`[parse-invoice-ai] OpenAI status=${resp.status} body_len=${rawBody.length}`)

    if (!resp.ok) {
      let oaiErr: Record<string, unknown> = {}
      try { oaiErr = JSON.parse(rawBody) as Record<string, unknown> } catch { /* noop */ }
      const errObj   = oaiErr.error as Record<string, unknown> | undefined
      const errDetail = errObj?.message ?? errObj?.code ?? rawBody.slice(0, 200)
      throw new Error(`OpenAI ${resp.status}: ${String(errDetail)}`)
    }

    const data = JSON.parse(rawBody) as ResponsesAPIResult
    // Responses API: output[0].content[] where type=='output_text'
    aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
    console.log(`[parse-invoice-ai] AI raw response len=${aiRaw.length}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return err(502, 'ai_call_failed', msg)
  }

  // ── Parse AI response ─────────────────────────────────────────────────────

  let ai: Record<string, unknown>
  try {
    ai = JSON.parse(aiRaw) as Record<string, unknown>
  } catch {
    console.error(`[parse-invoice-ai] Failed to parse JSON: ${aiRaw.slice(0, 300)}`)
    return err(502, 'ai_invalid_json', 'AI returned non-JSON response')
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

  const nipRaw  = toStr(ai.vendor_nip)
  const nip     = nipRaw ? nipRaw.replace(/[\s\-]/g, '') : null
  const netAmt  = toNum(ai.net_amount)
  const vatAmt  = toNum(ai.vat_amount)
  let   grossAmt = toNum(ai.gross_amount)
  if (grossAmt == null && netAmt != null && vatAmt != null)
    grossAmt = Math.round((netAmt + vatAmt) * 100) / 100

  const docType  = toStr(ai.document_type) ?? 'unknown'
  const aiConf   = typeof ai.confidence === 'number' ? Math.min(100, Math.max(0, ai.confidence)) : 50
  const warnings = Array.isArray(ai.warnings) ? (ai.warnings as unknown[]).map(String) : []

  const result: ParseInvoiceResult = {
    vendor_name:                toStr(ai.vendor_name),
    vendor_nip:                 nip && /^\d{10}$/.test(nip) ? nip : null,
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

  console.log(`[parse-invoice-ai] Done confidence=${aiConf} vendor=${result.vendor_name} gross=${result.gross_amount}`)
  return ok(result)
}

// AI extraction of invoice/receipt data via OpenAI Responses API with:
//   • Structured JSON output (json_schema, strict mode)
//   • Vision input for images / scanned PDFs (gpt-4o)
//   • Text input for PDF text layer / Tesseract output (gpt-4o-mini)
//
// Request (POST /.netlify/functions/parse-invoice-ai):
//   Content-Type: application/json
//   {
//     text_content?: string   // raw text from PDF or Tesseract OCR
//     image_base64?: string   // base64-encoded image (JPEG/PNG/WEBP) — vision mode
//     image_type?:  string    // MIME type, e.g. "image/jpeg"
//   }
//
// Response 200: ParseInvoiceResult (parser_source = 'ai')
// Response 4xx/5xx: { error: string, message?: string }

import type { Handler, HandlerEvent } from '@netlify/functions'
import type { ParseInvoiceResult } from './parse-invoice'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) }
}

// ─── JSON Schema for Structured Output ───────────────────────────────────────
// Used with Responses API text.format — enforces strict, well-typed output.

const INVOICE_JSON_SCHEMA = {
  name:   'invoice_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      document_type:    { type: 'string', enum: ['invoice', 'receipt', 'unknown'] },
      vendor_name:      { type: ['string', 'null'] },
      vendor_nip:       { type: ['string', 'null'] },
      document_number:  { type: ['string', 'null'] },
      issue_date:       { type: ['string', 'null'] },
      sale_date:        { type: ['string', 'null'] },
      payment_due_date: { type: ['string', 'null'] },
      payment_method:   { type: ['string', 'null'] },
      currency:         { type: 'string' },
      net_amount:       { type: ['number', 'null'] },
      vat_amount:       { type: ['number', 'null'] },
      gross_amount:     { type: ['number', 'null'] },
      buyer_name:       { type: ['string', 'null'] },
      buyer_nip:        { type: ['string', 'null'] },
      notes:            { type: ['string', 'null'] },
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
  if (event.httpMethod !== 'POST')    return json(405, { error: 'method_not_allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return json(503, { error: 'ai_not_configured', message: 'Klucz AI nie jest skonfigurowany' })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  const textContent = body.text_content as string | undefined
  const imageBase64 = body.image_base64 as string | undefined
  const imageType   = String(body.image_type ?? 'image/jpeg')

  if (!textContent && !imageBase64) {
    return json(400, { error: 'missing_input', message: 'Wymagany text_content lub image_base64' })
  }

  // ── Build Responses API input ─────────────────────────────────────────────
  // Vision mode (gpt-4o)  : image input + optional rawText as context hint
  // Text mode (gpt-4o-mini): text input only — cheaper for PDF text layer / OCR

  const model = imageBase64 ? 'gpt-4o' : 'gpt-4o-mini'

  type InputItem = { type: string; text?: string; image_url?: string }
  const content: InputItem[] = []

  if (imageBase64) {
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
    content.push({
      type: 'input_text',
      text: `Wyekstrahuj dane z poniższego tekstu dokumentu:\n\n${(textContent ?? '').slice(0, 12_000)}`,
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
        text:  { format: INVOICE_JSON_SCHEMA },
        max_output_tokens: 1_000,
      }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({})) as Record<string, unknown>
      const errMsg = typeof err.error === 'object'
        ? (err.error as Record<string, unknown>).message ?? resp.status
        : err.error ?? resp.status
      throw new Error(`OpenAI ${resp.status}: ${String(errMsg)}`)
    }

    const data = await resp.json() as ResponsesAPIResult
    // Responses API: output[0].content[0].text
    aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
  } catch (e: unknown) {
    return json(502, {
      error:   'ai_call_failed',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  // ── Parse AI response ─────────────────────────────────────────────────────

  let ai: Record<string, unknown>
  try {
    ai = JSON.parse(aiRaw) as Record<string, unknown>
  } catch {
    return json(502, { error: 'ai_invalid_json', message: 'AI zwróciło niepoprawny JSON' })
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

  const nipRaw = toStr(ai.vendor_nip)
  const nip    = nipRaw ? nipRaw.replace(/[\s\-]/g, '') : null

  const netAmt  = toNum(ai.net_amount)
  const vatAmt  = toNum(ai.vat_amount)
  let grossAmt  = toNum(ai.gross_amount)
  // Derive missing amount
  if (grossAmt == null && netAmt != null && vatAmt != null)
    grossAmt = Math.round((netAmt + vatAmt) * 100) / 100

  const docType  = toStr(ai.document_type) ?? 'unknown'
  const aiConf   = typeof ai.confidence === 'number' ? Math.min(100, Math.max(0, ai.confidence)) : 50
  const warnings = Array.isArray(ai.warnings) ? (ai.warnings as unknown[]).map(String) : []

  const result: ParseInvoiceResult = {
    vendor_name:      toStr(ai.vendor_name),
    vendor_nip:       nip && /^\d{10}$/.test(nip) ? nip : null,
    invoice_number:   toStr(ai.document_number),
    issue_date:       normDate(ai.issue_date),
    sale_date:        normDate(ai.sale_date),
    net_amount:       netAmt,
    vat_amount:       vatAmt,
    gross_amount:     grossAmt,
    currency:         toStr(ai.currency) ?? 'PLN',
    payment_due_date: normDate(ai.payment_due_date),
    notes:            toStr(ai.notes) ?? (docType === 'receipt' ? 'Paragon fiskalny' : null),
    extraction_confidence:      aiConf,
    extraction_warnings:        warnings,
    requires_user_confirmation: aiConf < 80,
    parser_source:              'ai',
  }

  return json(200, result as unknown as Record<string, unknown>)
}
