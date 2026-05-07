// =============================================================================
// Secure auth storage adapter for Capacitor native shell.
// =============================================================================
// On native (iOS / Android):
//   - Uses @capacitor/preferences which maps to:
//     • iOS:     UserDefaults (suiteName per app, sandboxed, encrypted at rest by iOS)
//     • Android: SharedPreferences in app's private storage
//   - Survives WebView restarts and OS-level cookie/localStorage purges that can
//     happen on iOS WKWebView when storage pressure is high.
//
// On web (PWA / browser):
//   - Falls back to window.localStorage so behavior is unchanged.
//
// Why not localStorage on native?
//   - WKWebView aggressively evicts localStorage under storage pressure → users
//     get logged out unexpectedly. Preferences plugin is the official Capacitor
//     answer for "small auth tokens that must persist".
//
// Supabase contract: supplies any object with getItem / setItem / removeItem
// (sync or async). We return async — Supabase awaits it correctly.
// =============================================================================

import { Preferences } from '@capacitor/preferences'

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }
}

const isNative = (): boolean => {
  try {
    return Boolean(window?.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

export const nativeAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative()) {
      try { return window.localStorage.getItem(key) } catch { return null }
    }
    const { value } = await Preferences.get({ key })
    if (value !== null && value !== undefined) return value

    // Migration: on first native launch after app update that switched storage from
    // localStorage → Preferences, the existing Supabase auth token is still in
    // localStorage. Silently migrate it so the user is not logged out.
    // This is a one-time operation per token key.
    try {
      const legacy = window.localStorage.getItem(key)
      if (legacy !== null) {
        await Preferences.set({ key, value: legacy })
        window.localStorage.removeItem(key)
        console.info('[nativeAuthStorage] migrated key from localStorage to Preferences:', key)
        return legacy
      }
    } catch {
      /* migration failure is non-fatal */
    }
    return null
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isNative()) {
      try { window.localStorage.setItem(key, value) } catch { /* ignore quota */ }
      return
    }
    await Preferences.set({ key, value })
    // Remove any stale localStorage copy so there is no split-brain state.
    try { window.localStorage.removeItem(key) } catch { /* ignore */ }
  },

  async removeItem(key: string): Promise<void> {
    if (!isNative()) {
      try { window.localStorage.removeItem(key) } catch { /* ignore */ }
      return
    }
    await Preferences.remove({ key })
    try { window.localStorage.removeItem(key) } catch { /* ignore */ }
  },
}
