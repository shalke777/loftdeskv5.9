// =============================================================================
// Netlify Function: ai-project-assistant
// =============================================================================
// Lightweight project-scoped AI assistant. Takes a question + context summary
// from the frontend and returns a short, actionable answer in Polish.
//
// Request (POST /.netlify/functions/ai-project-assistant):
//   Content-Type: application/json
//   Authorization: Bearer <supabase-jwt>  (optional in dev)
//   {
//     question:    string
//     company_id:  string
//     project_id:  string
//     run_id:      string
//     context:     object  (compact summary of run data)
//   }
//
// Response: { ok: true, answer: string }
//
// Constraints:
//   - Read-only: never modifies business state
//   - Project-scoped: only answers about the given analysis
//   - Cost-controlled: uses gpt-4o-mini, max 1000 output tokens
//   - Rate limited: 20 requests per 10 minutes per user
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

const RATE_MAX       = 20
const RATE_WINDOW_MS = 10 * 60 * 1000

// ── Auth (same pattern as all other AI functions) ────────────────────────────

async function verifyRequestAuth(event: HandlerEvent): Promise<string | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('[ai-project-assistant] Supabase not configured — skipping JWT check (dev only)')
    return 'dev'
  }
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(authHeader.slice(7))
    return user?.id ?? null
  } catch {
    return null
  }
}

function makeRateLimitClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function ok(answer: string) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, answer }) }
}

function err(statusCode: number, error: string, message: string) {
  console.error(`[ai-project-assistant] ${error}: ${message}`)
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, error, message }) }
}

// ── System instructions ─────────────────────────────────────────────────────

const INSTRUCTIONS = `Jesteś asystentem projektu budowlanego w aplikacji LoftDesk.

ZASADY:
- Odpowiadasz TYLKO na pytania dotyczące bieżącej analizy AI i projektu.
- Odpowiadaj krótko, konkretnie, po polsku.
- Nigdy nie finalizuj decyzji — tylko sugeruj i wyjaśniaj.
- Zawsze zaznaczaj, że sugestie wymagają weryfikacji operatora.
- Odwołuj się do danych z kontekstu, nie wymyślaj.
- Jeśli pytanie wykracza poza zakres analizy, powiedz to wprost.
- Nie pisz do klienta, nie zatwierdzaj wycen, nie zmieniaj statusów.

FORMAT:
- Używaj punktów (•) dla list
- Bądź zwięzły — max 200 słów
- Zacznij od bezpośredniej odpowiedzi, nie od "Oczywiście" ani "Jasne"`

// ── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return err(405, 'method_not_allowed', 'Only POST allowed')
  }

  const t0 = Date.now()

  // Auth
  const userId = await verifyRequestAuth(event)
  if (!userId) return err(401, 'unauthorized', 'Invalid or missing auth token')

  // Rate limit
  const rlClient = makeRateLimitClient()
  if (rlClient) {
    try {
      const { isRateLimitedDb } = await import('./shared/rate-limit')
      const rl = await isRateLimitedDb(rlClient, userId, 'ai-project-assistant', RATE_MAX, RATE_WINDOW_MS)
      if (rl.limited) {
        return err(429, 'rate_limited', `Limit zapytań (${RATE_MAX}/10min) wyczerpany. Spróbuj za chwilę.`)
      }
    } catch (e) {
      console.warn('[ai-project-assistant] rate limit check failed, allowing request', e)
    }
  }

  // Parse body
  let body: {
    question:   string
    company_id: string
    project_id: string
    run_id:     string
    context:    Record<string, unknown>
  }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err(400, 'invalid_body', 'Invalid JSON body')
  }

  const { question, company_id, project_id, run_id, context } = body
  if (!question?.trim()) return err(400, 'missing_question', 'Question is required')
  if (!project_id) return err(400, 'missing_project_id', 'project_id is required')

  console.info('[ai-project-assistant] START', JSON.stringify({
    userId: userId.slice(0, 8),
    projectId: project_id.slice(0, 8),
    runId: run_id?.slice(0, 8),
    questionLen: question.length,
    elapsed_ms: Date.now() - t0,
  }))

  // Build prompt
  const contextSummary = JSON.stringify(context ?? {}, null, 0).slice(0, 4000)
  const userMessage = `Kontekst analizy AI (JSON):\n${contextSummary}\n\nPytanie operatora:\n${question}`

  // Call OpenAI (gpt-4o-mini for cost efficiency)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return err(500, 'config_error', 'OpenAI API key not configured')

  const model = process.env.OPENAI_MODEL_ASSISTANT?.trim() || 'gpt-4o-mini'

  try {
    const { callOpenAIWithRetry } = await import('./shared/openai-retry')
    const resp = await callOpenAIWithRetry({
      apiKey,
      model,
      instructions: INSTRUCTIONS,
      input: [{ role: 'user', content: userMessage }],
      text: { format: { type: 'text' } },
      max_output_tokens: 1_000,
    }, 'ai-project-assistant', 60_000) // 60s timeout — fast model

    if (!resp.ok) {
      console.error('[ai-project-assistant] OpenAI error', { status: resp.status, body: resp.body.slice(0, 300) })
      if (resp.status === 429) return err(429, 'openai_quota', 'Limit OpenAI wyczerpany.')
      return err(502, 'openai_error', 'Błąd dostawcy AI.')
    }

    // Parse response — Responses API returns array of output items
    let answer = ''
    try {
      const parsed = JSON.parse(resp.body)
      const output = parsed.output
      if (Array.isArray(output)) {
        for (const item of output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === 'output_text') answer += c.text
            }
          }
        }
      }
      if (!answer) answer = parsed.output_text ?? resp.body.slice(0, 500)
    } catch {
      answer = resp.body.slice(0, 500)
    }

    console.info('[ai-project-assistant] DONE', JSON.stringify({
      model,
      answerLen: answer.length,
      retried: resp.retried,
      duration_ms: resp.duration_ms,
      total_ms: Date.now() - t0,
    }))

    // Sprint F: persist query to audit log
    const auditClient = makeRateLimitClient()
    if (auditClient && company_id && userId !== 'dev') {
      auditClient.from('ai_assistant_queries').insert({
        company_id,
        project_id,
        run_id: run_id || null,
        user_id: userId,
        question: question.slice(0, 500),
        answer_source: 'ai',
        answer_length: answer.length,
        model_name: model,
        duration_ms: resp.duration_ms,
      }).then(() => undefined).catch(e => {
        console.warn('[ai-project-assistant] audit insert failed:', e)
      })
    }

    return ok(answer.trim())
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ai-project-assistant] FATAL', msg)
    return err(500, 'internal_error', msg)
  }
}
