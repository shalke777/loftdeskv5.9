// =============================================================================
// usePortalSession — zarządza cyklem życia sesji portalowej
// =============================================================================
// Stany:
//   loading    — trwa walidacja tokenu
//   invalid    — token nie istnieje (nie_found) lub błąd sieci
//   expired    — token wygasł
//   revoked    — token unieważniony
//   ready      — sesja aktywna
//
// Dane w localStorage (klucz: portal_session_<rawToken>):
//   { session_id, expires_at, project_id, company_id, client_name, scope, project }
//
// Odnawianie sesji:
//   - co 5 minut sprawdzamy czy sesja wygaśnie w ciągu następnych 10 minut
//   - jeśli tak, wywołujemy portal-validate ponownie z tym samym rawToken
//   - każda walidacja tworzy NOWĄ project_portal_session (stare wygasają same)
//   - jeśli karta jest otwarta a sesja wygasła: stan zmieniony na 'expired'

import { useCallback, useEffect, useRef, useState } from 'react'
import { validatePortalToken } from '@/features/portal/api/portal-project.api'
import type { PortalProjectData } from '@/features/portal/api/portal-project.api'
import type { PortalScope } from '@/features/portal/model/project-portal.types'

export type PortalSessionStatus = 'loading' | 'invalid' | 'expired' | 'revoked' | 'ready'

export interface PortalSessionData {
  session_id:   string
  expires_at:   string
  project_id:   string
  company_id:   string
  client_name:  string | null
  client_email: string | null
  scope:        PortalScope[]
  project:      PortalProjectData | null
}

export interface UsePortalSessionResult {
  status:    PortalSessionStatus
  session:   PortalSessionData | null
  /** Wymusza ponowną walidację — np. po wznowieniu karty */
  revalidate: () => void
}

// Klucz w localStorage: bezpieczny — nie zawiera rawToken, tylko hasza-pochodną
function storageKey(rawToken: string) {
  return `portal_session_${rawToken.slice(0, 16)}`
}

const REVALIDATE_INTERVAL_MS  = 5 * 60 * 1000   // 5 minut
const EXPIRY_WARNING_BUFFER_MS = 10 * 60 * 1000  // odnów jeśli wygaśnie za < 10 minut

function readStoredSession(rawToken: string): PortalSessionData | null {
  try {
    const raw = localStorage.getItem(storageKey(rawToken))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PortalSessionData
    // Jeśli sesja już wygasła w localStorage — nie używaj
    if (new Date(parsed.expires_at) < new Date()) {
      localStorage.removeItem(storageKey(rawToken))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredSession(rawToken: string, data: PortalSessionData) {
  try {
    localStorage.setItem(storageKey(rawToken), JSON.stringify(data))
  } catch {
    // Prywatna karta może blokować localStorage — ignorujemy cicho
  }
}

function clearStoredSession(rawToken: string) {
  try {
    localStorage.removeItem(storageKey(rawToken))
  } catch {}
}

export function usePortalSession(rawToken: string | undefined): UsePortalSessionResult {
  const [status,  setStatus]  = useState<PortalSessionStatus>('loading')
  const [session, setSession] = useState<PortalSessionData | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tokenRef    = useRef<string | undefined>(rawToken)
  tokenRef.current  = rawToken

  const validate = useCallback(async (token: string, forceRefresh = false) => {
    // Próbuj odczytać z localStorage jeśli to pierwsze ładowanie (nie force refresh)
    if (!forceRefresh) {
      const stored = readStoredSession(token)
      if (stored) {
        setSession(stored)
        setStatus('ready')
        return
      }
    }

    setStatus('loading')

    try {
      const result = await validatePortalToken(token)

      if (result.status === 'ok' && result.session_id && result.expires_at && result.project_id && result.company_id) {
        const sessionData: PortalSessionData = {
          session_id:   result.session_id,
          expires_at:   result.expires_at,
          project_id:   result.project_id,
          company_id:   result.company_id,
          client_name:  result.client_name  ?? null,
          client_email: result.client_email ?? null,
          scope:        (result.scope ?? []) as PortalScope[],
          project:      result.project      ?? null,
        }
        writeStoredSession(token, sessionData)
        setSession(sessionData)
        setStatus('ready')
      } else if (result.status === 'expired') {
        clearStoredSession(token)
        setSession(null)
        setStatus('expired')
      } else if (result.status === 'revoked') {
        clearStoredSession(token)
        setSession(null)
        setStatus('revoked')
      } else {
        // 'invalid', 'not_found', 'error', 'bad_request' → invalid
        clearStoredSession(token)
        setSession(null)
        setStatus('invalid')
      }
    } catch {
      // Brak sieci — jeśli mamy sesję w localStorage, używamy jej
      const stored = readStoredSession(token)
      if (stored) {
        setSession(stored)
        setStatus('ready')
      } else {
        setStatus('invalid')
      }
    }
  }, [])

  // Polling co 5 minut — odnów sesję przed wygaśnięciem
  const startPolling = useCallback((token: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(async () => {
      const current = tokenRef.current
      if (!current) return

      const stored = readStoredSession(current)
      if (!stored) {
        // Sesja już wygasła w localStorage
        setSession(null)
        setStatus('expired')
        return
      }

      const expiresInMs = new Date(stored.expires_at).getTime() - Date.now()
      if (expiresInMs <= 0) {
        clearStoredSession(current)
        setSession(null)
        setStatus('expired')
      } else if (expiresInMs < EXPIRY_WARNING_BUFFER_MS) {
        // Zbliżamy się do końca sesji — odnów
        await validate(current, true)
      }
    }, REVALIDATE_INTERVAL_MS)
  }, [validate])

  // Wznowienie karty (Page Visibility API) → rewalidacja
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && tokenRef.current) {
        const stored = readStoredSession(tokenRef.current)
        if (!stored) {
          setSession(null)
          setStatus('expired')
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Inicjalizacja przy pierwszym montowaniu lub zmianie tokenu
  useEffect(() => {
    if (!rawToken) {
      setStatus('invalid')
      setSession(null)
      return
    }
    validate(rawToken).then(() => startPolling(rawToken))
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [rawToken, validate, startPolling])

  const revalidate = useCallback(() => {
    if (tokenRef.current) validate(tokenRef.current, true)
  }, [validate])

  return { status, session, revalidate }
}
