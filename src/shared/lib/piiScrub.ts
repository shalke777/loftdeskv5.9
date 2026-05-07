// =============================================================================
// piiScrub.ts — PII redaction for telemetry (Sentry) on web + server.
// =============================================================================
// Centralised scrubbers used by both `monitoring.ts` (browser) and
// `netlify/functions/shared/sentry.ts` (Node). The same rules MUST apply on
// both sides so that one regression cannot leak data via the unused channel.
//
// What we redact:
//   - Sensitive keys (case-insensitive, partial match): password, token,
//     access_token, refresh_token, session_token, api_key, ksef*token*,
//     authorization, cookie, secret, client_secret, stripe_*_secret, etc.
//   - JWT-shaped strings (3 base64url segments separated by `.`)
//   - E-mails (local part removed, only domain kept)
//   - PESEL (11 consecutive digits)
//   - NIP (10 consecutive digits)
//   - Polish phone numbers
//   - Polish invoice numbers (FV/...)
//   - Money amounts (only when event tag `loftdesk.area === 'billing'`)
//
// We also:
//   - Strip URL query params except `code`, `type`, `mode`
//   - Drop fetch breadcrumbs that hit document-bearing AI endpoints
//   - Truncate event.extra payloads to 5 KB
// =============================================================================

const SENSITIVE_KEYS = [
  'password',
  'pass',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'session_token',
  'sessiontoken',
  'sessionToken',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'secret',
  'client_secret',
  'private_key',
  'privatekey',
  'service_role',
  'service_role_key',
  'stripe_secret',
  'stripe_secret_key',
  'webhook_secret',
]

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase()
  if (SENSITIVE_KEYS.some((s) => k.includes(s))) return true
  // Catch ksef*token* patterns
  if (k.includes('ksef') && (k.includes('token') || k.includes('session'))) return true
  if (k.startsWith('stripe') && k.includes('secret')) return true
  return false
}

// JWT: three base64url segments separated by '.'
const JWT_RE = /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g
// Email — replaced with ***@<domain>
const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
// PESEL: exactly 11 digits, surrounded by non-digits
const PESEL_RE = /(?<!\d)(\d{11})(?!\d)/g
// NIP: exactly 10 digits (with optional dashes), surrounded by non-digits
const NIP_RE = /(?<!\d)(\d{10})(?!\d)/g
// Polish phone numbers: optional +48, then 9 digits with optional separators
const PHONE_RE = /(?<!\d)(?:\+?48[\s-]?)?(?:\d[\s-]?){9}(?!\d)/g
// Polish invoice numbers: FV/... or F/... patterns
const INVOICE_RE = /\b(?:FV|FAK|F)[\s/-]\d{1,6}[\s/-]?(?:\d{1,4}[\s/-]?){0,3}\d{4}\b/gi
// Money amount: digits + optional decimal + zł / PLN / EUR / USD
const MONEY_RE = /\b\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?\s*(?:zł|PLN|EUR|USD|€|\$)\b/gi

const MAX_EXTRA_BYTES = 5 * 1024

export interface ScrubContext {
  /** When 'billing' we additionally redact monetary amounts. */
  area?: string
}

/** Scrub a single primitive string. Order matters — JWT first, then PII. */
export function scrubPii(input: string, ctx: ScrubContext = {}): string {
  if (!input || typeof input !== 'string') return input
  let out = input

  // JWT — full opaque replacement
  out = out.replace(JWT_RE, 'JWT_REDACTED')

  // PESEL before NIP (PESEL has 11 digits which would otherwise trigger NIP false-positives)
  out = out.replace(PESEL_RE, 'PESEL_REDACTED')
  out = out.replace(NIP_RE, 'NIP_REDACTED')

  // Email — keep domain only
  out = out.replace(EMAIL_RE, (_m, _local, domain) => `***@${domain}`)

  // Phone numbers (after NIP — NIP rule was stricter)
  out = out.replace(PHONE_RE, 'PHONE_REDACTED')

  // Invoice numbers — only redact obvious FV-style sequences
  out = out.replace(INVOICE_RE, 'INVOICE_REDACTED')

  if (ctx.area === 'billing') {
    out = out.replace(MONEY_RE, 'AMOUNT_REDACTED')
  }
  return out
}

/** Sanitise a URL — keep host + path + only safe query params. */
export function scrubUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl
  try {
    const u = new URL(rawUrl, 'https://placeholder.local')
    const allowed = new Set(['code', 'type', 'mode'])
    const next = new URLSearchParams()
    u.searchParams.forEach((v, k) => {
      if (allowed.has(k.toLowerCase())) next.set(k, v)
    })
    u.search = next.toString() ? `?${next.toString()}` : ''
    u.hash = ''
    // Strip placeholder origin if input was relative
    if (rawUrl.startsWith('/')) return u.pathname + u.search
    return u.toString()
  } catch {
    return rawUrl
  }
}

/** AI endpoints whose breadcrumbs may carry document content. */
const SENSITIVE_ENDPOINT_RE = /\/(parse-invoice|voice-to-|analyze-|composite-extract|voice-extract|memory-add)/i

export function isSensitiveEndpoint(url: string): boolean {
  return SENSITIVE_ENDPOINT_RE.test(url)
}

/** Recursively scrub all string values in any value (object/array/scalar). */
export function scrubObject<T>(value: T, ctx: ScrubContext = {}, depth = 0): T {
  if (depth > 8) return value
  if (value == null) return value
  if (typeof value === 'string') {
    return scrubPii(value, ctx) as unknown as T
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).map((v) => scrubObject(v, ctx, depth + 1)) as unknown as T
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src)) {
      if (isSensitiveKey(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = scrubObject(v, ctx, depth + 1)
      }
    }
    return out as unknown as T
  }
  return value
}

/** Truncate object payloads (event.extra etc.) so we never POST > 5 KB of data. */
export function truncateExtra(extra: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!extra) return extra
  let json: string
  try {
    json = JSON.stringify(extra)
  } catch {
    return { _truncated: 'unserialisable' }
  }
  if (json.length <= MAX_EXTRA_BYTES) return extra
  // Truncate per-key
  const out: Record<string, unknown> = {}
  let used = 0
  for (const [k, v] of Object.entries(extra)) {
    let s: string
    try { s = JSON.stringify(v) } catch { s = '"<unserialisable>"' }
    if (used + s.length > MAX_EXTRA_BYTES) {
      out[k] = s.slice(0, Math.max(0, MAX_EXTRA_BYTES - used - 16)) + '…[TRUNCATED]'
      out._truncated = true
      break
    }
    out[k] = v
    used += s.length
  }
  return out
}
