// =============================================================================
// Netlify Function: portal-token-create
// =============================================================================
// Tworzy nowy token dostępu do portalu klienta — WYŁĄCZNIE po stronie serwera.
//
// Bezpieczeństwo:
//   - raw token generowany przez crypto.randomBytes(32) — NIGDY nie trafia do DB
//   - DB przechowuje WYŁĄCZNIE token_hash = SHA-256(rawToken)
//   - raw token nigdy nie jest logowany
//   - raw token zwracany TYLKO RAZ w odpowiedzi do zalogowanego operatora
//   - JWT operatora weryfikowany przed jakąkolwiek operacją na danych
//
// Strategia tokenów: AUTO-REVOKE
//   Przed tworzeniem nowego tokenu: wszystkie dotychczasowe aktywne tokeny dla
//   tego projektu są automatycznie unieważniane. Efekt: zawsze maksymalnie
//   jeden aktywny token na projekt. Oznacza to, że wygenerowanie nowego linku
//   natychmiast unieważnia poprzedni.
//
// Request:
//   POST /.netlify/functions/portal-token-create
//   Authorization: Bearer <supabase_jwt>
//   Content-Type: application/json
//   Body: { company_id, project_id, scope?, client_name?, client_email?, expires_at? }
//
// Response:
//   200: { status: 'ok', raw_token, token_id, portal_url, expires_at, scope }
//   4xx/5xx: { error: string }

import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import type { Handler, HandlerEvent } from '@netlify/functions'

// ── Konfiguracja ──────────────────────────────────────────────────────────────

// Token ważny domyślnie 90 dni
const DEFAULT_TTL_DAYS = 90

const DEFAULT_SCOPE = [
  'read_updates',
  'read_messages',
  'send_messages',
  'read_documents',
  'read_approvals',
  'respond_approvals',
]

// ── Supabase ──────────────────────────────────────────────────────────────────

/** Service role — tylko w Netlify functions, nigdy w przeglądarce */
function sbAdmin() {
  // Netlify Dashboard może mieć SUPABASE_URL lub VITE_SUPABASE_URL — obsługujemy oba
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Anon client — wyłącznie do weryfikacji JWT operatora */
function sbAnon() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!url || !anonKey) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  return createClient(url, anonKey, { auth: { persistSession: false } })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' })

  // ── 1. Weryfikacja JWT operatora ──────────────────────────────────────────
  const auth = event.headers['authorization'] ?? event.headers['Authorization']
  if (!auth?.startsWith('Bearer ')) return json(401, { error: 'unauthorized', detail: 'missing_bearer' })

  const jwt = auth.slice(7)
  if (!jwt || jwt.length < 20) return json(401, { error: 'unauthorized', detail: 'empty_token' })

  let userId: string
  let anonClient: ReturnType<typeof sbAnon>
  try {
    anonClient = sbAnon()
  } catch (e: unknown) {
    // Brakuje zmiennych środowiskowych — to błąd konfiguracji serwera, nie auth
    console.error('[portal-token-create] missing env vars:', e instanceof Error ? e.message : e)
    return json(500, { error: 'server_misconfiguration' })
  }

  try {
    const { data: userResp, error: userErr } = await anonClient.auth.getUser(jwt)
    if (userErr) {
      console.warn('[portal-token-create] auth.getUser error:', userErr.message)
      return json(401, { error: 'unauthorized', detail: userErr.message })
    }
    if (!userResp.user) return json(401, { error: 'unauthorized', detail: 'no_user' })
    userId = userResp.user.id
  } catch (e: unknown) {
    console.error('[portal-token-create] auth.getUser threw:', e instanceof Error ? e.message : e)
    return json(401, { error: 'unauthorized', detail: 'auth_error' })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  const { company_id, project_id, scope, client_name, client_email, expires_at } = body

  if (!company_id || typeof company_id !== 'string') return json(400, { error: 'missing_company_id' })
  if (!project_id || typeof project_id !== 'string') return json(400, { error: 'missing_project_id' })

  const admin = sbAdmin()

  // ── 3. Weryfikacja: operator jest członkiem firmy (wymagana rola) ─────────
  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', company_id)
    .maybeSingle()

  if (!member || !['owner', 'admin', 'manager'].includes(member.role as string)) {
    return json(403, { error: 'forbidden' })
  }

  // ── 4. Weryfikacja: projekt należy do tej firmy ───────────────────────────
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .eq('company_id', company_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!project) return json(404, { error: 'project_not_found' })

  // ── 5. Auto-revoke poprzednich aktywnych tokenów (strategia: jeden token per projekt) ──
  // Każde wywołanie tej funkcji unieważnia poprzedni aktywny token.
  // Operator musi skopiować link natychmiast — nie będzie widoczny ponownie.
  await admin
    .from('project_portal_tokens')
    .update({ revoked_at: new Date().toISOString(), active: false })
    .eq('project_id', project_id)
    .eq('company_id', company_id)
    .eq('active', true)
    .is('revoked_at', null)

  // ── 6. Generowanie raw token — TYLKO na serwerze ──────────────────────────
  // crypto.randomBytes jest kryptograficznie bezpieczny (Node.js).
  // rawToken NIGDY nie jest logowany ani zapisywany w DB.
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  // ── 7. Ustalenie scope i czasu wygaśnięcia ────────────────────────────────
  const resolvedScope =
    Array.isArray(scope) && scope.length > 0 ? (scope as string[]) : DEFAULT_SCOPE

  const resolvedExpiresAt =
    expires_at && typeof expires_at === 'string' && expires_at.length > 0
      ? expires_at
      : new Date(Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // ── 8. Zapis do bazy — wyłącznie token_hash ───────────────────────────────
  const { data: newToken, error: insertErr } = await admin
    .from('project_portal_tokens')
    .insert({
      company_id,
      project_id,
      token_hash:   tokenHash,   // SHA-256(rawToken) — nigdy nie raw
      scope:        resolvedScope,
      client_name:  typeof client_name === 'string'  ? client_name  : null,
      client_email: typeof client_email === 'string' ? client_email : null,
      expires_at:   resolvedExpiresAt,
      created_by:   userId,
      active:       true,
    })
    .select('id, expires_at, scope')
    .single()

  if (insertErr || !newToken) {
    console.error('[portal-token-create] insert error:', insertErr?.message)
    return json(500, { error: 'server_error' })
  }

  // ── 9. Zbuduj URL portalu ─────────────────────────────────────────────────
  // SITE_URL / URL — zmienne środowiskowe Netlify
  const baseUrl = (process.env.SITE_URL ?? process.env.URL ?? '').replace(/\/$/, '')
  const portalUrl = `${baseUrl}/portal/${rawToken}`

  // fire-and-forget portal_activated timeline event
  Promise.resolve(admin.rpc('create_timeline_event', {
    p_company_id:     company_id as string,
    p_project_id:     project_id as string,
    p_event_type:     'portal_activated',
    p_visibility:     'internal',
    p_title:          typeof client_name === 'string' && client_name
      ? `Portal klienta aktywowany dla ${client_name}`
      : 'Portal klienta aktywowany',
    p_description:    null,
    p_actor_type:     'operator',
    p_actor_id:       userId,
    p_actor_name:     null,
    p_reference_id:   newToken.id,
    p_reference_type: 'portal_token',
    p_payload:        { client_name, client_email },
  })).catch(() => {})

  // rawToken zwracany TYLKO RAZ — operator musi go skopiować natychmiast
  return json(200, {
    status:     'ok',
    raw_token:  rawToken,
    token_id:   newToken.id,
    portal_url: portalUrl,
    expires_at: newToken.expires_at,
    scope:      newToken.scope,
  })
}
