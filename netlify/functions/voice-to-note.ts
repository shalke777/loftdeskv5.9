// =============================================================================
// voice-to-note.ts — Voice recording → plain transcript (no GPT step)
// =============================================================================
// Przeznaczenie: długie nagrania rozmów z klientem (np. 1h).
// Tylko transkrypcja Whisper — bez ekstrakcji danych przez GPT.
// Transkrypt ląduje bezpośrednio w notatki projektu.
//
// Request:
//   POST /.netlify/functions/voice-to-note
//   Authorization: Bearer <supabase_jwt>
//   Content-Type: application/json
//   Body: { audio_base64: string, audio_type: string }
//
// Response 200:
//   { transcript: string, duration_hint: number | null, parser_source: 'voice_whisper' }
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

  // ── Whisper transcription ──────────────────────────────────────────────────

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
    formData.append('prompt', 'rozmowa z klientem, ustalenia, projekt budowlany, wycena, prace, materiały, termin, kosztorys')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      console.error('[voice-to-note] Whisper error:', err)
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Transcription failed', detail: err }) }
    }

    const whisperData = await whisperRes.json() as { text?: string; duration?: number }
    const transcript  = (whisperData.text ?? '').trim()
    if (!transcript) return { statusCode: 422, headers: corsHeaders, body: JSON.stringify({ error: 'Empty transcript' }) }

    const duration_hint = typeof whisperData.duration === 'number' ? Math.round(whisperData.duration) : null

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        duration_hint,
        parser_source: 'voice_whisper',
      }),
    }
  } catch (err) {
    console.error('[voice-to-note] exception:', err)
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Transcription exception' }) }
  }
}
