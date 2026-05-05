import { useEffect, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { setPendingInviteToken } from '@/shared/lib/inviteIntent'
import { settingsApi } from '@/features/settings/api/settings.api'
import { translateError } from '@/shared/lib/errorMessages'

function readTokenFromPath() {
  if (typeof window === 'undefined') return ''
  const parts = window.location.pathname.split('/').filter(Boolean)
  return parts[1] || ''
}

type AcceptState = 'idle' | 'accepting' | 'success' | 'error'

export function AcceptInvitationPage() {
  const token = readTokenFromPath()
  const { user, refreshSession } = useAuth()
  const [state, setState] = useState<AcceptState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Auto-accept as soon as the user session is available.
  // This covers: user already logged in + user who just completed login/register.
  useEffect(() => {
    if (!token || !user || state !== 'idle') return

    let cancelled = false
    const run = async () => {
      setState('accepting')
      try {
        await settingsApi.acceptInvitation(token)
        if (cancelled) return
        await refreshSession()
        if (cancelled) return
        setState('success')
        // Give session a tick to propagate, then navigate to dashboard.
        setTimeout(() => window.location.assign('/dashboard'), 800)
      } catch (err) {
        if (cancelled) return
        const msg = translateError(err, 'Nie udało się zaakceptować zaproszenia.')
        setErrorMsg(msg)
        setState('error')
      }
    }

    void run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id])

  if (!token) {
    return (
      <main className="auth-shell">
        <Card className="auth-card">
          <PageHeader title="Zaproszenie" subtitle="Nie udało się odczytać tokenu zaproszenia." />
        </Card>
      </main>
    )
  }

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="auth-shell">
        <Card className="auth-card">
          <PageHeader title="Dołącz do firmy" subtitle="Zaloguj się lub załóż konto na zaproszony e-mail. Zaproszenie zostanie zaakceptowane automatycznie po zalogowaniu." />
          <div className="actions-row">
            <Button onClick={() => { setPendingInviteToken(token); window.location.assign('/login') }}>
              Zaloguj się
            </Button>
            <Button variant="secondary" onClick={() => { setPendingInviteToken(token); window.location.assign('/register') }}>
              Załóż konto
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  // ── Accepting (auto, user is logged in) ─────────────────────────────────
  if (state === 'accepting' || state === 'idle') {
    return (
      <main className="auth-shell">
        <Card className="auth-card">
          <PageHeader title="Dołączanie do zespołu…" subtitle={`Łączę konto ${user.email} z firmą. Poczekaj chwilę.`} />
        </Card>
      </main>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <main className="auth-shell">
        <Card className="auth-card">
          <PageHeader title="✅ Dołączyłeś do zespołu" subtitle="Przekierowuję do dashboardu…" />
        </Card>
      </main>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <PageHeader title="Nie udało się dołączyć" subtitle={errorMsg} />
        <div className="actions-row">
          <Button variant="secondary" onClick={() => window.location.assign('/dashboard')}>
            Przejdź do dashboardu
          </Button>
        </div>
      </Card>
    </main>
  )
}
