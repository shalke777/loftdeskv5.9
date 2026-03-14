import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { getPendingInviteToken, clearPendingInviteToken } from '@/shared/lib/inviteIntent'
import { settingsApi } from '@/features/settings/api/settings.api'

export function LoginForm() {
  const { signInDemo } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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
      <div style={{ display: 'grid', gap: 10 }}>
        <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="twoj@email.pl" />
        <Input label="Hasło" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div style={{ marginTop: 14 }}>
        <Button
          loading={loading}
          style={{ width: '100%' }}
          onClick={async () => {
            if (!email || !password) { toast.error('Uzupełnij dane', 'Podaj e-mail i hasło.'); return }
            try {
              setLoading(true)
              await authApi.signIn(email, password)
              signInDemo(email)
              const target = await finalizeInviteIfNeeded()
              toast.success('Zalogowano', 'Możesz od razu przejść do pracy w aplikacji.')
              window.location.assign(target)
            } catch (error) {
              toast.error('Nie udało się zalogować', translateError(error, 'Sprawdź dane logowania.'))
            } finally {
              setLoading(false)
            }
          }}
        >
          Zaloguj
        </Button>
      </div>
    </Card>
  )
}
