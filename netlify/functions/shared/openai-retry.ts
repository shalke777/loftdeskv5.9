// =============================================================================
// netlify/functions/shared/openai-retry.ts
// =============================================================================
// Retry wrapper for OpenAI Responses API calls.
// - 1× retry with 2s delay on transient errors (500, 502, 503, timeout)
// - 1× retry with 10s delay on 429 (rate limit / quota)
// - Extracts real token usage from OpenAI response when available
// =============================================================================

interface OpenAIRequestOptions {
  apiKey: string
  model: string
  instructions: string
  input: unknown[]
  text: { format: unknown }
  max_output_tokens: number
  temperature?: number
  store?: boolean
}

/** Token usage extracted from OpenAI Responses API */
export interface OpenAIUsage {
  input_tokens: number
  output_tokens: number
}

interface OpenAIRetryResult {
  ok: boolean
  status: number
  body: string
  retried: boolean
  headers: Headers
  duration_ms: number
  timeout_occurred: boolean
  usage: OpenAIUsage | null
}

const RETRY_STATUSES = new Set([500, 502, 503])
const RETRY_DELAY_MS = 2_000
const RATE_LIMIT_DELAY_MS = 10_000
const REQUEST_TIMEOUT_MS = 120_000

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Call OpenAI Responses API with automatic retry on transient errors.
 * - 1× retry on 500/502/503 (2s delay)
 * - 1× retry on 429 rate limit (10s delay)
 * - Extracts real token usage from response body when available
 *
 * @param timeoutMs  Per-call timeout override (default: 120 000 ms).
 *                   Heavy functions (project-analysis) can pass a higher value.
 */
export async function callOpenAIWithRetry(
  opts: OpenAIRequestOptions,
  label: string = 'openai',
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<OpenAIRetryResult> {
  const url = 'https://api.openai.com/v1/responses'
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      instructions: opts.instructions,
      input: opts.input,
      text: opts.text,
      max_output_tokens: opts.max_output_tokens,
      temperature: opts.temperature ?? 0,
      store: opts.store ?? false,
    }),
  }

  console.info(`[${label}] timeout=${timeoutMs}ms`)

  const t0 = Date.now()
  let timeoutOccurred = false

  // First attempt
  let resp: Response
  let body: string
  try {
    resp = await fetchWithTimeout(url, init, timeoutMs)
    body = await resp.text()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const isTimeout = msg.includes('abort')
    timeoutOccurred = isTimeout
    console.warn(`[${label}] attempt 1 failed: ${msg} (timeout=${isTimeout})`)

    if (!isTimeout) {
      // Network error, not timeout — no retry
      throw new Error(`OpenAI network error: ${msg}`)
    }

    // Timeout → retry once
    await sleep(RETRY_DELAY_MS)
    console.info(`[${label}] retrying after timeout...`)
    try {
      resp = await fetchWithTimeout(url, init, timeoutMs)
      body = await resp.text()
      return { ok: resp.ok, status: resp.status, body, retried: true, headers: resp.headers, duration_ms: Date.now() - t0, timeout_occurred: true, usage: extractUsage(body) }
    } catch (e2: unknown) {
      throw new Error(`OpenAI timeout after retry: ${e2 instanceof Error ? e2.message : String(e2)}`)
    }
  }

  // First attempt succeeded (even if not 2xx)
  // Retry on 429 (rate limit) with longer backoff
  if (resp.status === 429) {
    console.warn(`[${label}] attempt 1 got 429 (rate limit), retrying in ${RATE_LIMIT_DELAY_MS}ms...`)
    await sleep(RATE_LIMIT_DELAY_MS)

    try {
      resp = await fetchWithTimeout(url, init, timeoutMs)
      body = await resp.text()
    } catch (e: unknown) {
      throw new Error(`OpenAI 429 retry failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    return { ok: resp.ok, status: resp.status, body, retried: true, headers: resp.headers, duration_ms: Date.now() - t0, timeout_occurred: timeoutOccurred, usage: extractUsage(body) }
  }

  if (resp.ok || !RETRY_STATUSES.has(resp.status)) {
    return { ok: resp.ok, status: resp.status, body, retried: false, headers: resp.headers, duration_ms: Date.now() - t0, timeout_occurred: timeoutOccurred, usage: extractUsage(body) }
  }

  // Transient error → retry once
  console.warn(`[${label}] attempt 1 got ${resp.status}, retrying in ${RETRY_DELAY_MS}ms...`)
  await sleep(RETRY_DELAY_MS)

  try {
    resp = await fetchWithTimeout(url, init, timeoutMs)
    body = await resp.text()
  } catch (e: unknown) {
    throw new Error(`OpenAI retry failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { ok: resp.ok, status: resp.status, body, retried: true, headers: resp.headers, duration_ms: Date.now() - t0, timeout_occurred: timeoutOccurred, usage: extractUsage(body) }
}

/** Extract token usage from OpenAI Responses API body (best-effort) */
function extractUsage(body: string): OpenAIUsage | null {
  try {
    const parsed = JSON.parse(body)
    const u = parsed?.usage
    if (u && typeof u.input_tokens === 'number' && typeof u.output_tokens === 'number') {
      return { input_tokens: u.input_tokens, output_tokens: u.output_tokens }
    }
  } catch { /* non-JSON or malformed — ignore */ }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
