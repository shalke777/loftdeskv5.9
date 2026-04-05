// =============================================================================
// netlify/functions/shared/openai-retry.ts
// =============================================================================
// Retry wrapper for OpenAI Responses API calls.
// Single retry with 2s delay on transient errors (502, 503, 500, timeout).
// No retry on 429 (quota) or 4xx (client errors).
// =============================================================================

interface OpenAIRequestOptions {
  apiKey: string
  model: string
  instructions: string
  input: unknown[]
  text: { format: unknown }
  max_output_tokens: number
}

interface OpenAIRetryResult {
  ok: boolean
  status: number
  body: string
  retried: boolean
  headers: Headers
}

const RETRY_STATUSES = new Set([500, 502, 503])
const RETRY_DELAY_MS = 2_000
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
 * Call OpenAI Responses API with 1× automatic retry on transient errors.
 * Returns raw response body + metadata. Caller handles parsing.
 */
export async function callOpenAIWithRetry(
  opts: OpenAIRequestOptions,
  label: string = 'openai',
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
    }),
  }

  // First attempt
  let resp: Response
  let body: string
  try {
    resp = await fetchWithTimeout(url, init, REQUEST_TIMEOUT_MS)
    body = await resp.text()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const isTimeout = msg.includes('abort')
    console.warn(`[${label}] attempt 1 failed: ${msg} (timeout=${isTimeout})`)

    if (!isTimeout) {
      // Network error, not timeout — no retry
      throw new Error(`OpenAI network error: ${msg}`)
    }

    // Timeout → retry once
    await sleep(RETRY_DELAY_MS)
    console.info(`[${label}] retrying after timeout...`)
    try {
      resp = await fetchWithTimeout(url, init, REQUEST_TIMEOUT_MS)
      body = await resp.text()
      return { ok: resp.ok, status: resp.status, body, retried: true, headers: resp.headers }
    } catch (e2: unknown) {
      throw new Error(`OpenAI timeout after retry: ${e2 instanceof Error ? e2.message : String(e2)}`)
    }
  }

  // First attempt succeeded (even if not 2xx)
  if (resp.ok || !RETRY_STATUSES.has(resp.status)) {
    return { ok: resp.ok, status: resp.status, body, retried: false, headers: resp.headers }
  }

  // Transient error → retry once
  console.warn(`[${label}] attempt 1 got ${resp.status}, retrying in ${RETRY_DELAY_MS}ms...`)
  await sleep(RETRY_DELAY_MS)

  try {
    resp = await fetchWithTimeout(url, init, REQUEST_TIMEOUT_MS)
    body = await resp.text()
  } catch (e: unknown) {
    throw new Error(`OpenAI retry failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { ok: resp.ok, status: resp.status, body, retried: true, headers: resp.headers }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
