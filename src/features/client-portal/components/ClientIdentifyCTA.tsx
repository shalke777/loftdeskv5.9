// =============================================================================
// ClientIdentifyCTA — baner zachęty do rejestracji przez magic link (v6.0)
// =============================================================================
// Wyświetla się w portalu (PortalProjectPage) gdy użytkownik chce mieć
// dostęp do wszystkich swoich projektów w jednej aplikacji.
// Klucz localStorage: 'portal-identify-dismissed'
// =============================================================================

import { useState } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'portal-identify-dismissed'
const IDENTIFY_ENDPOINT = '/.netlify/functions/client-identify'

interface Props {
  /** rawToken portalu — wysyłany do Netlify function razem z email */
  portalToken: string
}

export function ClientIdentifyCTA({ portalToken }: Props) {
  const [dismissed, setDismissed]   = useState(() => Boolean(localStorage.getItem(DISMISS_KEY)))
  const [email, setEmail]           = useState('')
  const [fullName, setFullName]     = useState('')
  const [status, setStatus]         = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg]     = useState('')

  if (dismissed) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch(IDENTIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: portalToken, email: email.trim(), full_name: fullName.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json?.error ?? 'Wystąpił błąd. Spróbuj ponownie.')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setErrorMsg('Błąd połączenia. Sprawdź internet i spróbuj ponownie.')
      setStatus('error')
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="portal-identify-cta">
      <button className="portal-identify-cta__close" onClick={handleDismiss} title="Zamknij">
        <X size={14} />
      </button>

      {status === 'success' ? (
        <div className="portal-identify-cta__success">
          <span>✅</span>
          <div>
            <strong>Sprawdź skrzynkę email!</strong>
            <p>Wysłaliśmy Ci link dostępowy do portalu klienta LoftDesk.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="portal-identify-cta__header">
            <span className="portal-identify-cta__icon">🏠</span>
            <div>
              <strong>Chcesz śledzić wszystkie projekty w jednym miejscu?</strong>
              <p>Podaj email — wyślemy Ci bezpieczny link dostępowy do nowoczesnego portalu klienta.</p>
            </div>
          </div>

          <form className="portal-identify-cta__form" onSubmit={handleSubmit}>
            <input
              className="portal-identify-cta__input"
              type="text"
              placeholder="Imię i nazwisko (opcjonalnie)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
            />
            <div className="portal-identify-cta__row">
              <input
                className="portal-identify-cta__input portal-identify-cta__input--email"
                type="email"
                placeholder="Twój adres email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
              <button
                type="submit"
                className="portal-identify-cta__btn"
                disabled={status === 'loading' || !email.trim()}
              >
                {status === 'loading' ? '...' : 'Wyślij link'}
              </button>
            </div>
            {status === 'error' && (
              <p className="portal-identify-cta__error">{errorMsg}</p>
            )}
          </form>
        </>
      )}
    </div>
  )
}
