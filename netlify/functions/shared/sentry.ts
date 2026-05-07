/**
 * Backend Sentry integration for Netlify Functions (AI endpoints).
 *
 * - No-op when SENTRY_DSN env var is not set
 * - Lazy init on first captureAiError() call
 * - Fail-safe: never throws, never blocks request flow
 * - Attaches requestId, endpoint, category, userId, companyId, projectId
 */

import * as Sentry from '@sentry/node'
import { scrubObject, scrubPii, scrubUrl, isSensitiveEndpoint, truncateExtra } from './piiScrub'

let initialized = false

function ensureInit(): boolean {
  if (initialized) return true
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return false

  try {
    Sentry.init({
      dsn,
      environment: process.env.CONTEXT ?? 'unknown',
      release: process.env.COMMIT_REF
        ? `loftdesk-functions@${process.env.COMMIT_REF.slice(0, 8)}`
        : undefined,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend(event) {
        event.tags = { ...event.tags, 'loftdesk.side': 'backend' }
        const area = (event.tags as Record<string, unknown> | undefined)?.['loftdesk.area'] as string | undefined
        const ctx = { area }

        if (event.message) event.message = scrubPii(event.message, ctx)
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = scrubPii(ex.value, ctx)
            if (ex.stacktrace?.frames) {
              for (const f of ex.stacktrace.frames) {
                if (f.vars) f.vars = scrubObject(f.vars, ctx) as typeof f.vars
              }
            }
          }
        }
        if (event.request) {
          if (event.request.url) event.request.url = scrubUrl(event.request.url)
          if (event.request.headers) {
            event.request.headers = scrubObject(event.request.headers, ctx)
            for (const k of ['Cookie', 'cookie', 'Authorization', 'authorization', 'X-Auth-Token', 'x-auth-token']) {
              if ((event.request.headers as Record<string, unknown>)[k]) {
                ;(event.request.headers as Record<string, unknown>)[k] = '[REDACTED]'
              }
            }
          }
          if (event.request.cookies) event.request.cookies = '[REDACTED]'
          if (event.request.data) event.request.data = scrubObject(event.request.data, ctx)
          if (event.request.query_string) {
            event.request.query_string = scrubUrl('/?' + String(event.request.query_string)).replace(/^\/\??/, '')
          }
        }
        if (event.extra) event.extra = truncateExtra(scrubObject(event.extra, ctx))
        if (event.contexts) event.contexts = scrubObject(event.contexts, ctx)
        if (event.tags) event.tags = scrubObject(event.tags, ctx)
        if (event.user) event.user = { id: event.user.id }
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => ({
            ...b,
            message: b.message ? scrubPii(b.message, ctx) : b.message,
            data: b.data ? scrubObject(b.data, ctx) : b.data,
          }))
        }
        return event
      },
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr' || breadcrumb.category === 'http') {
          const url = (breadcrumb.data?.url as string | undefined) ?? ''
          if (url && isSensitiveEndpoint(url)) return null
          if (breadcrumb.data?.url) breadcrumb.data.url = scrubUrl(String(breadcrumb.data.url))
        }
        if (breadcrumb.message) breadcrumb.message = scrubPii(breadcrumb.message)
        if (breadcrumb.data) breadcrumb.data = scrubObject(breadcrumb.data)
        return breadcrumb
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
