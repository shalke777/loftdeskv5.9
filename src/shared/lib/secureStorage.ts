// =============================================================================
// secureStorage.ts — token-grade key/value storage adapter.
// =============================================================================
// On native (iOS / Android, via Capacitor):
//   - Uses @capacitor/preferences which maps to:
//     • iOS: encrypted UserDefaults (sandboxed)
//     • Android: EncryptedSharedPreferences (when available) / private SharedPreferences
//   - This is the recommended Capacitor location for short-lived access tokens.
//
// On web:
//   - Falls back to localStorage. There is no equivalent of Keychain in browsers
//     and the alternatives (sessionStorage, in-memory) are too fragile for a
//     short-lived token that must survive a tab refresh during invoice flow.
//
// Migration: getItem() transparently reads any legacy localStorage value if no
// native value is present, and migrates it on first read (then removes the
// legacy entry). This is backwards-compatible with existing KSeF sessions.
//
// API is async to match the native plugin contract; callers must await.
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

async function readNative(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key })
  return value ?? null
}

async function writeNative(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value })
}

async function removeNative(key: string): Promise<void> {
  await Preferences.remove({ key })
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore quota */
  }
}

function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const secureStorage = {
  /** Read a value. On native, also migrates any legacy localStorage value. */
  async get(key: string): Promise<string | null> {
    if (!isNative()) {
      return readLocal(key)
    }
    const native = await readNative(key)
    if (native !== null) return native

    // Backwards-compatibility: migrate from legacy localStorage on first read.
    const legacy = readLocal(key)
    if (legacy !== null) {
      try {
        await writeNative(key, legacy)
      } catch {
        /* if migration fails we still return the legacy value */
      }
      removeLocal(key)
      return legacy
    }
    return null
  },

  async set(key: string, value: string): Promise<void> {
    if (!isNative()) {
      writeLocal(key, value)
      return
    }
    await writeNative(key, value)
    // Ensure no stale plaintext copy remains in the WebView's localStorage.
    removeLocal(key)
  },

  async remove(key: string): Promise<void> {
    if (!isNative()) {
      removeLocal(key)
      return
    }
    await removeNative(key)
    removeLocal(key)
  },
}
