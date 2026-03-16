// =============================================================================
// Netlify Function: client-identify
// LoftDesk — Phase 5: Canonical tokenless invite flow
// =============================================================================
// Flow:
//   1. Operator wypełnia email + projekt w ProjectPortalCTA
//   2. Frontend POST '/.netlify/functions/client-identify'
//      Authorization: Bearer <operator_jwt>
//      Body: { project_id, company_id, email, full_name? }
//   3. Tu:
//      a) Weryfikacja JWT operatora + przynależność do company_id
//      b) Weryfikacja, że projekt należy do company_id
//      c) Znajdź lub utwórz client_accounts (company_id, email)
//      d) Upsert project_client_access (project_id ↔ client_account_id)
//      e) Zapewnij auth_user_id (admin.generateLink do pobrania ID)
//      f) Wyślij magic link przez signInWithOtp
//   4. Klient dostaje email z magic linkiem → /auth/callback?mode=client&project_id=... → /client/project/:id
//
// BEZPIECZEŃSTWO:
//   - service_role TYLKO tutaj, nigdy w przeglądarce
//   - JWT operatora weryfikowany przed jakąkolwiek operacją
//   - Company membership weryfikowane (role: owner/admin/manager)
//   - Project ownership weryfikowane przed dostępem
//   - Email normalizowany do lowercase
//   - Idempotentny: wielokrotne wywołanie nie tworzy duplikatów
//   - Brak tokenów URL — dostęp wyłącznie przez magic link → auth session
// =============================================================================

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

// Public client (anon key) — used for signInWithOtp which actually sends the email.
// admin.generateLink() only generates a link without sending; signInWithOtp triggers Supabase mailer.
function sbPublic() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
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

  // ── Weryfikacja JWT operatora ─────────────────────────────────────────────
  const auth = event.headers['authorization'] ?? event.headers['Authorization']
  if (!auth?.startsWith('Bearer ')) {
    return json(401, { error: 'Brak autoryzacji — wymagany JWT operatora' })
  }
  const jwt = auth.slice(7)
  if (!jwt || jwt.length < 20) {
    return json(401, { error: 'Brak autoryzacji — pusty token' })
  }

  let operatorUserId: string
  try {
    const anonClient = sbPublic()
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
    if (authErr || !user) return json(401, { error: 'Nieautoryzowane żądanie' })
    operatorUserId = user.id
  } catch {
    return json(401, { error: 'Nieautoryzowane żądanie' })
  }

  // ── Parsuj body ──────────────────────────────────────────────────────────────
  let projectId: string
  let companyId: string
  let emailRaw: string
  let fullName: string | undefined

  try {
    const body = JSON.parse(event.body ?? '{}')
    projectId  = (body.project_id  ?? '').trim()
    companyId  = (body.company_id  ?? '').trim()
    emailRaw   = (body.email       ?? '').trim()
    fullName   = typeof body.full_name === 'string' ? body.full_name.trim() : undefined
  } catch {
    return json(400, { error: 'Nieprawidłowy format żądania' })
  }

  if (!projectId || !companyId || !emailRaw) {
    return json(400, { error: 'Wymagane pola: project_id, company_id, email' })
  }

  const email = emailRaw.toLowerCase()

  if (!EMAIL_RE.test(email)) {
    return json(400, { error: 'Nieprawidłowy adres email' })
  }

  if (isRateLimited(email)) {
    return json(429, { error: 'Za dużo żądań. Spróbuj ponownie za chwilę.' })
  }

  const sb = sbAdmin()

  // ── Weryfikacja: operator jest członkiem firmy (role: owner/admin/manager) ──
  const { data: member } = await sb
    .from('company_members')
    .select('role')
    .eq('user_id', operatorUserId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!member || !['owner', 'admin', 'manager'].includes(member.role as string)) {
    return json(403, { error: 'Brak uprawnień do zapraszania klientów dla tej firmy' })
  }

  // ── Weryfikacja: projekt należy do tej firmy ─────────────────────────────
  const { data: project } = await sb
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!project) {
    return json(404, { error: 'Projekt nie istnieje lub nie należy do tej firmy' })
  }

  // ── Utwórz lub znajdź client_account ────────────────────────────────────────
  const { data: account, error: accountError } = await sb
    .from('client_accounts')
    .upsert(
      {
        company_id: companyId,
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

  // ── Nadaj dostęp do projektu ─────────────────────────────────────────────────
  const { error: accessError } = await sb
    .from('project_client_access')
    .upsert(
      {
        project_id:        projectId,
        client_account_id: account.id,
        granted_at:        new Date().toISOString(),
      },
      { onConflict: 'project_id,client_account_id', ignoreDuplicates: true },
    )

  if (accessError) {
    console.error('[client-identify] project_client_access upsert error:', accessError)
    // Nie przerywamy — magic link wyślemy mimo to
  }

  // ── Wymuś połączenie auth_user_id przed wysyłką OTP ──────────────────────────
  // Kluczowy fix dla błędu: klient widzi LegalAcceptanceGate zamiast /client/dashboard.
  //
  // Root cause: client_accounts.auth_user_id może być NULL gdy:
  //   a) Poprzednie zaproszenia używały generateLink przed wdrożeniem triggera (migr. 042)
  //   b) Trigger AFTER INSERT ON auth.users nie odpalił się dla istniejących auth userów
  // Gdy auth_user_id IS NULL:
  //   - RLS policy "ca_client_select_own" evaluuje: NULL = auth.uid() = FALSE
  //   - Rekord jest niewidoczny dla klienta w przeglądarce
  //   - resolveSupabaseSession() odpada do bootstrap_my_company → role:'owner'
  //
  // Fix: admin.generateLink() creates-or-gets the auth user synchronously,
  // generates a fresh one-time magic link, and returns the URL.
  // Uses service_role key — no dependency on Supabase SMTP configuration.
  // The link is returned to the operator who sends it to the client however
  // they prefer (email, WhatsApp, etc.).
  // Pass project_id through the redirect so auth-callback can land the client
  // directly on the invited project instead of the generic dashboard.
  const redirectTo = `${getBaseUrl()}/auth/callback?mode=client&project_id=${encodeURIComponent(projectId)}`

  const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo,
      data: { client_account_id: account.id, company_id: companyId },
    },
  })

  if (linkError || !linkData?.user) {
    console.error('[client-identify] generateLink error:', linkError)
    return json(500, { error: 'Błąd generowania linku logowania. Spróbuj ponownie.' })
  }

  // Update auth_user_id if not yet linked
  if (!account.auth_user_id) {
    await sb
      .from('client_accounts')
      .update({ auth_user_id: linkData.user.id, updated_at: new Date().toISOString() })
      .eq('id', account.id)
  }

  const magicLink: string | null = (linkData as any)?.properties?.action_link ?? null

  // Sukces — zwracamy link do ręcznego przesłania klientowi
  return json(200, {
    ok: true,
    magic_link: magicLink,
    message: magicLink
      ? 'Link logowania wygenerowany — skopiuj i wyślij do klienta.'
      : 'Dostęp nadany.',
  })
}
