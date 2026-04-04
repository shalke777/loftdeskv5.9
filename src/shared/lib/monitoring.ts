/**
 * LoftDesk production monitoring — Sentry integration with graceful fallback.
 *
 * Design:
 * - No-op when VITE_SENTRY_DSN is not set (local dev, preview, staging without DSN)
 * - Full Sentry integration in production when DSN is configured
 * - Error classification by LoftDesk domain area
 * - User/company context attached to events (safe subset only)
 * - Web Vitals performance monitoring (lightweight)
 */

import * as Sentry from '@sentry/react'

// ─── ENV ────────────────────────────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const IS_PROD = import.meta.env.PROD
const APP_VERSION = import.meta.env.VITE_APP_VERSION as string | undefined
const COMMIT_REF = import.meta.env.VITE_COMMIT_REF as string | undefined

/** True when Sentry is fully initialized and operational. */
let sentryActive = false

// ─── ERROR AREA CLASSIFICATION ──────────────────────────────────────────────

export type ErrorArea =
  | 'ui'
  | 'api'
  | 'rls'
  | 'parsing'
  | 'ksef'
  | 'portal'
  | 'billing'
  | 'auth'
  | 'unknown'

/** Classify an error into a LoftDesk domain area based on context clues. */
export function classifyError(error: unknown, hint?: string): ErrorArea {
  const msg =
    (error instanceof Error ? error.message : String(error ?? '')).toLowerCase() +
    ' ' +
    (hint ?? '').toLowerCase()

  if (/rls|row.level|policy|permission denied|not authorized|403/.test(msg)) return 'rls'
  if (/auth|login|sign.?in|session|token|jwt|refresh_token/.test(msg)) return 'auth'
  if (/ksef|krajowy|faktur/.test(msg)) return 'ksef'
  if (/parse|ocr|extract|tesseract|openai|gpt|ai.?fallback/.test(msg)) return 'parsing'
  if (/portal|client.?project|client.?dashboard|invited/.test(msg)) return 'portal'
  if (/stripe|billing|payment|subscription|checkout|plan/.test(msg)) return 'billing'
  if (/fetch|network|500|502|503|504|supabase|postgrest|timeout/.test(msg)) return 'api'
  if (/render|component|hook|react|chunk|loading chunk|dynamic import/.test(msg)) return 'ui'
  return 'unknown'
}

// ─── INIT ───────────────────────────────────────────────────────────────────

export function initMonitoring() {
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.info('[monitoring] Sentry DSN not set — monitoring disabled (dev mode)')
    }
    return
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: IS_PROD ? 'production' : 'development',
      release: COMMIT_REF
        ? `loftdesk@${COMMIT_REF.slice(0, 8)}`
        : APP_VERSION ? `loftdesk@${APP_VERSION}` : undefined,

      // Performance: sample 20% of transactions in prod, 100% in dev
      tracesSampleRate: IS_PROD ? 0.2 : 1.0,

      // Replay: disabled (heavy, not needed for MVP observability)
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,

      // Filter noisy browser errors
      ignoreErrors: [
        // Browser extensions and third-party scripts
        'ResizeObserver loop',
        'ResizeObserver loop completed with undelivered notifications',
        // Network errors that aren't actionable
        'Failed to fetch',
        'Load failed',
        'NetworkError',
        // Service worker cache errors
        'AbortError',
        // Chunk load failures (handled by route error boundary)
        /Loading chunk \d+ failed/,
        /loading CSS chunk/i,
      ],

      beforeSend(event, hint) {
        const error = hint?.originalException
        const area = classifyError(error)
        event.tags = { ...event.tags, 'loftdesk.area': area }
        return event
      },

      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.browserProfilingIntegration(),
      ],
    })

    sentryActive = true
  } catch (err) {
    // Sentry init failure must never crash the app
    console.warn('[monitoring] Sentry init failed — continuing without monitoring:', err)
  }
}

// ─── CONTEXT ────────────────────────────────────────────────────────────────

interface MonitoringUser {
  id: string
  companyId: string
  role: string
  plan: string
}

/** Set user context for all subsequent Sentry events. */
export function setMonitoringUser(user: MonitoringUser | null) {
  if (!sentryActive) return
  if (user) {
    Sentry.setUser({ id: user.id })
    Sentry.setTag('loftdesk.company_id', user.companyId)
    Sentry.setTag('loftdesk.role', user.role)
    Sentry.setTag('loftdesk.plan', user.plan)
  } else {
    Sentry.setUser(null)
  }
}

/** Set the current route/screen for breadcrumb context. */
export function setMonitoringRoute(route: string) {
  if (!sentryActive) return
  Sentry.setTag('loftdesk.route', route)
}

// ─── ERROR CAPTURE ──────────────────────────────────────────────────────────

interface CaptureOptions {
  area?: ErrorArea
  /** Additional key-value context attached to the event */
  extra?: Record<string, unknown>
  /** Severity override */
  level?: 'fatal' | 'error' | 'warning' | 'info'
}

/** Capture an error to Sentry with LoftDesk classification. */
export function captureError(error: unknown, options?: CaptureOptions) {
  const area = options?.area ?? classifyError(error)

  // Always log to console for local debugging
  console.error(`[LoftDesk:${area}]`, error)

  if (!sentryActive) return

  Sentry.withScope((scope) => {
    scope.setTag('loftdesk.area', area)
    scope.setLevel(options?.level ?? 'error')
    if (options?.extra) {
      scope.setExtras(options.extra)
    }
    if (error instanceof Error) {
      Sentry.captureException(error)
    } else {
      Sentry.captureMessage(String(error), options?.level ?? 'error')
    }
  })
}

/** Capture a non-fatal warning (e.g., degraded functionality). */
export function captureWarning(message: string, extra?: Record<string, unknown>) {
  if (!sentryActive) return
  Sentry.withScope((scope) => {
    scope.setLevel('warning')
    if (extra) scope.setExtras(extra)
    Sentry.captureMessage(message, 'warning')
  })
}

// ─── BREADCRUMBS ────────────────────────────────────────────────────────────

/** Add a breadcrumb for tracing user actions leading to an error. */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>) {
  if (!sentryActive) return
  Sentry.addBreadcrumb({ category, message, data, level: 'info' })
}

// ─── RE-EXPORTS for convenience ─────────────────────────────────────────────

export { Sentry }
