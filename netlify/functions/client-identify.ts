// =============================================================================
// Netlify Function: client-identify
// LoftDesk ÔÇö Phase 5: Canonical tokenless invite flow
// =============================================================================
// Flow:
//   1. Operator wype┼énia email + projekt w ProjectPortalCTA
//   2. Frontend POST '/.netlify/functions/client-identify'
//      Authorization: Bearer <operator_jwt>
//      Body: { project_id, company_id, email, full_name? }
//   3. Tu:
//      a) Weryfikacja JWT operatora + przynale┼╝no┼Ť─ç do company_id
//      b) Weryfikacja, ┼╝e projekt nale┼╝y do company_id
//      c) Znajd┼║ lub utw├│rz client_accounts (company_id, email)
//      d) Upsert project_client_access (project_id Ôćö client_account_id)
//      e) Zapewnij auth_user_id (admin.generateLink do pobrania ID)
//      f) Wy┼Ťlij magic link przez signInWithOtp
//   4. Klient dostaje email z magic linkiem Ôćĺ /auth/callback?mode=client&project_id=... Ôćĺ /client/project/:id
//
// BEZPIECZE┼âSTWO:
//   - service_role TYLKO tutaj, nigdy w przegl─ůdarce
//   - JWT operatora weryfikowany przed jak─ůkolwiek operacj─ů
//   - Company membership weryfikowane (role: owner/admin/manager)
//   - Project ownership weryfikowane przed dost─Öpem
//   - Email normalizowany do lowercase
//   - Idempotentny: wielokrotne wywo┼éanie nie tworzy duplikat├│w
//   - Brak token├│w URL ÔÇö dost─Öp wy┼é─ůcznie przez magic link Ôćĺ auth session
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import type { Handler, HandlerEvent } from '@netlify/functions'

// Resend ÔÇö transakcyjne emaile z nazw─ů wykonawcy jako nadawca
// Opcjonalne: je┼Ťli RESEND_API_KEY nie ustawiony, wysy┼éka jest pomijana
// i link jest zwracany do r─Öcznego przes┼éania (poprzednie zachowanie).
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

  const FROM_FALLBACK = 'noreply@mail.loftdesk.pl'
  const EMAIL_VAL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const envFrom   = process.env.RESEND_FROM_EMAIL ?? ''
  const fromEmail = EMAIL_VAL_RE.test(envFrom) ? envFrom : FROM_FALLBACK
  if (envFrom && !EMAIL_VAL_RE.test(envFrom)) {
    console.warn(`[client-identify] RESEND_FROM_EMAIL='${envFrom}' is not a valid email — using fallback '${FROM_FALLBACK}'`)
  }
  const fromLabel = opts.fromName ? `${opts.fromName} (przez LoftDesk)` : 'LoftDesk'
  const greeting  = opts.toName ? `Cze┼Ť─ç ${opts.toName.split(' ')[0]}` : 'Cze┼Ť─ç'

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
            <strong>${opts.fromName}</strong> zaprasza Ci─Ö do projektu:
          </p>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin-bottom:28px">
            <p style="margin:0;font-size:15px;font-weight:700;color:#15803d">­čôü ${opts.projectName}</p>
          </div>
          <p style="font-size:14px;color:#6b7280;margin:0 0 20px;line-height:1.6">
            Kliknij poni┼╝szy przycisk, aby zalogowa─ç si─Ö jednym klikni─Öciem i przej┼Ť─ç bezpo┼Ťrednio do swojego projektu.
            Link jest jednorazowy i wygasa po 24 godzinach.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">
            <tr><td style="background:#1a5c32;border-radius:12px;padding:14px 32px">
              <a href="${opts.magicLink}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none">Przejd┼║ do projektu Ôćĺ</a>
            </td></tr>
          </table>
          <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0;line-height:1.6">
            Je┼Ťli przycisk nie dzia┼éa, skopiuj i wklej ten adres w przegl─ůdarce:<br />
            <a href="${opts.magicLink}" style="color:#1a5c32;word-break:break-all;font-size:11px">${opts.magicLink}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            Zaproszenie wys┼éano przez <strong>${opts.fromName}</strong>.
            ${opts.replyTo ? `W razie pyta┼ä odpowiedz na ten email lub napisz na <a href="mailto:${opts.replyTo}" style="color:#1a5c32">${opts.replyTo}</a>.` : ''}
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
    // Non-fatal ÔÇö magic link is still returned to operator
  }
}

// ÔöÇÔöÇ Konfiguracja ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

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

// Public client (anon key) ÔÇö used for signInWithOtp which actually sends the email.
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

// ÔöÇÔöÇ Rate limiting (in-memory, per email, 5 req / 10 min) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

// ÔöÇÔöÇ Walidacja emaila ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ÔöÇÔöÇ Handler ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export const handler: Handler = async (event: HandlerEvent) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  // ÔöÇÔöÇ Weryfikacja JWT operatora ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const auth = event.headers['authorization'] ?? event.headers['Authorization']
  if (!auth?.startsWith('Bearer ')) {
    return json(401, { error: 'Brak autoryzacji ÔÇö wymagany JWT operatora' })
  }
  const jwt = auth.slice(7)
  if (!jwt || jwt.length < 20) {
    return json(401, { error: 'Brak autoryzacji ÔÇö pusty token' })
  }

  let operatorUserId: string
  try {
    const anonClient = sbPublic()
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
    if (authErr || !user) return json(401, { error: 'Nieautoryzowane ┼╝─ůdanie' })
    operatorUserId = user.id
  } catch {
    return json(401, { error: 'Nieautoryzowane ┼╝─ůdanie' })
  }

  // ÔöÇÔöÇ Parsuj body ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
    return json(400, { error: 'Nieprawid┼éowy format ┼╝─ůdania' })
  }

  if (!projectId || !companyId || !emailRaw) {
    return json(400, { error: 'Wymagane pola: project_id, company_id, email' })
  }

  const email = emailRaw.toLowerCase()

  if (!EMAIL_RE.test(email)) {
    return json(400, { error: 'Nieprawid┼éowy adres email' })
  }

  if (isRateLimited(email)) {
    return json(429, { error: 'Za du┼╝o ┼╝─ůda┼ä. Spr├│buj ponownie za chwil─Ö.' })
  }

  const sb = sbAdmin()

  // ÔöÇÔöÇ Weryfikacja: operator jest cz┼éonkiem firmy (role: owner/admin/manager) ÔöÇÔöÇ
  // Pobieramy te┼╝ email operatora i nazw─Ö firmy do u┼╝ycia jako Reply-To / From w emailu.
  const { data: member } = await sb
    .from('company_members')
    .select('role, profiles(email, full_name), companies(name)')
    .eq('user_id', operatorUserId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!member || !['owner', 'admin', 'manager'].includes(member.role as string)) {
    return json(403, { error: 'Brak uprawnie┼ä do zapraszania klient├│w dla tej firmy' })
  }

  const operatorEmail  = (member as any)?.profiles?.email  ?? null
  const companyName    = (member as any)?.companies?.name  ?? 'Wykonawca'

  // ÔöÇÔöÇ Weryfikacja: projekt nale┼╝y do tej firmy ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const { data: project } = await sb
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!project) {
    return json(404, { error: 'Projekt nie istnieje lub nie nale┼╝y do tej firmy' })
  }

  // ÔöÇÔöÇ Utw├│rz lub znajd┼║ client_account ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
    return json(500, { error: 'B┼é─ůd serwera. Spr├│buj ponownie.' })
  }

  // ÔöÇÔöÇ Nadaj dost─Öp do projektu ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
    // Nie przerywamy ÔÇö magic link wy┼Ťlemy mimo to
  }

  // ÔöÇÔöÇ Wymu┼Ť po┼é─ůczenie auth_user_id przed wysy┼ék─ů OTP ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  // Kluczowy fix dla b┼é─Ödu: klient widzi LegalAcceptanceGate zamiast /client/dashboard.
  //
  // Root cause: client_accounts.auth_user_id mo┼╝e by─ç NULL gdy:
  //   a) Poprzednie zaproszenia u┼╝ywa┼éy generateLink przed wdro┼╝eniem triggera (migr. 042)
  //   b) Trigger AFTER INSERT ON auth.users nie odpali┼é si─Ö dla istniej─ůcych auth user├│w
  // Gdy auth_user_id IS NULL:
  //   - RLS policy "ca_client_select_own" evaluuje: NULL = auth.uid() = FALSE
  //   - Rekord jest niewidoczny dla klienta w przegl─ůdarce
  //   - resolveSupabaseSession() odpada do bootstrap_my_company Ôćĺ role:'owner'
  //
  // Fix: admin.generateLink() creates-or-gets the auth user synchronously,
  // generates a fresh one-time magic link, and returns the URL.
  // Uses service_role key ÔÇö no dependency on Supabase SMTP configuration.
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
    return json(500, { error: 'B┼é─ůd generowania linku logowania. Spr├│buj ponownie.' })
  }

  // Update auth_user_id if not yet linked
  if (!account.auth_user_id) {
    await sb
      .from('client_accounts')
      .update({ auth_user_id: linkData.user.id, updated_at: new Date().toISOString() })
      .eq('id', account.id)
  }

  const magicLink: string | null = (linkData as any)?.properties?.action_link ?? null

  // ÔöÇÔöÇ Wy┼Ťlij email z linkiem ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  // U┼╝ywa Resend je┼Ťli RESEND_API_KEY jest ustawiony.
  // Klient widzi: From = "<Firma> (przez LoftDesk) <noreply@twoja-domena.pl>"
  //               Reply-To = <email operatora>
  // Je┼Ťli Resend nie jest skonfigurowany ÔÇö link wraca do frontendu do r─Öcznego wys┼éania.
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

  // Sukces ÔÇö zwracamy link do r─Öcznego przes┼éania (+ informacja czy email poszed┼é)
  return json(200, {
    ok: true,
    magic_link: magicLink,
    email_sent: emailSent,
    message: emailSent
      ? `Link logowania wys┼éany na ${email}.`
      : magicLink
        ? 'Link logowania wygenerowany ÔÇö skopiuj i wy┼Ťlij do klienta.'
        : 'Dost─Öp nadany.',
  })
}
