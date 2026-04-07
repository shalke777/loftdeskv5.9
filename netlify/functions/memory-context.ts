// memory-context.ts — Build L1+L2 project context for AI assistant
// POST { project_id: string } + Bearer auth
// Returns { summary: string, recent: MemEntry[], fresh: boolean }
import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

async function getUserId(event: HandlerEvent, url: string, anonKey: string): Promise<string | null> {
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(url, anonKey, { auth: { persistSession: false } })
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

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const anonKey    = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const openaiKey  = process.env.OPENAI_API_KEY ?? ''

  const userId = await getUserId(event, supabaseUrl, anonKey)
  if (!userId) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) }

  let body: { project_id?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }
  if (!body.project_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'project_id required' }) }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Fetch project L1 summary
  const { data: project } = await sb
    .from('projects')
    .select('id, name, ai_context_summary, ai_context_updated_at, company_id')
    .eq('id', body.project_id)
    .single()

  if (!project) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Project not found' }) }

  // Fetch L2: last 10 memory entries
  const { data: entries } = await sb
    .from('project_memory_entries')
    .select('id, memory_type, topic, content, source_type, created_at')
    .eq('project_id', body.project_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const recent = entries ?? []

  // Check if L1 summary needs refresh (null or older than 24h)
  const needsRefresh = !project.ai_context_summary
    || !project.ai_context_updated_at
    || (Date.now() - new Date(project.ai_context_updated_at).getTime()) > 24 * 60 * 60 * 1000

  let summary = project.ai_context_summary ?? ''
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
              content: `Projekt: ${project.name}\n\nWpisy pamięci:\n${entriesText}`,
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
          }).eq('id', body.project_id)
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
