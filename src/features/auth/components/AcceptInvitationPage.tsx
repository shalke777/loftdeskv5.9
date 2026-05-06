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
  // retryCount increments when the user clicks "Spróbuj ponownie" —
  // adding it to the effect deps re-triggers the accept attempt.
  const [retryCount, setRetryCount] = useState(0)
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
    let acceptedCompanyId: string | null = null
    const run = async () => {
      const tHash = await hashToken(token)
      setState('accepting')
      console.log('[invite] INVITE_ACCEPT_START', { tokenHash: tHash, userId: user.id })
      void settingsApi.logInviteEvent('ACCEPT_START', tHash)
      try {
        // accept_company_invitation RPC returns the invited company_id (string).
        // In demo mode it may return a DemoUser object — treat non-string as null.
        const raw = await withInviteTimeout(settingsApi.acceptInvitation(token))
        acceptedCompanyId = (typeof raw === 'string' ? raw : null)
        if (cancelled) return
        console.log('[invite] accepted company:', acceptedCompanyId)
        // refreshSession propagates new company_id into React auth context.
        // DB is source of truth — newest membership wins via ORDER BY created_at DESC.
        await refreshSession()
        if (cancelled) return
        // Defensive 100ms wait before membership verification — JWT/RLS
        // propagation race after refreshSession on some Supabase regions.
        await new Promise((r) => setTimeout(r, 100))
        if (cancelled) return
        // Direct DB check — verify membership in the INVITED company specifically.
        const { companyIds } = await settingsApi.verifyMembership()
        if (cancelled) return
        const isInvitedMember = acceptedCompanyId
          ? companyIds.includes(acceptedCompanyId)
          : companyIds.length > 0
        if (!isInvitedMember) {
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
        setTimeout(() => window.location.assign('/dashboard'), 100)
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
  }, [token, user?.id, retryCount])

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
          <Button onClick={() => { setState('idle'); acceptingRef.current = false; setRetryCount(c => c + 1) }}>
            Spróbuj ponownie
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign('/dashboard')}>
            Przejdź do dashboardu
          </Button>
        </div>
      </Card>
    </main>
  )
}
