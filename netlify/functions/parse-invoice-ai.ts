// =============================================================================
// Netlify Function: parse-invoice-ai
// =============================================================================
// AI-powered (GPT-4o / GPT-4o-mini) extraction of invoice and receipt data.
// Called as a fallback from the client when local OCR + regex gives a weak
// result (confidence < 70, fewer than 3 key fields, or document is a receipt).
//
// Request (POST /.netlify/functions/parse-invoice-ai):
//   Content-Type: application/json
//   {
//     text_content?: string   // raw text from PDF or Tesseract OCR
//     image_base64?: string   // base64-encoded image (JPEG/PNG) — for vision mode
//     image_type?:  string    // MIME type of the image, e.g. "image/jpeg"
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

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Jesteś asystentem do odczytu polskich dokumentów finansowych — faktur VAT i paragonów fiskalnych.
Twoim jedynym zadaniem jest wyekstrahować ustrukturyzowane dane z dostarczonego tekstu lub obrazu dokumentu.
Zawsze zwracaj TYLKO poprawny obiekt JSON. Nie dodawaj żadnych wyjaśnień ani tekstu poza JSON.

Schemat odpowiedzi:
{
  "document_type": "invoice" | "receipt" | "unknown",
  "vendor_name": string | null,
  "vendor_nip": string | null,
  "document_number": string | null,
  "issue_date": string | null,
  "sale_date": string | null,
  "payment_due_date": string | null,
  "payment_method": string | null,
  "currency": string,
  "net_amount": number | null,
  "vat_amount": number | null,
  "gross_amount": number | null,
  "buyer_name": string | null,
  "buyer_nip": string | null,
  "notes": string | null,
  "confidence": number,
  "warnings": string[]
}

Zasady:
- Kwoty jako liczby dziesiętne (np. 1234.56), nie jako string. Separator dziesiętny: kropka.
- Daty w formacie ISO: YYYY-MM-DD. Konwertuj z DD.MM.YYYY lub innych formatów.
- vendor_nip: tylko 10 cyfr bez separatorów (myślników, spacji).
- document_type: ustaw "receipt" jeśli w tekście/obrazie widać: paragon, fiskalny, PTU, kasa fiskalna, NR PARAGONU.
- confidence: 0–100. 100 = wszystkie kluczowe pola odczytane. 0 = brak danych.
- Jeśli pola brakuje lub jest nieczytelne — użyj null.
- gross_amount: kwota "do zapłaty" / "razem brutto" / suma na paragonie.
- Dla paragonu: document_number może być pusty lub być numerem paragonu fiskalnego.`

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

  // ── Build OpenAI request content ──────────────────────────────────────────
  // Vision mode for images (gpt-4o); text mode for extracted text (gpt-4o-mini).

  let userContent: unknown
  let model: string

  if (imageBase64) {
    model = 'gpt-4o'
    userContent = [
      {
        type: 'image_url',
        image_url: {
          url:    `data:${imageType};base64,${imageBase64}`,
          detail: 'high',
        },
      },
      {
        type: 'text',
        text: 'Wyekstrahuj dane z tego dokumentu zgodnie z instrukcją systemową. Zwróć tylko JSON.',
      },
    ]
  } else {
    model = 'gpt-4o-mini'
    userContent = `Wyekstrahuj dane z poniższego tekstu dokumentu. Zwróć tylko JSON.\n\n${(textContent ?? '').slice(0, 12_000)}`
  }

  // ── Call OpenAI ───────────────────────────────────────────────────────────

  let aiRaw: string
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens:  900,
        temperature: 0,
      }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({})) as Record<string, unknown>
      const errMsg = typeof err.error === 'object'
        ? (err.error as Record<string, unknown>).message ?? resp.status
        : err.error ?? resp.status
      throw new Error(`OpenAI ${resp.status}: ${String(errMsg)}`)
    }

    const data = await resp.json() as { choices: { message: { content: string } }[] }
    aiRaw = data.choices?.[0]?.message?.content ?? '{}'
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
