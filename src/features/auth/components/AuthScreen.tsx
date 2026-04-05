import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'
import { supabase } from '@/shared/lib/supabase'
import { getAppOrigin } from '@/shared/lib/native'
import { isNativePlatform } from '@/shared/lib/native'
import { usePwaInstall } from '@/shared/hooks/usePwaInstall'
import { Download, Smartphone } from 'lucide-react'

type AuthTab = 'login' | 'register' | 'forgot' | 'client'

// ── Platform detection helpers ───────────────────────────────────────────────
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
}

// ── Install section on login page ────────────────────────────────────────────
function AppInstallSection() {
  const { canInstall, install } = usePwaInstall()
  const apkUrl = import.meta.env.VITE_APK_DOWNLOAD_URL as string | undefined

  // Don't show inside native app or already-installed PWA
  if (isNativePlatform() || isStandalone()) return null

  const showAndroid = isAndroid() || (!isIOS() && apkUrl)
  const showIOS = isIOS()
  // On desktop, only show if PWA install is available or APK URL is set
  const showDesktop = !isAndroid() && !isIOS() && (canInstall || apkUrl)

  if (!showAndroid && !showIOS && !showDesktop) return null

  return (
    <div className="auth-install">
      <div className="auth-install__header">
        <Smartphone size={16} />
        <span>Zainstaluj aplikację</span>
      </div>

      {/* Android: PWA install or APK download */}
      {showAndroid && (
        <div className="auth-install__row">
          {canInstall ? (
            <button className="auth-install__btn" onClick={() => void install()}>
              <Download size={15} />
              Zainstaluj (Android)
            </button>
          ) : apkUrl ? (
            <a className="auth-install__btn" href={apkUrl} download>
              <Download size={15} />
              Pobierz APK (Android)
            </a>
          ) : null}
        </div>
      )}

      {/* iOS: homescreen instruction */}
      {showIOS && (
        <div className="auth-install__ios">
          <p>
            <strong>iPhone / iPad:</strong> kliknij{' '}
            <span style={{ fontSize: 16, verticalAlign: 'middle' }}>⎙</span>{' '}
            <em>Udostępnij</em>, potem <em>Dodaj do ekranu początkowego</em>.
          </p>
        </div>
      )}

      {/* Desktop: show PWA install + APK link */}
      {showDesktop && !showAndroid && (
        <div className="auth-install__row">
          {canInstall && (
            <button className="auth-install__btn" onClick={() => void install()}>
              <Download size={15} />
              Zainstaluj aplikację
            </button>
          )}
          {apkUrl && (
            <a className="auth-install__btn auth-install__btn--secondary" href={apkUrl} download>
              <Download size={15} />
              Pobierz APK (Android)
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Formularz magic-link dla klientów (zleceniodawców) ───────────────────────
function ClientMagicLinkForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !supabase) return
    setLoading(true)
    setError('')

    // Step 1 — pre-check: verify this email has a client_accounts record.
    // This gives an explicit rejection for uninvited emails and unblocks
    // returning clients (shouldCreateUser: false was causing false negatives
    // in some Supabase configurations for existing users).
    const { data: hasAccess, error: rpcErr } = await supabase.rpc(
      'check_client_portal_access',
      { p_email: email.toLowerCase().trim() },
    )
    if (rpcErr || !hasAccess) {
      setLoading(false)
      setError('Ten adres nie ma jeszcze dostępu do portalu. Poproś wykonawcę o zaproszenie.')
      return
    }

    // Step 2 — send OTP. User is known to exist in client_accounts.
    // shouldCreateUser not forced to false — the RPC above is the real gate.
    // RLS further protects all data server-side.
    const baseUrl = getAppOrigin()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        emailRedirectTo: `${baseUrl}/auth/callback`,
      },
    })
    setLoading(false)
    if (err) { setError('Nie udało się wysłać linku. Sprawdź adres email lub spróbuj ponownie.'); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
        <h2 style={{ marginBottom: 8, fontSize: 22 }}>Sprawdź skrzynkę</h2>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          Wysłaliśmy link logowania na <strong>{email}</strong>.<br />
          Kliknij go, aby przejść do swoich projektów.
        </p>
        <Button variant="secondary" onClick={() => { setSent(false); setEmail('') }}>
          Wyślij ponownie
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: 6, fontSize: 20 }}>Dostęp do portalu klienta</h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
        Wpisz swój adres email — wyślemy jednorazowy link logowania.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <Input
          label="Adres email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          required
        />
        {error && <p style={{ color: '#A83228', fontSize: 13, margin: 0 }}>{error}</p>}
        <Button type="submit" disabled={loading || !email.trim()}>
          {loading ? 'Wysyłanie…' : 'Wyślij link logowania'}
        </Button>
      </form>
      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Nie masz dostępu? Skontaktuj się bezpośrednio ze swoim wykonawcą.
      </p>
      <div className="auth-screen__alt-links">
        <button className="auth-screen__text-btn" onClick={onBack}>← Logowanie dla firm</button>
      </div>
    </div>
  )
}

export function AuthScreen() {
  const [tab, setTab] = useState<AuthTab>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'client') {
      return 'client'
    }
    return 'login'
  })

  return (
    <main className="auth-shell">
      <div className="auth-screen">
        {/* Marka */}
        <div className="auth-screen__brand">
          <span className="auth-screen__mark">LD</span>
          <strong className="auth-screen__name">LoftDesk</strong>
        </div>

        {/* Karta formularza */}
        <div className="card auth-screen__card">
          {tab === 'login' && (
            <>
              <LoginForm />
              <div className="auth-screen__alt-links">
                <button className="auth-screen__text-btn" onClick={() => setTab('forgot')}>Nie pamiętam hasła</button>
                <span className="auth-screen__divider">·</span>
                <button className="auth-screen__text-btn" onClick={() => setTab('register')}>Nowa firma</button>
                <span className="auth-screen__divider">·</span>
                <button className="auth-screen__text-btn" onClick={() => setTab('client')}>Portal klienta</button>
              </div>
            </>
          )}
          {tab === 'register' && (
            <>
              <RegisterForm />
              <div className="auth-screen__alt-links">
                <button className="auth-screen__text-btn" onClick={() => setTab('login')}>← Mam już konto</button>
              </div>
            </>
          )}
          {tab === 'forgot' && (
            <>
              <ForgotPasswordForm />
              <div className="auth-screen__alt-links">
                <button className="auth-screen__text-btn" onClick={() => setTab('login')}>← Wróć do logowania</button>
              </div>
            </>
          )}
          {tab === 'client' && (
            <ClientMagicLinkForm onBack={() => setTab('login')} />
          )}
        </div>

        {/* Install app section */}
        <AppInstallSection />
      </div>
    </main>
  )
}
