// =============================================================================
// voice-to-expense.ts — Voice note → structured expense data (ARRAY)
// =============================================================================
// 1. Receives audio blob (base64) from the browser
// 2. Sends to Whisper API for transcription (Polish language, construction hints)
// 3. Sends transcript to GPT-4o-mini for expense data extraction — returns ARRAY
// 4. Returns { expenses: [...], transcript, parser_source, extraction_confidence }
//
// Request:
//   POST /.netlify/functions/voice-to-expense
//   Authorization: Bearer <supabase_jwt>
//   Content-Type: application/json
//   Body: { audio_base64: string, audio_type: string }
//
// Response 200:
//   { expenses: VoiceExpense[], transcript, parser_source: 'voice_whisper',
//     extraction_confidence: number }
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

  // ── Step 2: GPT-4o-mini — ekstrakcja TABLICY wydatków ──────────────────────

  const systemPrompt = `Jesteś asystentem firmy budowlano-wykończeniowej w Polsce.
Z nagrania głosowego wyciągnij WSZYSTKIE wspomniane wydatki.
Operator może wymienić wiele zakupów w jednym nagraniu.
Zwróć TYLKO JSON bez dodatkowego tekstu:
{
  "expenses": [
    {
      "vendor_name": "nazwa dostawcy lub null",
      "gross_amount": liczba lub null,
      "net_amount": liczba lub null,
      "currency": "PLN",
      "description": "krótki opis po polsku",
      "cost_type": "material|service|labor|transport|equipment|other"
    }
  ]
}
Jeśli cena nie wspomniana — wstaw null.
Jeśli jeden wydatek — tablica z jednym elementem.`

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
        max_tokens: 600,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transkrypcja: "${transcript}"` },
        ],
      }),
    })

    if (!gptRes.ok) {
      console.error('[voice-to-expense] GPT error:', await gptRes.text())
      // Return empty expenses with transcript on GPT failure
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses: [],
          transcript,
          parser_source: 'voice_whisper',
          extraction_confidence: 20,
          extraction_warnings: ['Nie udało się przetworzyć transkrypcji — uzupełnij dane ręcznie.'],
        }),
      }
    }

    const gptData = await gptRes.json() as { choices: Array<{ message: { content: string } }> }
    const raw = gptData.choices?.[0]?.message?.content ?? '{}'

    let parsed: { expenses?: unknown[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { expenses: [] }
    }

    const rawExpenses = Array.isArray(parsed.expenses) ? parsed.expenses : []

    interface VoiceExpense {
      vendor_name: string | null
      gross_amount: number | null
      net_amount: number | null
      currency: string
      description: string
      cost_type: string
    }

    const expenses: VoiceExpense[] = rawExpenses.map((e: unknown) => {
      const item = e as Record<string, unknown>
      return {
        vendor_name:  typeof item.vendor_name  === 'string'  ? item.vendor_name  : null,
        gross_amount: typeof item.gross_amount === 'number'  ? item.gross_amount : null,
        net_amount:   typeof item.net_amount   === 'number'  ? item.net_amount   : null,
        currency:     typeof item.currency     === 'string'  ? item.currency     : 'PLN',
        description:  typeof item.description  === 'string'  ? item.description  : transcript,
        cost_type:    typeof item.cost_type    === 'string'  ? item.cost_type    : 'other',
      }
    })

    // extraction_confidence: 70 if ≥1 expense has gross_amount, 40 if no prices, 20 if no expenses
    const hasAnyPrice = expenses.some(e => e.gross_amount != null)
    const extractionConfidence = expenses.length === 0 ? 20 : hasAnyPrice ? 70 : 40

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenses,
        transcript,
        parser_source: 'voice_whisper',
        extraction_confidence: extractionConfidence,
      }),
    }
  } catch (err) {
    console.error('[voice-to-expense] GPT exception:', err)
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Parsing exception' }) }
  }
}
