// =============================================================================
// useKsefSession — KSeF session lifecycle hook.
// =============================================================================
// The KSeF (Krajowy System e-Faktur) session token is the key to the Polish
// Ministry of Finance API and is bound to a single NIP. A leak lets an
// attacker issue invoices on our behalf, so we keep it in the platform's
// most secure available KV store via `secureStorage`:
//   - native: Capacitor Preferences → iOS UserDefaults / Android EncryptedSharedPreferences
//   - web:    localStorage (no Keychain equivalent; sessions are short-lived)
// =============================================================================

import { useState, useCallback, useEffect } from 'react'
import { ksefService, type KsefEnv } from '@/services/ksef/ksef.service'
import { secureStorage } from '@/shared/lib/secureStorage'

const SESSION_KEY = 'ksef_active_session'

export interface KsefSession {
  /** Session token for all KSeF API calls */
  sessionToken: string
  /** Session reference number */
  referenceNumber: string
  /** @deprecated Legacy alias for sessionToken */
  accessToken: string
  /** @deprecated Legacy alias for referenceNumber */
  sessionRef: string
  /** AES-256 symmetric key (base64) for encrypting invoices (optional) */
  symmetricKey: string
  /** Initialization vector (base64) for AES encryption (optional) */
  iv: string
  env: KsefEnv
  nip: string
  startedAt: string
  isDemo?: boolean
}

async function readSession(): Promise<KsefSession | null> {
  try {
    const raw = await secureStorage.get(SESSION_KEY)
    return raw ? (JSON.parse(raw) as KsefSession) : null
  } catch {
    return null
  }
}

export function useKsefSession() {
  const [session, setSession] = useState<KsefSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate from secure storage on mount (Preferences plugin is async on native).
  useEffect(() => {
    let cancelled = false
    void readSession().then((s) => { if (!cancelled) setSession(s) })
    return () => { cancelled = true }
  }, [])

  const init = useCallback(
    async (nip: string, token: string, env: KsefEnv = 'test'): Promise<KsefSession> => {
      setLoading(true)
      setError(null)
      try {
        const result = await ksefService.initSession(nip, token, env)
        const sessToken = (result.sessionToken as string) || (result.accessToken as string) || ''
        const refNum = (result.referenceNumber as string) || (result.sessionRef as string) || ''
        if (!sessToken) throw new Error('Serwer KSeF nie zwrócił tokenu sesji.')
        const s: KsefSession = {
          sessionToken: sessToken,
          referenceNumber: refNum,
          accessToken: sessToken,
          sessionRef: refNum,
          symmetricKey: (result.symmetricKey as string) || '',
          iv: (result.iv as string) || '',
          env,
          nip,
          startedAt: new Date().toISOString(),
        }
        await secureStorage.set(SESSION_KEY, JSON.stringify(s))
        setSession(s)
        return s
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const close = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      if (!session.isDemo) {
        await ksefService.closeSession(session.sessionToken, session.referenceNumber, session.env)
      }
    } catch {
      // ignore close errors — session may have already expired
    }
    await secureStorage.remove(SESSION_KEY)
    setSession(null)
    setLoading(false)
  }, [session])

  /** Best-effort revoke: closes the upstream session (if any) and wipes local storage. */
  const revoke = useCallback(async (): Promise<void> => {
    const current = session ?? (await readSession())
    if (current && !current.isDemo) {
      try {
        await ksefService.closeSession(current.sessionToken, current.referenceNumber, current.env)
      } catch {
        /* best-effort */
      }
    }
    await secureStorage.remove(SESSION_KEY)
    setSession(null)
  }, [session])

  const initDemo = useCallback(
    async (nip: string, env: KsefEnv = 'test'): Promise<KsefSession> => {
      const demoToken = `DEMO-${Date.now()}`
      const demoRef = `DEMO-SESSION-${Date.now()}`
      const s: KsefSession = {
        sessionToken: demoToken,
        referenceNumber: demoRef,
        accessToken: demoToken,
        sessionRef: demoRef,
        symmetricKey: '',
        iv: '',
        env,
        nip: nip || '0000000000',
        startedAt: new Date().toISOString(),
        isDemo: true,
      }
      await secureStorage.set(SESSION_KEY, JSON.stringify(s))
      setSession(s)
      return s
    },
    [],
  )

  return { session, loading, error, init, close, initDemo, revoke }
}
