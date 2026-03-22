// =============================================================================
// native.ts — Capacitor / native platform detection helpers
// =============================================================================
// Safe to call in web context (all helpers return web-appropriate values).
// No hard import of @capacitor/core here — we check via window.Capacitor
// to avoid breaking web builds when the library is not bundled.
// =============================================================================

/**
 * Returns true when running inside a Capacitor native shell (iOS or Android).
 * Returns false in browser / PWA / SSR contexts.
 */
export function isNativePlatform(): boolean {
  try {
    return Boolean((window as any).Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

/**
 * Returns the canonical origin used for Supabase auth redirects and API calls.
 *
 * Priority:
 *  1. VITE_APP_URL env var (set this to https://loftdesk.pl in all builds)
 *  2. window.location.origin (falls back to browser origin in web-only builds)
 *
 * In native context, window.location.origin is `https://localhost` (Capacitor server),
 * which is NOT a valid Supabase redirect URL — VITE_APP_URL must always be set
 * for production native builds.
 */
export function getAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL
  if (configured) return (configured as string).replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
