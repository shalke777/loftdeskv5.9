import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import {
  getInviteRecords,
  updateInviteRecord,
  removeInviteTokens,
  hashToken,
  withInviteTimeout,
} from '@/shared/lib/inviteIntent'
import { settingsApi } from '@/features/settings/api/settings.api'
import { isDemoMode } from '@/shared/lib/supabase'

export function LoginForm() {
  const { signInDemo } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const finalizeInviteIfNeeded = async (): Promise<string> => {
    // Process both pending and previously-failed tokens (retry-on-login).
    const records = getInviteRecords().filter(r => r.status === 'pending' || r.status === 'failed')
    if (records.length === 0) return '/dashboard'

    let lastAcceptedCompanyId: string | null = null
    const succeeded = new Set<string>()
    for (const record of records) {
      const tHash = await hashToken(record.token)
      try {
        console.log('[invite] INVITE_ACCEPT_START', { tokenHash: tHash })
        void settingsApi.logInviteEvent('ACCEPT_START', tHash)
        const raw = await withInviteTimeout(settingsApi.acceptInvitation(record.token, email))
        // accept_company_invitation RPC returns company_id string; demo mode may return DemoUser
        const companyId = typeof raw === 'string' ? raw : null
        console.log('[invite] INVITE_ACCEPT_SUCCESS', { tokenHash: tHash })
        void settingsApi.logInviteEvent('ACCEPT_SUCCESS', tHash)
        succeeded.add(record.token)
        if (companyId) lastAcceptedCompanyId = companyId
      } catch (err) {
        const reason = (err as any)?.message ?? 'unknown'
        console.warn('[invite] INVITE_ACCEPT_FAIL', { tokenHash: tHash, reason })
        void settingsApi.logInviteEvent('ACCEPT_FAIL', tHash, reason)
        updateInviteRecord(record.token, { status: 'failed', failReason: reason })
      }
    }

    // Remove only succeeded tokens; keep failed ones for next-login retry.
    removeInviteTokens(succeeded)

    // Store switch hint so resolveSupabaseSession picks the invited company on page reload.
    if (lastAcceptedCompanyId && typeof window !== 'undefined') {
      localStorage.setItem('loftdesk-company-switch-hint', lastAcceptedCompanyId)
    }

    // Final membership verification — check for the invited company specifically.
    const { companyIds } = await settingsApi.verifyMembership()
    const isMember = companyIds.length > 0
    const isInvitedMember = lastAcceptedCompanyId
      ? companyIds.includes(lastAcceptedCompanyId)
      : isMember
    const tHash0 = records[0] ? await hashToken(records[0].token) : 'n/a'
    if (isInvitedMember) {
      void settingsApi.logInviteEvent('MEMBERSHIP_VERIFIED', tHash0)
    } else {
      void settingsApi.logInviteEvent('MEMBERSHIP_MISSING', tHash0)
    }

    if (succeeded.size > 0 && isInvitedMember) {
      toast.success('Zaproszenie zaakceptowane', 'Konto zostało przypięte do właściwej firmy.')
      return '/settings'
    }
    if (!isMember) return '/onboarding'
    return '/dashboard'
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
