// =============================================================================
// Netlify Function: portal-validate
// =============================================================================
// Przepływ:
//   1. Klient otwiera /portal/<rawToken>
//   2. Frontend wywołuje GET /.netlify/functions/portal-validate?token=<rawToken>
//   3. Tu hashujemy SHA-256(rawToken) i szukamy w project_portal_tokens
//   4. Jeśli token poprawny: tworzymy project_portal_sessions, zwracamy session_id
//   5. Frontend przechowuje session_id i używa go jako p_session_id w RPC calls
//
// BEZPIECZEŃSTWO:
//   - rawToken NIGDY nie jest logowany ani przechowywany
//   - rate limiting: TODO dodaj Netlify Edge Middleware lub upstash/ratelimit
//     (hook na tym pliku: przed przetworzeniem sprawdź IP w Redis bucket)
//   - użyliśmy service_role TYLKO do: walidacji tokenu + tworzenia sesji
//   - dane projektu pobierane przez service_role z minimalnym zakresem kolumn
//   - neutralne błędy: invalid/expired/revoked nie wyciekają informacji wzajemnie
//     (ale odróżniamy je dla UX — token hash jest nieprzegadywalny, to bezpieczne)

import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'crypto'
import type { Handler, HandlerEvent } from '@netlify/functions'

// Supabase service role — używany TYLKO w funkcjach Netlify (serwer)
// Nigdy nie trafia do przeglądarki
function sb() {
  // Netlify Dashboard może mieć SUPABASE_URL lub VITE_SUPABASE_URL — obsługujemy oba
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) }
}

const SESSION_TTL_HOURS = 4

// ── Rate limiting (in-memory, per IP, 30 req / 5 min) ──────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { status: 'error', error: 'method_not_allowed' })

  const rawToken = event.queryStringParameters?.token

  // Podstawowa walidacja wejścia — bez logowania wartości rawToken
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 8 || rawToken.length > 512) {
    return json(400, { status: 'invalid', error: 'bad_request' })
  }

  const clientIp = ((event.headers['x-forwarded-for'] ?? event.headers['x-nf-client-connection-ip'] ?? 'unknown') as string).split(',')[0].trim()
  if (isRateLimited(clientIp)) {
    return json(429, { status: 'error', error: 'too_many_requests' })
  }

  try {
    // ── Hash — NIGDY nie loguj rawToken ──────────────────────────────────────
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    const client = sb()

    const { data: tok, error: tokErr } = await client
      .from('project_portal_tokens')
      .select('id, company_id, project_id, scope, client_name, client_email, active, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (tokErr) {
      console.error('[portal-validate] db error:', tokErr.message)
      return json(500, { status: 'error' })
    }

    if (!tok) {
      // Token nie istnieje w nowym systemie → może być starym tokenem estimate
      return json(404, { status: 'not_found' })
    }

    // Kolejność sprawdzania: revoked > inactive > expired
    if (tok.revoked_at || !tok.active) {
      return json(200, { status: 'revoked' })
    }

    if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
      return json(200, { status: 'expired' })
    }

    // ── Utwórz sesję (krótkoterminową, 4h TTL) ───────────────────────────────
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString()

    const { data: session, error: sessionErr } = await client
      .from('project_portal_sessions')
      .insert({
        portal_token_id: tok.id,
        project_id:      tok.project_id,
        company_id:      tok.company_id,
        expires_at:      expiresAt,
      })
      .select('id')
      .single()

    if (sessionErr || !session) {
      console.error('[portal-validate] session create error:', sessionErr?.message)
      return json(500, { status: 'error' })
    }

    // ── Aktualizuj last_used_at (fire-and-forget) ────────────────────────────
    // Nie czekamy — nie blokuje odpowiedzi dla klienta
    client
      .from('project_portal_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tok.id)
      .then(() => {})

    // ── Minimalne dane projektu (bezpieczne do zwrócenia) ────────────────────
    const { data: project } = await client
      .from('projects')
      .select('id, number, name, status, start_date, end_date')
      .eq('id', tok.project_id)
      .is('deleted_at', null)
      .single()

    return json(200, {
      status:       'ok',
      session_id:   session.id,
      expires_at:   expiresAt,
      project_id:   tok.project_id,
      company_id:   tok.company_id,
      client_name:  tok.client_name  ?? null,
      client_email: tok.client_email ?? null,
      scope:        tok.scope        ?? [],
      project: project
        ? {
            id:         project.id,
            number:     project.number,
            name:       project.name,
            status:     project.status,
            start_date: project.start_date,
            end_date:   project.end_date,
          }
        : null,
    })
  } catch (e: unknown) {
    console.error('[portal-validate] unexpected error:', e instanceof Error ? e.message : String(e))
    return json(500, { status: 'error' })
  }
}
