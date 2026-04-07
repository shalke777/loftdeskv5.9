// memory-add.ts — Manual memory entry insertion
// POST { project_id, memory_type, topic, content, source_type?, source_id? } + Bearer auth
import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

async function getCompanyId(event: HandlerEvent, url: string, anonKey: string): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(authHeader.slice(7))
    if (!user) return null
    const sbService = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
    const { data: member } = await sbService
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    if (!member) return null
    return { userId: user.id, companyId: member.company_id }
  } catch { return null }
}

const VALID_TYPES = ['decision', 'preference', 'event', 'issue', 'amount']

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

  const auth = await getCompanyId(event, supabaseUrl, anonKey)
  if (!auth) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) }

  let body: { project_id?: string; memory_type?: string; topic?: string; content?: string; source_type?: string; source_id?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  if (!body.project_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'project_id required' }) }
  if (!body.memory_type || !VALID_TYPES.includes(body.memory_type))
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `memory_type must be one of: ${VALID_TYPES.join(', ')}` }) }
  if (!body.content?.trim()) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'content required' }) }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await sb
    .from('project_memory_entries')
    .insert({
      company_id:  auth.companyId,
      project_id:  body.project_id,
      memory_type: body.memory_type,
      topic:       body.topic?.trim() ?? '',
      content:     body.content.trim(),
      source_type: body.source_type ?? 'manual',
      source_id:   body.source_id ?? null,
    })
    .select()
    .single()

  if (error) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: error.message }) }

  return {
    statusCode: 201,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}
