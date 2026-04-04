/**
 * Backend Sentry integration for Netlify Functions (AI endpoints).
 *
 * - No-op when SENTRY_DSN env var is not set
 * - Lazy init on first captureAiError() call
 * - Fail-safe: never throws, never blocks request flow
 * - Attaches requestId, endpoint, category, userId, companyId, projectId
 */

import * as Sentry from '@sentry/node'

let initialized = false

function ensureInit(): boolean {
  if (initialized) return true
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return false

  try {
    Sentry.init({
      dsn,
      environment: process.env.CONTEXT ?? 'unknown', // Netlify: 'production' | 'deploy-preview' | 'branch-deploy'
      release: process.env.COMMIT_REF
        ? `loftdesk-functions@${process.env.COMMIT_REF.slice(0, 8)}`
        : undefined,
      tracesSampleRate: 0,   // no perf tracing for serverless
      beforeSend(event) {
        event.tags = { ...event.tags, 'loftdesk.side': 'backend' }
        return event
      },
    })
    initialized = true
    return true
  } catch {
    console.warn('[sentry] init failed — continuing without monitoring')
    return false
  }
}

export interface AiErrorContext {
  endpoint: string
  requestId: string | null
  category?: string
  userId?: string
  companyId?: string
  projectId?: string
  elapsed_ms?: number
  extra?: Record<string, unknown>
}

/**
 * Capture an AI endpoint error to Sentry with structured context.
 * No-op if SENTRY_DSN is not set. Never throws.
 */
export function captureAiError(error: unknown, ctx: AiErrorContext): void {
  try {
    // Always log structured JSON to Netlify logs (existing behavior preserved)
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`${ctx.endpoint.toUpperCase().replace(/-/g, '_')}_SENTRY`, JSON.stringify({
      endpoint:   ctx.endpoint,
      requestId:  ctx.requestId,
      category:   ctx.category ?? 'internal',
      error:      msg.slice(0, 500),
      elapsed_ms: ctx.elapsed_ms ?? -1,
    }))

    if (!ensureInit()) return

    Sentry.withScope((scope) => {
      scope.setTag('loftdesk.endpoint', ctx.endpoint)
      scope.setTag('loftdesk.category', ctx.category ?? 'internal')
      scope.setTag('loftdesk.side', 'backend')
      if (ctx.requestId) scope.setTag('loftdesk.requestId', ctx.requestId)
      if (ctx.userId) scope.setUser({ id: ctx.userId })
      if (ctx.companyId) scope.setTag('loftdesk.company_id', ctx.companyId)
      if (ctx.projectId) scope.setTag('loftdesk.project_id', ctx.projectId)
      if (ctx.elapsed_ms != null) scope.setExtra('elapsed_ms', ctx.elapsed_ms)
      if (ctx.extra) scope.setExtras(ctx.extra)

      if (error instanceof Error) {
        Sentry.captureException(error)
      } else {
        Sentry.captureMessage(String(error), 'error')
      }
    })

    // Flush in serverless — events must be sent before function exits
    Sentry.flush(2000).catch(() => {})
  } catch {
    // captureAiError must NEVER throw
  }
}

/**
 * Flush Sentry events. Call at the end of handler before returning response.
 * No-op if Sentry not initialized.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return
  try {
    await Sentry.flush(timeoutMs)
  } catch {
    // ignore
  }
}
