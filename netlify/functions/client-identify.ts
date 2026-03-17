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

// Resend — transakcyjne emaile z nazwą wykonawcy jako nadawca
// Opcjonalne: jeśli RESEND_API_KEY nie ustawiony, wysyłka jest pomijana
// i link jest zwracany do ręcznego przesłania (poprzednie zachowanie).
async function sendInviteEmail(opts: {
  to:          string
  toName:      string | null
  fromName:    string        // nazwa firmy wykonawcy
  replyTo:     string | null // email operatora (klient odpisze do niego)
  projectName: string
  magicLink:   string
  baseUrl:     string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@resend.dev'
  const fromLabel = opts.fromName ? `${opts.fromName} (przez LoftDesk)` : 'LoftDesk'
  const greeting  = opts.toName ? `Cześć ${opts.toName.split(' ')[0]}` : 'Cześć'

  const html = `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zaproszenie do projektu</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#1a5c32;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">LoftDesk</span><br />
          <span style="color:rgba(255,255,255,.75);font-size:13px">Portal klienta</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 8px">${greeting},</p>
          <p style="font-size:15px;color:#374151;line-height:1.65;margin:0 0 24px">
            <strong>${opts.fromName}</strong> zaprasza Cię do projektu:
          </p>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin-bottom:28px">
            <p style="margin:0;font-size:15px;font-weight:700;color:#15803d">📁 ${opts.projectName}</p>
          </div>
          <p style="font-size:14px;color:#6b7280;margin:0 0 20px;line-height:1.6">
            Kliknij poniższy przycisk, aby zalogować się jednym kliknięciem i przejść bezpośrednio do swojego projektu.
            Link jest jednorazowy i wygasa po 24 godzinach.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">
            <tr><td style="background:#1a5c32;border-radius:12px;padding:14px 32px">
              <a href="${opts.magicLink}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none">Przejdź do projektu →</a>
            </td></tr>
          </table>
          <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0;line-height:1.6">
            Jeśli przycisk nie działa, skopiuj i wklej ten adres w przeglądarce:<br />
            <a href="${opts.magicLink}" style="color:#1a5c32;word-break:break-all;font-size:11px">${opts.magicLink}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            Zaproszenie wysłano przez <strong>${opts.fromName}</strong>.
            ${opts.replyTo ? `W razie pytań odpowiedz na ten email lub napisz na <a href="mailto:${opts.replyTo}" style="color:#1a5c32">${opts.replyTo}</a>.` : ''}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const payload = {
    from:     `${fromLabel} <${fromEmail}>`,
    to:       [opts.to],
    reply_to: opts.replyTo ?? undefined,
    subject:  `Zaproszenie do projektu: ${opts.projectName}`,
    html,
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    console.error('[client-identify] Resend error:', resp.status, txt)
    // Non-fatal — magic link is still returned to operator
  }
}

// ── Konfiguracja ──────────────────────────────────────────────────────────────

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  // Pobieramy też email operatora i nazwę firmy do użycia jako Reply-To / From w emailu.
  const { data: member } = await sb
    .from('company_members')
    .select('role, profiles(email, full_name), companies(name)')
    .eq('user_id', operatorUserId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!member || !['owner', 'admin', 'manager'].includes(member.role as string)) {
    return json(403, { error: 'Brak uprawnień do zapraszania klientów dla tej firmy' })
  }

  const operatorEmail  = (member as any)?.profiles?.email  ?? null
  const companyName    = (member as any)?.companies?.name  ?? 'Wykonawca'

  // ── Weryfikacja: projekt należy do tej firmy ─────────────────────────────
  const { data: project } = await sb
    .from('projects')
    .select('id, name')
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

  // ── Wyślij email z linkiem ─────────────────────────────────────────────────
  // Używa Resend jeśli RESEND_API_KEY jest ustawiony.
  // Klient widzi: From = "<Firma> (przez LoftDesk) <noreply@twoja-domena.pl>"
  //               Reply-To = <email operatora>
  // Jeśli Resend nie jest skonfigurowany — link wraca do frontendu do ręcznego wysłania.
  let emailSent = false
  if (magicLink) {
    if (process.env.RESEND_API_KEY) {
      try {
        await sendInviteEmail({
          to:          email,
          toName:      fullName ?? null,
          fromName:    companyName,
          replyTo:     operatorEmail,
          projectName: (project as any)?.name ?? projectId,
          magicLink,
          baseUrl:     getBaseUrl(),
        })
        emailSent = true
      } catch (e) {
        console.error('[client-identify] sendInviteEmail threw:', e)
        // Non-fatal
      }
    } else {
      // Fallback: Supabase built-in mailer (requires Supabase SMTP configured in project settings)
      const { error: otpErr } = await sbPublic().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      })
      if (!otpErr) {
        emailSent = true
      } else {
        console.warn('[client-identify] signInWithOtp fallback failed:', otpErr.message)
      }
    }
  }

  // Sukces — zwracamy link do ręcznego przesłania (+ informacja czy email poszedł)
  return json(200, {
    ok: true,
    magic_link: magicLink,
    email_sent: emailSent,
    message: emailSent
      ? `Link logowania wysłany na ${email}.`
      : magicLink
        ? 'Link logowania wygenerowany — skopiuj i wyślij do klienta.'
        : 'Dostęp nadany.',
  })
}
