import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from '@/app/App'
import '@/shared/styles/tokens.css'
import '@/shared/styles/globals.css'

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

registerSW({ immediate: true })

// Global unhandled rejection handler — catches async errors not caught by React error boundaries
window.addEventListener('unhandledrejection', (event) => {
  console.error('[LoftDesk] unhandled promise rejection:', event.reason)
})

// Register appUrlOpen deep-link handler for Capacitor native shell.
// Fires when the OS hands a URL to the app (Universal Link / Custom Scheme).
// We extract the path+query and navigate within the WebView.
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
