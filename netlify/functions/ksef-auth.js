// =============================================================================
// ksef-auth.js — shared JWT + plan-gate helper for KSeF Netlify functions
// =============================================================================
// Usage inside any KSeF handler:
//
//   const { requireKsefAccess } = require('./ksef-auth')
//   ...
//   const authResult = await requireKsefAccess(event)
//   if (authResult.error) {
//     return { statusCode: authResult.status, headers, body: JSON.stringify({
//       error: authResult.error, code: authResult.code
//     }) }
//   }
//
// Checks:
//   1. Authorization: Bearer <supabase_jwt> must be present and valid
//   2. The caller must belong to at least one company with plan in ('pro','business','admin')
//
// If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured (rare local dev),
// the check is skipped with a warning so that development is not hard-blocked.
// =============================================================================

const { createClient } = require('@supabase/supabase-js')

const PRO_PLANS = new Set(['pro', 'business', 'admin'])

// ─── Rate limiting (in-memory, per user, 10 req / 5 min) ─────────────────────
const rateLimitMap = new Map()
const RATE_MAX       = 10
const RATE_WINDOW_MS = 5 * 60 * 1000

function isRateLimited(userId) {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX
}

function sbAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Verify the request carries a valid Supabase JWT and the caller's company(s)
 * include at least one with plan >= 'pro'.
 *
 * Returns:
 *   { error: null }                         — access granted
 *   { error: string, status: number, code? } — access denied, return this to caller
 */
async function requireKsefAccess(event) {
  const sb = sbAdmin()

  // If Supabase is not configured (local netlify dev without env), skip and warn
  if (!sb) {
    console.warn('[ksef-auth] Supabase not configured — skipping plan check (dev only)')
    return { error: null }
  }

  // 1. Require Bearer token
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: 'Brak tokena autoryzacyjnego. Zaloguj się ponownie.',
      status: 401,
      code: 'unauthorized',
    }
  }
  const jwt = authHeader.slice(7)

  // 2. Validate JWT
  let userId
  try {
    const { data: { user }, error } = await sb.auth.getUser(jwt)
    if (error || !user) {
      return { error: 'Nieautoryzowane żądanie — nieprawidłowy lub wygasły token.', status: 401, code: 'unauthorized' }
    }
    userId = user.id
  } catch {
    return { error: 'Nieautoryzowane żądanie.', status: 401, code: 'unauthorized' }
  }

  // 3. Rate limit per user (abuse protection)
  if (isRateLimited(userId)) {
    return { error: 'Za dużo żądań. Spróbuj za chwilę.', status: 429, code: 'too_many_requests' }
  }

  // 4. Check that at least one of the user's companies has plan >= pro
  try {
    const { data: members, error: memberErr } = await sb
      .from('company_members')
      .select('companies(plan)')
      .eq('user_id', userId)

    if (memberErr) {
      console.error('[ksef-auth] company_members query error:', memberErr)
      return { error: 'Błąd weryfikacji uprawnień.', status: 500, code: 'server_error' }
    }

    const hasProAccess =
      Array.isArray(members) &&
      members.some((m) => PRO_PLANS.has(m?.companies?.plan ?? 'free'))

    if (!hasProAccess) {
      return {
        error: 'Integracja KSeF wymaga planu Pro lub Business.',
        status: 403,
        code: 'plan_required',
        requiredPlan: 'pro',
      }
    }
  } catch {
    return { error: 'Błąd weryfikacji planu.', status: 500, code: 'server_error' }
  }

  return { error: null }
}

module.exports = { requireKsefAccess }
