// =============================================================================
// ClientInstallBanner — baner zachęty do instalacji PWA (v6.0)
// =============================================================================
// Wyświetla się raz (po pierwszym odwiedzeniu /client/dashboard), dopóki
// użytkownik nie odrzuci lub nie zainstaluje aplikacji.
// Klucz localStorage: 'pwa-client-install-dismissed'
// =============================================================================

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-client-install-dismissed'

export function ClientInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !deferredPrompt) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, '1')
    }
    setVisible(false)
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="client-install-banner">
      <div className="client-install-banner__content">
        <Download size={16} className="client-install-banner__icon" />
        <span>Zainstaluj aplikację, by mieć szybki dostęp do swoich projektów.</span>
      </div>
      <div className="client-install-banner__actions">
        <button className="client-install-banner__btn-install" onClick={handleInstall}>
          Zainstaluj
        </button>
        <button className="client-install-banner__btn-dismiss" onClick={handleDismiss} title="Zamknij">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
