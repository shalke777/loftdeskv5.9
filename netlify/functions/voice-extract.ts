// voice-extract.ts — Ekstrakcja ustaleń z transkryptu notatki głosowej
// POST { note_id: string } + Bearer auth
import type { Handler } from '@netlify/functions'
import { assertVoiceNoteAccess, isScopeError, scopeErrorResponse } from '../lib/scope/assertProjectAccess'

// Chunk transcript into segments of max CHUNK_SIZE chars for GPT context safety
const CHUNK_SIZE = 40_000
const MAX_CHUNKS = 4 // limit: ~160k chars max input total

function chunkTranscript(transcript: string): string[] {
  if (transcript.length <= CHUNK_SIZE) return [transcript]
  const chunks: string[] = []
  let offset = 0
  while (offset < transcript.length && chunks.length < MAX_CHUNKS) {
    chunks.push(transcript.slice(offset, offset + CHUNK_SIZE))
    offset += CHUNK_SIZE
  }
  return chunks
}

async function extractFromChunk(
  openaiKey: string,
  systemPrompt: string,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<Record<string, unknown>> {
  const chunkNote = totalChunks > 1 ? ` (fragment ${chunkIndex + 1} z ${totalChunks})` : ''
  const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transkrypt${chunkNote}:\n\n${chunk}` },
      ],
    }),
  })

  if (!gptRes.ok) {
    const errText = await gptRes.text()
    throw new Error(`GPT HTTP ${gptRes.status}: ${errText.slice(0, 200)}`)
  }

  const gptData = await gptRes.json() as { choices: Array<{ message: { content: string } }> }
  const raw = gptData.choices?.[0]?.message?.content ?? '{}'
  try { return JSON.parse(raw) } catch { return {} }
}

function mergeChunkResults(results: Record<string, unknown>[]) {
  const summaries: string[] = []
  const action_items: string[] = []
  const amounts: Array<{ description: string; amount: number; currency: string }> = []
  const decisions: string[] = []
  const estimateHints: string[] = []

  for (const r of results) {
    if (typeof r.summary === 'string' && r.summary) summaries.push(r.summary)
    if (Array.isArray(r.action_items)) action_items.push(...(r.action_items as string[]))
    if (Array.isArray(r.amounts)) amounts.push(...(r.amounts as typeof amounts))
    if (Array.isArray(r.decisions)) decisions.push(...(r.decisions as string[]))
    if (typeof r.estimate_hint === 'string' && r.estimate_hint) estimateHints.push(r.estimate_hint)
  }

  return {
    summary: summaries.join(' '),
    action_items: [...new Set(action_items)],
    amounts,
    decisions: [...new Set(decisions)],
    estimate_hint: estimateHints.join('; ') || null,
  }
}

async function verifyAuth(): Promise<string | null> {
  // Deprecated by Sprint P2-FIX — replaced by assertVoiceNoteAccess.
  // Kept as no-op stub to avoid accidental imports.
  return 'deprecated'
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'OpenAI not configured' }) }

  let body: { note_id?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }
  if (!body.note_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'note_id required' }) }

  // Sprint P2-FIX: scoped access — JWT + voice_notes ownership via project.company_id.
  const scope = await assertVoiceNoteAccess(event, body.note_id)
  if (isScopeError(scope)) return scopeErrorResponse(scope, cors)
  const { sb, note } = scope
  const noteId = note.id

  if (!note.transcript) return { statusCode: 422, headers: cors, body: JSON.stringify({ error: 'Empty transcript' }) }

  await sb.from('voice_notes').update({ status: 'processing' }).eq('id', noteId)

  const systemPrompt = `Jesteś asystentem firmy budowlano-wykończeniowej w Polsce.
Przeanalizuj transkrypt notatki głosowej i wyciągnij:
- summary: krótkie podsumowanie (2-3 zdania)
- action_items: lista rzeczy do zrobienia (tablica stringów)
- amounts: wykryte kwoty i o co chodzi (tablica obiektów {description, amount, currency})
- decisions: ustalenia i decyzje (tablica stringów)
- estimate_hint: tekst sugestii do wyceny jeśli były omawiane prace/ceny, np. "80m² glazury, 120m² malowania" lub null

Zwróć TYLKO JSON bez dodatkowego tekstu.`

  try {
    const chunks = chunkTranscript(note.transcript)
    const chunkResults = await Promise.all(
      chunks.map((chunk, i) => extractFromChunk(openaiKey, systemPrompt, chunk, i, chunks.length))
    )
    const result = mergeChunkResults(chunkResults)

    await sb.from('voice_notes').update({
      status: 'processed',
      extracted_result: result,
      updated_at: new Date().toISOString(),
    }).eq('id', noteId)

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (err) {
    await sb.from('voice_notes').update({ status: 'error' }).eq('id', noteId)
    const detail = err instanceof Error ? err.message : String(err)
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Extraction failed', detail }) }
  }
}
