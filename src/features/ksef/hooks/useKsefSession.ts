import { useState, useCallback } from 'react'
import { ksefService, type KsefEnv } from '@/services/ksef/ksef.service'

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

function readSession(): KsefSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function useKsefSession() {
  const [session, setSession] = useState<KsefSession | null>(readSession)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        localStorage.setItem(SESSION_KEY, JSON.stringify(s))
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
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setLoading(false)
  }, [session])

  const initDemo = useCallback(
    (nip: string, env: KsefEnv = 'test'): KsefSession => {
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(s))
      setSession(s)
      return s
    },
    [],
  )

  return { session, loading, error, init, close, initDemo }
}
