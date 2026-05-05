import { useEffect, useRef, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { addPendingInviteToken, hashToken, withInviteTimeout } from '@/shared/lib/inviteIntent'
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
  // Guard: prevent double-accept from React StrictMode double-invoke or
  // multiple tabs landing on the same /join/<token> URL simultaneously.
  const acceptingRef = useRef(false)

  // Auto-accept as soon as the user session is available.
  // This covers: user already logged in + user who just completed login/register.
  useEffect(() => {
    if (!token || !user || state !== 'idle') return
    if (acceptingRef.current) return
    acceptingRef.current = true

    let cancelled = false
    const run = async () => {
      const tHash = await hashToken(token)
      setState('accepting')
      console.log('[invite] INVITE_ACCEPT_START', { tokenHash: tHash, userId: user.id })
      void settingsApi.logInviteEvent('ACCEPT_START', tHash)
      try {
        await withInviteTimeout(settingsApi.acceptInvitation(token))
        if (cancelled) return
        // refreshSession propagates new company_id into React auth context.
        await refreshSession()
        if (cancelled) return
        // Direct DB check — do not rely solely on refreshSession().
        const { isMember } = await settingsApi.verifyMembership()
        if (cancelled) return
        if (!isMember) {
          void settingsApi.logInviteEvent('MEMBERSHIP_MISSING', tHash)
          console.warn('[invite] MEMBERSHIP_MISSING after accept', { tokenHash: tHash })
          setErrorMsg('Przyjęcie zaproszenia się nie powiodło — konto nie zostało dodane do firmy. Spróbuj ponownie lub skontaktuj się z administratorem firmy.')
          setState('error')
          acceptingRef.current = false
          return
        }
        void settingsApi.logInviteEvent('ACCEPT_SUCCESS', tHash)
        console.log('[invite] INVITE_ACCEPT_SUCCESS', { tokenHash: tHash, userId: user.id })
        setState('success')
        setTimeout(() => window.location.assign('/dashboard'), 800)
      } catch (err) {
        if (cancelled) return
        const reason = (err as any)?.message ?? 'unknown'
        console.warn('[invite] INVITE_ACCEPT_FAIL', { tokenHash: tHash, userId: user.id, reason })
        void settingsApi.logInviteEvent('ACCEPT_FAIL', tHash, reason)
        const msg = translateError(err, 'Nie udało się zaakceptować zaproszenia.')
        setErrorMsg(msg)
        setState('error')
        acceptingRef.current = false
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
            <Button onClick={() => { addPendingInviteToken(token); window.location.assign('/login') }}>
              Zaloguj się
            </Button>
            <Button variant="secondary" onClick={() => { addPendingInviteToken(token); window.location.assign('/register') }}>
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
          <Button onClick={() => window.location.assign('/onboarding')}>
            Utwórz własną firmę
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign('/dashboard')}>
            Przejdź do dashboardu
          </Button>
        </div>
      </Card>
    </main>
  )
}
