// memory-context.ts — Build L1+L2 project context for AI assistant
// POST { project_id: string } + Bearer auth
// Returns { summary: string, recent: MemEntry[], fresh: boolean }
import type { Handler } from '@netlify/functions'
import { assertProjectAccess, isScopeError, scopeErrorResponse } from '../lib/scope/assertProjectAccess'

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' }

  const openaiKey  = process.env.OPENAI_API_KEY ?? ''

  let body: { project_id?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }
  if (!body.project_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'project_id required' }) }

  // Sprint P2-FIX: scoped access — JWT + membership + project ownership.
  const scope = await assertProjectAccess(event, body.project_id)
  if (isScopeError(scope)) return scopeErrorResponse(scope, cors)
  const { sb, project } = scope
  const projectId = project.id as string

  // Fetch L2: last 10 memory entries
  const { data: entries } = await sb
    .from('project_memory_entries')
    .select('id, memory_type, topic, content, source_type, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10)

  const recent = entries ?? []

  // Check if L1 summary needs refresh (null or older than 24h)
  const ctxSummary = (project as { ai_context_summary?: string | null }).ai_context_summary ?? ''
  const ctxUpdated = (project as { ai_context_updated_at?: string | null }).ai_context_updated_at ?? null
  const projectName = (project as { name?: string }).name ?? ''
  const needsRefresh = !ctxSummary
    || !ctxUpdated
    || (Date.now() - new Date(ctxUpdated).getTime()) > 24 * 60 * 60 * 1000

  let summary = ctxSummary
  let fresh = false

  if (needsRefresh && openaiKey && recent.length > 0) {
    try {
      const entriesText = recent.map(e =>
        `[${e.memory_type.toUpperCase()}] ${e.topic}: ${e.content}`
      ).join('\n')

      const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 300,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: 'Jesteś asystentem firmy budowlano-wykończeniowej. Napisz zwięzłe podsumowanie kontekstu projektu na podstawie wpisów pamięci (max 3 zdania, po polsku).',
            },
            {
              role: 'user',
              content: `Projekt: ${projectName}\n\nWpisy pamięci:\n${entriesText}`,
            },
          ],
        }),
      })

      if (gptRes.ok) {
        const gptData = await gptRes.json() as { choices: Array<{ message: { content: string } }> }
        summary = gptData.choices?.[0]?.message?.content?.trim() ?? ''
        if (summary) {
          await sb.from('projects').update({
            ai_context_summary: summary,
            ai_context_updated_at: new Date().toISOString(),
          }).eq('id', projectId)
          fresh = true
        }
      }
    } catch { /* keep existing summary */ }
  }

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary, recent, fresh }),
  }
}
