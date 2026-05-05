import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { getPendingInviteToken, clearPendingInviteToken } from '@/shared/lib/inviteIntent'
import { settingsApi } from '@/features/settings/api/settings.api'
import { isDemoMode } from '@/shared/lib/supabase'

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
      <PageHeader title="Wejdź do LoftDesk" subtitle="Zaloguj się do swojego konta firmowego." />
      <div className="grid-2">
        <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="twoj@email.pl" />
        <Input label="Hasło" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="actions-row" style={{ justifyContent: 'center' }}>
        <Button
          loading={loading}
          onClick={async () => {
            if (!email || !password) { toast.error('Uzupełnij dane', 'Podaj e-mail i hasło.'); return }
            try {
              setLoading(true)
              await authApi.signIn(email, password)
              if (isDemoMode) signInDemo(email)
              // Isolate invite finalization — a failed/expired invite must not
              // surface as a login failure since sign-in already succeeded.
              let target = '/dashboard'
              try {
                target = await finalizeInviteIfNeeded()
              } catch {
                // invite accept failed (expired/not found) — proceed to dashboard
              }
              toast.success('Zalogowano', 'Możesz od razu przejść do pracy w aplikacji.')
              window.location.assign(target)
            } catch (error) {
              // Full diagnostic log — helps trace auth issues across environments
              console.error('[LoginForm] signInWithPassword failed', {
                code:    (error as any)?.code,
                status:  (error as any)?.status,
                message: (error as any)?.message,
                name:    (error as any)?.name,
              })
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
