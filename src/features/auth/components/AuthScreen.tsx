import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

const tabs = [
  { key: 'login',    label: 'Logowanie' },
  { key: 'register', label: 'Nowa firma' },
  { key: 'forgot',   label: 'Reset hasła' },
  { key: 'client',   label: 'Jestem klientem' },
] as const

type AuthTab = (typeof tabs)[number]['key']

// ── Prosty formularz magic-link dla klientów ──────────────────────────────────
// Używa /.netlify/functions/client-otp (admin.generateLink, bez SMTP).
// Klient zostaje przekierowany bezpośrednio na wygenerowany link Supabase.
function ClientMagicLinkForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/.netlify/functions/client-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      const body = await res.json() as { ok?: boolean; error?: string; magic_link?: string | null }
      setLoading(false)

      if (!res.ok) {
        setError(body?.error ?? 'Błąd serwera. Spróbuj ponownie.')
        return
      }

      if (body?.magic_link) {
        // Przekieruj bezpośrednio na magic link — Supabase weryfikuje i ustawia sesję
        window.location.assign(body.magic_link)
        return
      }

      // Brak magic_link: konto nie istnieje (lub konto nie jest klienckie).
      // Pokazujemy neutralną wiadomość zamiast ujawniać, że email nie jest zarejestrowany.
      setSent(true)
    } catch {
      setLoading(false)
      setError('Błąd połączenia. Sprawdź internet i spróbuj ponownie.')
    }
  }

  if (sent) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
        <h2 style={{ marginBottom: 8 }}>Sprawdź skrzynkę</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          Jeśli masz przypisany dostęp do projektu, link logowania powinien dotrzeć na <strong>{email}</strong>.
          <br />Sprawdź folder spam.
        </p>
        <Button variant="secondary" style={{ marginTop: 20 }} onClick={() => { setSent(false); setEmail('') }}>
          Spróbuj ponownie
        </Button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '28px 32px' }}>
      <h2 style={{ marginBottom: 6, fontSize: 20 }}>Dostęp do projektów</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
        Jeśli wykonawca przydzielił Ci dostęp do projektu, wpisz swój adres email.<br />
        Zostaniesz automatycznie zalogowany.
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
          {loading ? 'Łączenie…' : 'Zaloguj się'}
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
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'client') {
      return 'client'
    }
    return 'login'
  })

  return (
    <main className="auth-shell">
      <div style={{ width: 'min(440px, 100%)', display: 'grid', gap: 12 }}>

        {/* Compact header */}
        <div style={{ textAlign: 'center', paddingBottom: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'var(--color-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 11, letterSpacing: .5,
            }}>LD</div>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: -.2 }}>LoftDesk Login</span>
          </div>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Zaloguj się do konta firmowego
          </p>
        </div>

        {/* Compact pill tab bar */}
        <div style={{
          display: 'flex', gap: 3,
          background: 'var(--color-bg-elevated)',
          borderRadius: 8, padding: 3,
        }}>
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              style={{
                flex: 1,
                padding: '5px 4px',
                fontSize: 11.5,
                fontWeight: tab === item.key ? 600 : 400,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                background: tab === item.key ? 'var(--color-surface)' : 'transparent',
                color: tab === item.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                boxShadow: tab === item.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Forms */}
        {tab === 'login'    ? <LoginForm />           : null}
        {tab === 'register' ? <RegisterForm />        : null}
        {tab === 'forgot'   ? <ForgotPasswordForm />  : null}
        {tab === 'client'   ? <ClientMagicLinkForm /> : null}
      </div>
    </main>
  )
}
