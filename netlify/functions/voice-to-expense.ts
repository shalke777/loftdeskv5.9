// =============================================================================
// voice-to-expense.ts — Voice note → structured expense data
// =============================================================================
// 1. Receives audio blob (base64) from the browser
// 2. Sends to Whisper API for transcription (Polish language, construction hints)
// 3. Sends transcript to GPT-4o-mini for expense data extraction
// 4. Returns ParseInvoiceResult-compatible object for ExpenseConfirmForm
//
// Request:
//   POST /.netlify/functions/voice-to-expense
//   Authorization: Bearer <supabase_jwt>
//   Content-Type: application/json
//   Body: { audio_base64: string, audio_type: string }
//
// Response 200:
//   { vendor_name, gross_amount, net_amount, currency, description,
//     cost_type, invoice_number, issue_date, extraction_confidence,
//     transcript, parser_source: 'voice_whisper' }
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function verifyAuth(event: HandlerEvent): Promise<string | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return 'dev'
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

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' }

  const userId = await verifyAuth(event)
  if (!userId) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'OpenAI not configured' }) }

  let body: { audio_base64?: string; audio_type?: string }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { audio_base64, audio_type = 'audio/webm' } = body
  if (!audio_base64) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'audio_base64 required' }) }

  // ── Step 1: Whisper transcription ──────────────────────────────────────────

  let transcript = ''
  try {
    const audioBuffer = Buffer.from(audio_base64, 'base64')
    const ext = audio_type.includes('mp4') ? 'mp4'
      : audio_type.includes('ogg') ? 'ogg'
      : audio_type.includes('wav') ? 'wav'
      : 'webm'

    const audioBlob = new Blob([audioBuffer], { type: audio_type })
    const formData  = new FormData()
    formData.append('file', audioBlob, `recording.${ext}`)
    formData.append('model', 'whisper-1')
    formData.append('language', 'pl')
    formData.append('prompt', 'firma budowlana, faktura, materiały budowlane, robocizna, VAT, brutto, netto, złoty, zakup')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      console.error('[voice-to-expense] Whisper error:', err)
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Transcription failed', detail: err }) }
    }

    const whisperData = await whisperRes.json() as { text?: string }
    transcript = (whisperData.text ?? '').trim()
    if (!transcript) return { statusCode: 422, headers: corsHeaders, body: JSON.stringify({ error: 'Empty transcript' }) }
  } catch (err) {
    console.error('[voice-to-expense] Whisper exception:', err)
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Transcription exception' }) }
  }

  // ── Step 2: GPT-4o-mini expense extraction ─────────────────────────────────

  const systemPrompt = `Jesteś asystentem firmy budowlano-wykończeniowej w Polsce.
Wyciągnij dane wydatku z transkrypcji głosowej i zwróć TYLKO JSON bez dodatkowego tekstu.

Pola do wyciągnięcia:
- vendor_name: nazwa sprzedawcy/dostawcy (string lub null)
- invoice_number: numer faktury lub paragonu jeśli podany (string lub null)
- issue_date: data w formacie YYYY-MM-DD jeśli podana (string lub null)
- gross_amount: kwota brutto (number, wymagane — jeśli nie podano VAT, traktuj jako brutto)
- net_amount: kwota netto (number lub null)
- currency: waluta (domyślnie "PLN")
- description: krótki opis wydatku po polsku (string)
- cost_type: jeden z: material, service, labor, transport, equipment, other`

  try {
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transkrypcja: "${transcript}"` },
        ],
      }),
    })

    if (!gptRes.ok) {
      console.error('[voice-to-expense] GPT error:', await gptRes.text())
      // Return raw transcript even if parsing fails
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          description: transcript,
          gross_amount: null,
          currency: 'PLN',
          cost_type: 'other',
          extraction_confidence: 20,
          parser_source: 'voice_whisper',
          extraction_warnings: ['Nie udało się przetworzyć transkrypcji — uzupełnij dane ręcznie.'],
        }),
      }
    }

    const gptData = await gptRes.json() as { choices: Array<{ message: { content: string } }> }
    const raw = gptData.choices?.[0]?.message?.content ?? '{}'

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {}
    }

    const gross = typeof parsed.gross_amount === 'number' ? parsed.gross_amount : null
    const net   = typeof parsed.net_amount === 'number' ? parsed.net_amount : null
    const confidence = gross ? 65 : 30

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        vendor_name:    parsed.vendor_name   ?? null,
        invoice_number: parsed.invoice_number ?? null,
        issue_date:     parsed.issue_date    ?? null,
        gross_amount:   gross,
        net_amount:     net,
        vat_amount:     gross != null && net != null ? +(gross - net).toFixed(2) : null,
        currency:       typeof parsed.currency === 'string' ? parsed.currency : 'PLN',
        description:    typeof parsed.description === 'string' ? parsed.description : transcript,
        cost_type:      typeof parsed.cost_type === 'string' ? parsed.cost_type : 'other',
        extraction_confidence: confidence,
        parser_source:  'voice_whisper',
        extraction_warnings: gross ? [] : ['Kwota nie została rozpoznana — uzupełnij ręcznie.'],
        requires_user_confirmation: true,
      }),
    }
  } catch (err) {
    console.error('[voice-to-expense] GPT exception:', err)
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Parsing exception' }) }
  }
}
