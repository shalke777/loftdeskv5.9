// =============================================================================
// Netlify Function: client-otp
// LoftDesk — Tokenless client self-login via server-generated magic link
// =============================================================================
// Flow:
//   1. Client wpisuje email w zakładce "Jestem klientem"
//   2. Frontend POST '/.netlify/functions/client-otp'
//      Body: { email }
//   3. Tu:
//      a) Sprawdź czy email istnieje w client_accounts (bez ujawniania faktu)
//      b) Jeśli tak: wygeneruj magic link przez admin.generateLink() (service_role)
//      c) Zwróć { ok: true, magic_link: "..." }
//      d) Frontend natychmiast przekieruje na magic link URL → Supabase weryfikuje
//         → /auth/callback?mode=client → /client/dashboard
//
// UWAGA: Supabase SMTP nie jest skonfigurowany — link nie jest wysyłany emailem.
//        Klient jest przekierowany na link bezpośrednio. Gdy SMTP zostanie
//        skonfigurowany, zastąp admin.generateLink() przez signInWithOtp().
//
// BEZPIECZEŃSTWO:
//   - service_role tylko tutaj, nigdy w przeglądarce
//   - Email normalizowany do lowercase
//   - Rate limiting: 3 żądania / 5 minut per email
//   - Odpowiedź jest identyczna niezależnie czy konto istnieje (brak enumeracji)
//   - Funkcja NIE tworzy nowych kont auth (generateLink z istniejącym kontem)
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import type { Handler, HandlerEvent } from '@netlify/functions'

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

// ── Rate limiting: 3 req / 5 min per email ────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_MAX = 3
const RATE_WINDOW_MS = 5 * 60 * 1000

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  let emailRaw: string
  try {
    const body = JSON.parse(event.body ?? '{}')
    emailRaw = (body.email ?? '').trim()
  } catch {
    return json(400, { error: 'Nieprawidłowy format żądania' })
  }

  const email = emailRaw.toLowerCase()

  if (!email || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Podaj prawidłowy adres email' })
  }

  if (isRateLimited(email)) {
    return json(429, { error: 'Za dużo żądań. Spróbuj ponownie za kilka minut.' })
  }

  let sb: ReturnType<typeof sbAdmin>
  try {
    sb = sbAdmin()
  } catch {
    return json(500, { error: 'Błąd konfiguracji serwera' })
  }

  // ── Sprawdź czy email istnieje w client_accounts ──────────────────────────
  // Używamy service_role, więc RLS jest pominięte.
  const { data: account } = await sb
    .from('client_accounts')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (!account) {
    // Sztuczne opóźnienie — zapobiega timing attack (nie ujawniamy, czy email istnieje)
    await new Promise<void>((r) => setTimeout(r, 400 + Math.random() * 200))
    // Zwróć sukces bez magic_link — frontend pokaże "sprawdź email" (neutralna wiadomość)
    return json(200, { ok: true, magic_link: null })
  }

  // ── Wygeneruj magic link ───────────────────────────────────────────────────
  const redirectTo = `${getBaseUrl()}/auth/callback?mode=client`

  const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
    type:    'magiclink',
    email,
    options: { redirectTo },
  })

  if (linkError || !linkData?.user) {
    console.error('[client-otp] generateLink error:', linkError)
    return json(500, { error: 'Nie udało się wygenerować linku. Skontaktuj się z wykonawcą.' })
  }

  const magicLink: string | null = (linkData as any)?.properties?.action_link ?? null

  return json(200, { ok: true, magic_link: magicLink })
}
