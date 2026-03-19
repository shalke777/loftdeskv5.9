import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'
import { supabase } from '@/shared/lib/supabase'

const tabs = [
  { key: 'login',    label: 'Logowanie' },
  { key: 'register', label: 'Nowa firma' },
  { key: 'forgot',   label: 'Reset hasła' },
  { key: 'client',   label: 'Jestem klientem' },
] as const

type AuthTab = (typeof tabs)[number]['key']

// ── Prosty formularz magic-link dla klientów ──────────────────────────────────
function ClientMagicLinkForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !supabase) return
    setLoading(true)
    setError('')
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      // No query params: Supabase may reject redirectTo with query strings.
      // Client detection is handled in auth-callback via RPC/auth_user_id fallback.
      options: { emailRedirectTo: `${baseUrl}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError('Nie udało się wysłać linku. Sprawdź adres email.'); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
        <h2 style={{ marginBottom: 8 }}>Sprawdź skrzynkę</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          Wysłaliśmy link logowania na <strong>{email}</strong>.<br />
          Kliknij go, aby przejść do swoich projektów.
        </p>
        <Button variant="secondary" style={{ marginTop: 20 }} onClick={() => { setSent(false); setEmail('') }}>
          Wyślij ponownie
        </Button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '28px 32px' }}>
      <h2 style={{ marginBottom: 6, fontSize: 20 }}>Dostęp do projektów</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
        Jeśli wykonawca przydzielił Ci dostęp do projektu, wpisz swój adres email.<br />
        Wyślemy Ci link logowania bez hasła.
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
        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
        <Button type="submit" disabled={loading || !email.trim()}>
          {loading ? 'Wysyłanie…' : 'Wyślij link logowania'}
        </Button>
      </form>
      <p style={{ marginTop: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
        Nie masz dostępu? Skontaktuj się bezpośrednio ze swoim wykonawcą.
      </p>
    </div>
  )
}

export function AuthScreen() {
  const [tab, setTab] = useState<AuthTab>(() => {
    // Jeśli URL zawiera ?mode=client, otwórz od razu zakładkę klienta
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'client') {
      return 'client'
    }
    return 'login'
  })

  return (
    <main className="auth-shell">
      <div style={{ width: 'min(1120px, 100%)', display: 'grid', gap: 16 }}>
        <div className="grid-2" style={{ alignItems: 'stretch' }}>
          <div className="card highlight-card">
            <span className="hero__eyebrow" style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}>LoftDesk</span>
            <h1 style={{ fontSize: 42, marginBottom: 12, color: 'var(--color-chart-5)' }}>Wchodzisz do systemu, który porządkuje ofertę, dokumenty i realizację.</h1>
            <p>LoftDesk jest prostszy niż ciężkie ERP-y i dużo bardziej dopasowany do realiów budowy niż zwykłe programy do faktur.</p>
            <div className="hero__actions">
              <Link to="/"><Button variant="secondary">Wróć na landing</Button></Link>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="toolbar" style={{ justifyContent: 'center', marginBottom: 0 }}>
              <div className="toolbar__actions">
                {tabs.map((item) => (
                  <Button key={item.key} variant={tab === item.key ? 'primary' : 'secondary'} onClick={() => setTab(item.key)}>
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            {tab === 'login'    ? <LoginForm />             : null}
            {tab === 'register' ? <RegisterForm />          : null}
            {tab === 'forgot'   ? <ForgotPasswordForm />    : null}
            {tab === 'client'   ? <ClientMagicLinkForm />   : null}
          </div>
        </div>
      </div>
    </main>
  )
}
