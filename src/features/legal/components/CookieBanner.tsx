import { useState } from 'react'
import { X } from 'lucide-react'

const COOKIE_DISMISSED_KEY = 'loftdesk-cookie-notice-dismissed'

export function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(COOKIE_DISMISSED_KEY)
    } catch {
      return true
    }
  })

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(COOKIE_DISMISSED_KEY, '1')
    } catch {
      // graceful degradation
    }
    setVisible(false)
  }

  return (
    <div className="cookie-banner" role="complementary" aria-label="Informacja o plikach cookie">
      <div className="cookie-banner__text">
        Ta aplikacja używa wyłącznie niezbędnych technicznych plików cookies do
        działania sesji i autoryzacji. Nie korzystamy z cookies śledzących.{' '}
        <a href="/legal/polityka-cookies" target="_blank" rel="noreferrer">
          Polityka cookies
        </a>
      </div>
      <button className="cookie-banner__close" onClick={dismiss} aria-label="Zamknij">
        <X size={16} />
        <span>Rozumiem</span>
      </button>
    </div>
  )
}
