// voice-extract.ts — Ekstrakcja ustaleń z transkryptu notatki głosowej
// POST { note_id: string } + Bearer auth
import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

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
  } catch { return null }
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' }

  const userId = await verifyAuth(event)
  if (!userId) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'OpenAI not configured' }) }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!serviceKey) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Service key not configured' }) }

  let body: { note_id?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  if (!body.note_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'note_id required' }) }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: note, error: fetchErr } = await sb
    .from('voice_notes')
    .select('id, transcript, status')
    .eq('id', body.note_id)
    .single()

  if (fetchErr || !note) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Note not found' }) }
  if (!note.transcript) return { statusCode: 422, headers: cors, body: JSON.stringify({ error: 'Empty transcript' }) }

  await sb.from('voice_notes').update({ status: 'processing' }).eq('id', body.note_id)

  const systemPrompt = `Jesteś asystentem firmy budowlano-wykończeniowej w Polsce.
Przeanalizuj transkrypt notatki głosowej i wyciągnij:
- summary: krótkie podsumowanie (2-3 zdania)
- action_items: lista rzeczy do zrobienia (tablica stringów)
- amounts: wykryte kwoty i o co chodzi (tablica obiektów {description, amount, currency})
- decisions: ustalenia i decyzje (tablica stringów)
- estimate_hint: tekst sugestii do wyceny jeśli były omawiane prace/ceny, np. "80m² glazury, 120m² malowania" lub null

Zwróć TYLKO JSON bez dodatkowego tekstu.`

  try {
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        max_tokens: 800,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transkrypt:\n\n${note.transcript}` },
        ],
      }),
    })

    if (!gptRes.ok) {
      await sb.from('voice_notes').update({ status: 'error' }).eq('id', body.note_id)
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'GPT failed' }) }
    }

    const gptData = await gptRes.json() as { choices: Array<{ message: { content: string } }> }
    const raw = gptData.choices?.[0]?.message?.content ?? '{}'
    let extracted: Record<string, unknown>
    try { extracted = JSON.parse(raw) } catch { extracted = {} }

    const result = {
      summary:      typeof extracted.summary === 'string' ? extracted.summary : '',
      action_items: Array.isArray(extracted.action_items) ? extracted.action_items as string[] : [],
      amounts:      Array.isArray(extracted.amounts) ? extracted.amounts : [],
      decisions:    Array.isArray(extracted.decisions) ? extracted.decisions as string[] : [],
      estimate_hint: typeof extracted.estimate_hint === 'string' ? extracted.estimate_hint : null,
    }

    await sb.from('voice_notes').update({
      status: 'processed',
      extracted_result: result,
      updated_at: new Date().toISOString(),
    }).eq('id', body.note_id)

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (err) {
    await sb.from('voice_notes').update({ status: 'error' }).eq('id', body.note_id)
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Exception', detail: String(err) }) }
  }
}
