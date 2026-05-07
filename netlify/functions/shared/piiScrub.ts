// =============================================================================
// netlify/functions/shared/piiScrub.ts
// Server-side PII scrubber. Mirror of src/shared/lib/piiScrub.ts.
// Kept in sync manually — Netlify functions are bundled separately and cannot
// reach into the Vite src/ tree. If you change one, change the other.
// =============================================================================

const SENSITIVE_KEYS = [
  'password', 'pass', 'pwd',
  'token', 'access_token', 'refresh_token', 'session_token', 'sessiontoken',
  'api_key', 'apikey',
  'authorization', 'cookie',
  'secret', 'client_secret', 'private_key', 'privatekey',
  'service_role', 'service_role_key',
  'stripe_secret', 'stripe_secret_key', 'webhook_secret',
]

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase()
  if (SENSITIVE_KEYS.some((s) => k.includes(s))) return true
  if (k.includes('ksef') && (k.includes('token') || k.includes('session'))) return true
  if (k.startsWith('stripe') && k.includes('secret')) return true
  return false
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g
const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
const PESEL_RE = /(?<!\d)(\d{11})(?!\d)/g
const NIP_RE = /(?<!\d)(\d{10})(?!\d)/g
const PHONE_RE = /(?<!\d)(?:\+?48[\s-]?)?(?:\d[\s-]?){9}(?!\d)/g
const INVOICE_RE = /\b(?:FV|FAK|F)[\s/-]\d{1,6}[\s/-]?(?:\d{1,4}[\s/-]?){0,3}\d{4}\b/gi
const MONEY_RE = /\b\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?\s*(?:zł|PLN|EUR|USD|€|\$)\b/gi

const MAX_EXTRA_BYTES = 5 * 1024

export interface ScrubContext { area?: string }

export function scrubPii(input: string, ctx: ScrubContext = {}): string {
  if (!input || typeof input !== 'string') return input
  let out = input
  out = out.replace(JWT_RE, 'JWT_REDACTED')
  out = out.replace(PESEL_RE, 'PESEL_REDACTED')
  out = out.replace(NIP_RE, 'NIP_REDACTED')
  out = out.replace(EMAIL_RE, (_m, _local, domain) => `***@${domain}`)
  out = out.replace(PHONE_RE, 'PHONE_REDACTED')
  out = out.replace(INVOICE_RE, 'INVOICE_REDACTED')
  if (ctx.area === 'billing') out = out.replace(MONEY_RE, 'AMOUNT_REDACTED')
  return out
}

export function scrubUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl
  try {
    const u = new URL(rawUrl, 'https://placeholder.local')
    const allowed = new Set(['code', 'type', 'mode'])
    const next = new URLSearchParams()
    u.searchParams.forEach((v, k) => { if (allowed.has(k.toLowerCase())) next.set(k, v) })
    u.search = next.toString() ? `?${next.toString()}` : ''
    u.hash = ''
    if (rawUrl.startsWith('/')) return u.pathname + u.search
    return u.toString()
  } catch {
    return rawUrl
  }
}

const SENSITIVE_ENDPOINT_RE = /\/(parse-invoice|voice-to-|analyze-|composite-extract|voice-extract|memory-add)/i
export function isSensitiveEndpoint(url: string): boolean { return SENSITIVE_ENDPOINT_RE.test(url) }

export function scrubObject<T>(value: T, ctx: ScrubContext = {}, depth = 0): T {
  if (depth > 8) return value
  if (value == null) return value
  if (typeof value === 'string') return scrubPii(value, ctx) as unknown as T
  if (Array.isArray(value)) return (value as unknown[]).map((v) => scrubObject(v, ctx, depth + 1)) as unknown as T
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src)) {
      if (isSensitiveKey(k)) out[k] = '[REDACTED]'
      else out[k] = scrubObject(v, ctx, depth + 1)
    }
    return out as unknown as T
  }
  return value
}

export function truncateExtra(extra: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!extra) return extra
  let json: string
  try { json = JSON.stringify(extra) } catch { return { _truncated: 'unserialisable' } }
  if (json.length <= MAX_EXTRA_BYTES) return extra
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
