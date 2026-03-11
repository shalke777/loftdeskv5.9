// =============================================================================
// Netlify Function: portal-revoke
// =============================================================================
// Używana przez operatora do unieważnienia tokenu.
// Wymaga auth JWT (authenticated user = pracownik firmy).
//
// Body: { "token_id": "<uuid>" }
// Auth: Bearer <supabase_jwt> w nagłówku Authorization

import { createClient } from '@supabase/supabase-js'
import type { Handler, HandlerEvent } from '@netlify/functions'

function sb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) }
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' })

  // ── Weryfikacja JWT operatora ─────────────────────────────────────────────
  const auth = event.headers['authorization'] ?? event.headers['Authorization']
  if (!auth?.startsWith('Bearer ')) return json(401, { error: 'unauthorized' })

  const jwt = auth.slice(7)

  const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false } },
  )

  const { data: userResp, error: userErr } = await anonClient.auth.getUser(jwt)
  if (userErr || !userResp.user) return json(401, { error: 'unauthorized' })

  let body: Record<string, unknown> = {}
  try { body = JSON.parse(event.body ?? '{}') } catch { return json(400, { error: 'invalid_json' }) }

  const tokenId = body.token_id
  if (!tokenId || typeof tokenId !== 'string') return json(400, { error: 'missing_token_id' })

  const client = sb()

  // Sprawdź czy token należy do tej samej firmy co operator
  const { data: tok, error: tokErr } = await client
    .from('project_portal_tokens')
    .select('id, company_id')
    .eq('id', tokenId)
    .maybeSingle()

  if (tokErr || !tok) return json(404, { error: 'not_found' })

  // Sprawdź przynależność użytkownika do tej firmy
  const { data: member } = await client
    .from('company_members')
    .select('role')
    .eq('user_id', userResp.user.id)
    .eq('company_id', tok.company_id)
    .maybeSingle()

  if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
    return json(403, { error: 'forbidden' })
  }

  const { error: revokeErr } = await client
    .from('project_portal_tokens')
    .update({ revoked_at: new Date().toISOString(), active: false })
    .eq('id', tokenId)

  if (revokeErr) {
    console.error('[portal-revoke] error:', revokeErr.message)
    return json(500, { error: 'server_error' })
  }

  return json(200, { status: 'ok' })
}
