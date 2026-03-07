import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

const tabs = [
  { key: 'login', label: 'Logowanie' },
  { key: 'register', label: 'Nowa firma' },
  { key: 'forgot', label: 'Reset hasła' },
] as const

type AuthTab = (typeof tabs)[number]['key']

export function AuthScreen() {
  const [tab, setTab] = useState<AuthTab>('login')

  return (
    <main className="auth-shell">
      <div style={{ width: 'min(1120px, 100%)', display: 'grid', gap: 16 }}>
        <div className="grid-2" style={{ alignItems: 'stretch' }}>
          <div className="card highlight-card">
            <span className="hero__eyebrow" style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}>LoftDesk</span>
            <h1 style={{ fontSize: 42, marginBottom: 12 }}>Wchodzisz do systemu, który porządkuje ofertę, dokumenty i realizację.</h1>
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
            {tab === 'login' ? <LoginForm /> : null}
            {tab === 'register' ? <RegisterForm /> : null}
            {tab === 'forgot' ? <ForgotPasswordForm /> : null}
          </div>
        </div>
      </div>
    </main>
  )
}
