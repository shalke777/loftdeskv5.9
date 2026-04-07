import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { initMonitoring, captureError } from '@/shared/lib/monitoring'
import { App } from '@/app/App'
import '@/shared/styles/tokens.css'
import '@/shared/styles/globals.css'

// Initialize monitoring before anything else — must be first operational call.
// No-op when VITE_SENTRY_DSN is not set (safe for local dev).
initMonitoring()

// Supabase email confirmation may redirect to root (/) with auth tokens.
// Detect and redirect to /auth/callback before React mounts.
;(function interceptAuthRedirect() {
  const path = window.location.pathname
  if (path === '/auth/callback') return // already on callback page

  const hash = window.location.hash
  const search = window.location.search
  const params = new URLSearchParams(search)

  const hasCode = params.has('code') && params.has('type') !== false
  const hasHash = hash.includes('access_token=') || hash.includes('refresh_token=')
  const hasError = params.has('error') || params.has('error_description')
  const hasType = params.get('type') === 'signup' || params.get('type') === 'recovery' || params.get('type') === 'email'

  if (hasCode || hasHash || hasError || hasType) {
    window.location.replace(`/auth/callback${search}${hash}`)
    return
  }
})()

// ── DEV-only runtime hardening ────────────────────────────────────────────────
// This entire block is dead code in production builds (Vite replaces
// import.meta.env.DEV with `false` and tree-shakes it away).
if (import.meta.env.DEV) {
  // 1. Unregister any SW left over from a previous `npm run build` + preview.
  //    VitePWA devOptions.enabled=false means no new SW is registered in dev,
  //    but a stale SW can still intercept HMR asset requests and serve old JS.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      const count = registrations.length
      for (const reg of registrations) void reg.unregister()
      // 2. Startup diagnostic — confirms port, SW status, and dev mode.
      //    Helps immediately spot "wrong port" or "SW still active" situations.
      console.info(
        `%c[LoftDesk DEV]%c port=${window.location.port || '80'}  SW=${count > 0 ? `cleared ${count} registration(s)` : 'none'}  HMR=active`,
        'color:var(--color-brand);font-weight:700',
        'color:var(--color-text-muted)',
      )
    })
  }
}

registerSW({ immediate: true })

// Global unhandled rejection handler — catches async errors not caught by React error boundaries
window.addEventListener('unhandledrejection', (event) => {
  captureError(event.reason, { area: 'unknown', level: 'error', extra: { source: 'unhandledrejection' } })
})

// Register appUrlOpen deep-link handler for Capacitor native shell.
// Fires when the OS hands a URL to the app (Universal Link / Custom Scheme / App Shortcut).
// Handles:
//   - Universal Links: https://loftdesk.pl/path → navigate to /path
//   - App Shortcuts (B2): loftdesk://app/expenses → navigate to /expenses
;(function registerNativeDeepLinks() {
  const cap = (window as any).Capacitor
  if (!cap?.isNativePlatform?.()) return
  cap.Plugins?.App?.addListener?.('appUrlOpen', (event: { url: string }) => {
    try {
      const url = new URL(event.url)
      const destination = url.pathname + url.search + url.hash
      window.location.assign(destination)
    } catch {
      // Malformed URL — ignore
    }
  })
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
