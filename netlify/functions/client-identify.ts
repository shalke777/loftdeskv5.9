// =============================================================================
// Netlify Function: client-identify
// LoftDesk v6.0 — One App / Two Roles
// =============================================================================
// Flow:
//   1. Klient otwiera portal (/portal/:token), wykonuje akcję (wiadomość / akceptacja)
//   2. Widzi baner: "Chcesz dostęp do wszystkich projektów? Wpisz email"
//   3. Frontend POST '/.netlify/functions/client-identify'
//      Body: { token, email, full_name? }
//   4. Tu:
//      a) Waliduj token (project_portal_tokens.active = true)
//      b) Znajdź lub utwórz client_accounts (company_id, email)
//      c) Połącz token z client_account_id
//      d) Upsert project_client_access (project_id ↔ client_account_id)
//      e) Wyślij magic link przez supabase.auth.admin.generateLink
//   5. Klient dostaje email z magic linkiem → /auth/callback?mode=client
//
// BEZPIECZEŃSTWO:
//   - Używamy service_role TYLKO tutaj, nigdy w przeglądarce
//   - Nie wyciekamy danych firmy / wykonawcy w odpowiedzi
//   - Email normalizowany do lowercase
//   - Idempotentny: wielokrotne wywołanie nie tworzy duplikatów
// =============================================================================

import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { Handler, HandlerEvent } from '@netlify/functions'

// ── Konfiguracja ──────────────────────────────────────────────────────────────

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) }
}

function sbAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function getBaseUrl(): string {
  return process.env.URL ?? process.env.DEPLOY_URL ?? 'https://app.loftdesk.pl'
}

// ── Rate limiting (in-memory, per email, 5 req / 10 min) ─────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_MAX = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

function isRateLimited(email: string): boolean {
  const now = Date.now()
  const key = email.toLowerCase().trim()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX
}

// ── Walidacja emaila ──────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  // ── Parsuj body ──────────────────────────────────────────────────────────────
  let token: string
  let emailRaw: string
  let fullName: string | undefined

  try {
    const body = JSON.parse(event.body ?? '{}')
    token    = (body.token   ?? '').trim()
    emailRaw = (body.email   ?? '').trim()
    fullName = typeof body.full_name === 'string' ? body.full_name.trim() : undefined
  } catch {
    return json(400, { error: 'Nieprawidłowy format żądania' })
  }

  if (!token || !emailRaw) {
    return json(400, { error: 'Wymagane pola: token, email' })
  }

  const email = emailRaw.toLowerCase()

  if (!EMAIL_RE.test(email)) {
    return json(400, { error: 'Nieprawidłowy adres email' })
  }

  if (isRateLimited(email)) {
    return json(429, { error: 'Za dużo żądań. Spróbuj ponownie za chwilę.' })
  }

  const sb = sbAdmin()

  // ── SHA-256 hash tokenu — project_portal_tokens przechowuje token_hash, nie raw token ─────────
  const tokenHash = createHash('sha256').update(token).digest('hex')

  // ── Waliduj token portalu ────────────────────────────────────────────────────
  // Szukamy w project_portal_tokens (nowy system — migr. 034) najpierw (po token_hash)
  const { data: portalToken } = await sb
    .from('project_portal_tokens')
    .select('id, project_id, company_id, active, revoked_at')
    .eq('token_hash', tokenHash)
    .eq('active', true)
    .is('revoked_at', null)
    .maybeSingle()
    .then(async (res) => {
      if (res.data) return res
      // Fallback: stary system client_tokens (migr. 004) — token przechowywany jawnie
      return sb
        .from('client_tokens')
        .select('id, project_id, company_id, active')
        .eq('token', token)
        .eq('active', true)
        .maybeSingle()
    })

  if (!portalToken) {
    // Neutralny komunikat — nie wyciekamy informacji o istnieniu tokenu
    return json(400, { error: 'Nieprawidłowy lub nieaktywny link dostępu' })
  }

  const { company_id, project_id } = portalToken as { company_id: string; project_id: string | null }

  if (!company_id) {
    return json(400, { error: 'Nieprawidłowy token — brak firmy' })
  }

  // ── Utwórz lub znajdź client_account ────────────────────────────────────────
  const { data: account, error: accountError } = await sb
    .from('client_accounts')
    .upsert(
      {
        company_id,
        email,
        full_name: fullName ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,email', ignoreDuplicates: false },
    )
    .select('id, auth_user_id')
    .single()

  if (accountError || !account) {
    console.error('[client-identify] account upsert error:', accountError)
    return json(500, { error: 'Błąd serwera. Spróbuj ponownie.' })
  }

  // ── Połącz token z client_account_id ────────────────────────────────────────
  // Aktualizujemy w obu tabelach (obsługa obu systemów)
  await Promise.allSettled([
    sb.from('client_tokens').update({ client_account_id: account.id }).eq('token', token),
    sb.from('project_portal_tokens').update({ client_account_id: account.id }).eq('token_hash', tokenHash),
  ])

  // ── Nadaj dostęp do projektu ─────────────────────────────────────────────────
  if (project_id) {
    const { error: accessError } = await sb
      .from('project_client_access')
      .upsert(
        {
          project_id,
          client_account_id: account.id,
          granted_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,client_account_id', ignoreDuplicates: true },
      )

    if (accessError) {
      console.error('[client-identify] project_client_access upsert error:', accessError)
      // Nie przerywamy — magic link wyślemy mimo to, dostęp można naprawić później
    }
  }

  // ── Wyślij magic link ────────────────────────────────────────────────────────
  const redirectTo = `${getBaseUrl()}/auth/callback?mode=client`

  const { error: magicLinkError } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo,
      data: {
        client_account_id: account.id,
        company_id,
      },
    },
  })

  if (magicLinkError) {
    console.error('[client-identify] magic link error:', magicLinkError)
    return json(500, { error: 'Błąd wysyłki wiadomości. Spróbuj ponownie.' })
  }

  // Sukces — NIE zwracamy żadnych danych firmy / wykonawcy
  return json(200, { ok: true, message: 'Sprawdź skrzynkę email i kliknij link logowania.' })
}
