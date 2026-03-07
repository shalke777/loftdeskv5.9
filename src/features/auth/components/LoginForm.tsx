import { useMemo, useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { demoDb } from '@/shared/lib/demoDb'
import { getPendingInviteToken, clearPendingInviteToken } from '@/shared/lib/inviteIntent'
import { settingsApi } from '@/features/settings/api/settings.api'

export function LoginForm() {
  const { signInDemo, registerDemoCompany } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('adam@budowlanka.pl')
  const [password, setPassword] = useState('demo123')
  const [loading, setLoading] = useState(false)
  const demoUsers = useMemo(() => demoDb.users.list(), [])

  const finalizeInviteIfNeeded = async () => {
    const token = getPendingInviteToken()
    if (!token) return '/dashboard'
    await settingsApi.acceptInvitation(token, email)
    clearPendingInviteToken()
    toast.success('Zaproszenie zaakceptowane', 'Konto zostało przypięte do właściwej firmy.')
    return '/settings'
  }

  return (
    <Card className="auth-card">
      <PageHeader title="Wejdź do LoftDesk" subtitle="Zaloguj się do aplikacji albo wybierz jedno z gotowych kont demonstracyjnych." />
      <div className="grid-2">
        <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Hasło" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <div className="field__label">Szybkie konta demo</div>
        <div className="actions-row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
          {demoUsers.map((user) => (
            <Button key={user.email} variant="secondary" onClick={() => { setEmail(user.email); setPassword(user.password) }}>
              {user.full_name} · {user.role}
            </Button>
          ))}
        </div>
      </div>
      <div className="actions-row">
        <Button
          loading={loading}
          onClick={async () => {
            try {
              setLoading(true)
              await authApi.signIn(email, password)
              signInDemo(email)
              const target = await finalizeInviteIfNeeded()
              toast.success('Zalogowano', 'Możesz od razu przejść do pracy w aplikacji.')
              window.location.assign(target)
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Sprawdź dane logowania.'
              toast.error('Nie udało się zalogować', message)
            } finally {
              setLoading(false)
            }
          }}
        >
          Zaloguj
        </Button>
        <Button variant="secondary" onClick={async () => { signInDemo(email); const target = await finalizeInviteIfNeeded(); window.location.assign(target) }}>Wejdź do demo</Button>
        <Button variant="ghost" onClick={() => { registerDemoCompany(email); toast.success('Utworzono demo-firmę', 'Nowa firma została zainicjowana w localStorage.'); window.location.assign('/dashboard') }}>Nowa firma demo</Button>
      </div>
    </Card>
  )
}
