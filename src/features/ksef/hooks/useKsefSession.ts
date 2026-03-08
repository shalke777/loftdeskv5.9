import { useState, useCallback } from 'react'
import { ksefService, type KsefEnv } from '@/services/ksef/ksef.service'

const SESSION_KEY = 'ksef_active_session'

export interface KsefSession {
  /** JWT Bearer access token for all v2 API calls */
  accessToken: string
  /** Online session reference number (for sending invoices, close, UPO) */
  sessionRef: string
  /** AES-256 symmetric key (base64) for encrypting invoices */
  symmetricKey: string
  /** Initialization vector (base64) for AES encryption */
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
        if (!result.accessToken) throw new Error('Serwer KSeF nie zwrócił tokenu dostępu')
        if (!result.sessionRef) throw new Error('Serwer KSeF nie zwrócił numeru referencyjnego sesji')
        const s: KsefSession = {
          accessToken: result.accessToken as string,
          sessionRef: result.sessionRef as string,
          symmetricKey: result.symmetricKey as string,
          iv: result.iv as string,
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
      await ksefService.closeSession(session.accessToken, session.sessionRef, session.env)
    } catch {
      // ignore close errors — session may have already expired
    }
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setLoading(false)
  }, [session])

  const initDemo = useCallback(
    (nip: string, env: KsefEnv = 'test'): KsefSession => {
      const s: KsefSession = {
        accessToken: `DEMO-${Date.now()}`,
        sessionRef: `DEMO-SESSION-${Date.now()}`,
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
