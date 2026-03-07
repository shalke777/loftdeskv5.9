import { useMemo } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAcceptInvitation } from '@/features/settings/hooks/useSettings'
import { setPendingInviteToken } from '@/shared/lib/inviteIntent'

function readTokenFromPath() {
  if (typeof window === 'undefined') return ''
  const parts = window.location.pathname.split('/').filter(Boolean)
  return parts[1] || ''
}

export function AcceptInvitationPage() {
  const token = useMemo(() => readTokenFromPath(), [])
  const { user } = useAuth()
  const acceptInvitation = useAcceptInvitation()

  if (!token) {
    return (
      <main className="auth-shell">
        <Card className="auth-card">
          <PageHeader title="Zaproszenie" subtitle="Nie udało się odczytać tokenu zaproszenia." />
        </Card>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <PageHeader title="Dołącz do firmy" subtitle="Zaakceptuj zaproszenie do workspace'u LoftDesk i przypnij konto do właściwej firmy." />
        <p>Token: <code>{token}</code></p>
        {user ? (
          <>
            <p style={{ marginTop: 12 }}>Jesteś zalogowany jako <strong>{user.email}</strong>.</p>
            <div className="actions-row">
              <Button
                loading={acceptInvitation.isPending}
                onClick={() => acceptInvitation.mutate({ token, email: user.email }, { onSuccess: () => window.location.assign('/team') })}
              >
                Akceptuj i przejdź do zespołu
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ marginTop: 12 }}>Zaloguj się albo załóż konto na zaproszony e-mail. Token zostanie zapamiętany i możesz go zaakceptować po wejściu do panelu.</p>
            <div className="actions-row">
              <Button onClick={() => { setPendingInviteToken(token); window.location.assign('/login') }}>Przejdź do logowania</Button>
              <Button variant="secondary" onClick={() => { setPendingInviteToken(token); window.location.assign('/login') }}>Załóż konto i wróć</Button>
            </div>
          </>
        )}
      </Card>
    </main>
  )
}
