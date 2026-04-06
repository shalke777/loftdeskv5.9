// =============================================================================
// voice-to-estimate.ts — Voice note → structured estimate items (draft)
// =============================================================================
// 1. Receives audio blob (base64) from the browser
// 2. Sends to Whisper API for transcription (Polish language, construction hints)
// 3. Sends transcript to GPT-4o-mini for estimate item extraction
// 4. Returns { title, items[], extraction_confidence, transcript, parser_source }
//
// Request:
//   POST /.netlify/functions/voice-to-estimate
//   Authorization: Bearer <supabase_jwt>
//   Content-Type: application/json
//   Body: { audio_base64: string, audio_type: string }
//
// Response 200:
//   { title, items[], extraction_confidence, transcript,
//     parser_source: 'voice_whisper', extraction_warnings[] }
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
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' }

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
    formData.append('prompt', 'glazura, malowanie, łazienka, m², robocizna, materiał, netto, VAT, wycena, kosztorys, wykończenie, remont')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      console.error('[voice-to-estimate] Whisper error:', err)
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Transcription failed', detail: err }) }
    }

    const whisperData = await whisperRes.json() as { text?: string }
    transcript = (whisperData.text ?? '').trim()
    if (!transcript) return { statusCode: 422, headers: corsHeaders, body: JSON.stringify({ error: 'Empty transcript' }) }
  } catch (err) {
    console.error('[voice-to-estimate] Whisper exception:', err)
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Transcription exception' }) }
  }

  // ── Step 2: GPT-4o-mini estimate extraction ────────────────────────────────

  const systemPrompt = `Jesteś asystentem wyceny dla polskiej firmy budowlano-wykończeniowej.
Wyciągnij pozycje kosztorysowe z transkrypcji i zwróć JSON:
{
  "title": "krótki tytuł wyceny",
  "items": [
    {
      "description": "opis pracy/materiału",
      "quantity": liczba,
      "unit": "m²|mb|szt|h|kpl|ryczałt",
      "unit_price": liczba_netto,
      "vat_rate": 8|23
    }
  ]
}
Typowe jednostki: glazura=m², malowanie=m², instalacja=kpl, robocizna=h, okno=szt.
Typowe VAT: usługi budowlane=8%, materiały=23%.
Jeśli cena nie podana, wstaw 0 i użytkownik uzupełni.`

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
        max_tokens: 700,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transkrypcja: "${transcript}"` },
        ],
      }),
    })

    if (!gptRes.ok) {
      console.error('[voice-to-estimate] GPT error:', await gptRes.text())
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title: 'Wycena głosowa',
          items: [],
          extraction_confidence: 20,
          parser_source: 'voice_whisper',
          extraction_warnings: ['Nie udało się przetworzyć transkrypcji — uzupełnij pozycje ręcznie.'],
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

    const items = Array.isArray(parsed.items) ? parsed.items : []
    const hasAnyPrice = (items as Array<Record<string, unknown>>).some(
      (it) => typeof it.unit_price === 'number' && (it.unit_price as number) > 0,
    )
    const confidence = items.length > 0 ? (hasAnyPrice ? 70 : 45) : 20

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        title: typeof parsed.title === 'string' ? parsed.title : 'Wycena głosowa',
        items,
        extraction_confidence: confidence,
        parser_source: 'voice_whisper',
        extraction_warnings: hasAnyPrice
          ? []
          : ['Ceny jednostkowe nie zostały rozpoznane — uzupełnij ręcznie.'],
      }),
    }
  } catch (err) {
    console.error('[voice-to-estimate] GPT exception:', err)
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Parsing exception' }) }
  }
}
