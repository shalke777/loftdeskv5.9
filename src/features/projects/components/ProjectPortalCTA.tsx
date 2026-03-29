// =============================================================================
// ProjectPortalCTA — Operator zarządza dostępem klienta do portalu projektu
// =============================================================================
// Kanoniczny flow:
//   1. Operator widzi status: Brak dostępu | Ma dostęp (email, od kiedy)
//   2. Brak dostępu → formularz z email pre-filled z project.client_id
//   3. "Udostępnij projekt klientowi" → POST /.netlify/functions/client-identify
//   4. Ma dostęp → "Wyślij ponownie dostęp" | "Cofnij dostęp"
//   5. Cofnięcie → usuwa project_client_access → powrót do formularza

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { supabase, isDemoMode } from '@/shared/lib/supabase'
import { netlifyFn } from '@/shared/lib/functions'
import { useProjectPortalAccess, useRevokeProjectAccess } from '@/features/portal/hooks/usePortalData'

const INVITE_ENDPOINT = netlifyFn('client-identify')

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  projectId:    string
  projectName?: string
  clientId?:    string | null
  clientEmail?: string | null
  clientName?:  string | null
}

type Mode = 'view' | 'invite' | 'sending' | 'sent' | 'failed'

export function ProjectPortalCTA({ projectId, clientEmail, clientName }: Props) {
  const companyId    = useCompanyId()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const canUsePortal = useFeatureAccess('portal')

  const { data: access, isLoading } = useProjectPortalAccess(projectId)
  const revoke = useRevokeProjectAccess(projectId)

  const [mode,          setMode]         = useState<Mode>('view')
  const [email,         setEmail]        = useState('')
  const [fullName,      setFullName]     = useState('')
  const [errorMsg,      setErrorMsg]     = useState<string | null>(null)
  const [magicLink,     setMagicLink]    = useState<string | null>(null)
  const [emailSent,     setEmailSent]    = useState(false)
  const [copied,        setCopied]       = useState(false)
  const [revokeConfirm, setRevokeConfirm] = useState(false)

  const didPrefill = useRef(false)

  // Reset on project change
  useEffect(() => {
    setMode('view')
    setEmail('')
    setFullName('')
    setErrorMsg(null)
    setMagicLink(null)
    setEmailSent(false)
    setCopied(false)
    setRevokeConfirm(false)
    didPrefill.current = false
  }, [projectId])

  // Pre-fill email/name from linked client when no existing access
  useEffect(() => {
    if (!isLoading && !access && !didPrefill.current && (clientEmail || clientName)) {
      didPrefill.current = true
      setEmail(clientEmail ?? '')
      setFullName(clientName ?? '')
    }
  }, [isLoading, access, clientEmail, clientName])

  function openInviteForm(preEmail?: string, preName?: string) {
    setEmail(preEmail ?? clientEmail ?? '')
    setFullName(preName ?? clientName ?? '')
    setMode('invite')
    setErrorMsg(null)
    setMagicLink(null)
    setEmailSent(false)
    setCopied(false)
  }

  async function handleInvite() {
    if (!email.trim()) return
    setMode('sending')
    setErrorMsg(null)
    if (import.meta.env.DEV) console.info('CLIENT_PORTAL_INVITE_SUBMIT', { projectId, email: email.trim() })

    try {
      if (!supabase) throw new Error('Klient Supabase nie jest zainicjowany')

      const { data: sessionData } = await supabase.auth.getSession()
      let jwt = sessionData.session?.access_token
      const expiresAt = (sessionData.session?.expires_at ?? 0) * 1000
      if (!jwt || Date.now() >= expiresAt - 15_000) {
        const { data: fresh, error: refreshErr } = await supabase.auth.refreshSession()
        if (refreshErr || !fresh.session?.access_token) {
          throw new Error('Brak aktywnej sesji — zaloguj się ponownie')
        }
        jwt = fresh.session.access_token
      }

      const res = await fetch(INVITE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          company_id: companyId,
          email:      email.trim(),
          full_name:  fullName.trim() || undefined,
        }),
      })

      const body = await res.json() as { ok?: boolean; error?: string; magic_link?: string; email_sent?: boolean }

      if (!res.ok) {
        const msg = body?.error ?? 'Nie udało się wysłać zaproszenia'
        setMode('failed')
        setErrorMsg(msg)
      } else {
        setMagicLink(body?.magic_link ?? null)
        setEmailSent(body?.email_sent ?? false)
        setMode('sent')
        void queryClient.invalidateQueries({ queryKey: ['portal', 'project-access', projectId] })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Błąd połączenia'
      setMode('failed')
      setErrorMsg(msg)
    }
  }

  async function copyLink() {
    if (!magicLink) return
    try {
      await navigator.clipboard.writeText(magicLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  async function handleRevoke() {
    if (!access) return
    await revoke.mutateAsync(access.id)
    setRevokeConfirm(false)
    setMode('view')
  }

  // ── Plan gate ─────────────────────────────────────────────────────────────
  if (!canUsePortal) {
    return (
      <AccessNotice
        title="Dostęp klienta"
        description="Udostępnianie projektu klientowi jest dostępne od planu Pro lub Business."
        actionLabel="Zmień plan"
        onAction={() => void navigate({ to: '/billing' })}
      />
    )
  }

  // ── Demo mode ─────────────────────────────────────────────────────────────
  if (isDemoMode) {
    return (
      <Card>
        <h3 style={{ margin: '0 0 8px' }}>Dostęp klienta</h3>
        <p style={{ fontSize: 13, color: '#D4960A', background: 'rgba(212,150,10,0.15)', border: '1px solid rgba(212,150,10,0.30)', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
          Portal klienta działa tylko w trybie produkcyjnym (wymaga Supabase + Netlify).
        </p>
      </Card>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card>
        <h3 style={{ margin: '0 0 8px' }}>Dostęp klienta</h3>
        <p style={{ fontSize: 13, color: '#A7ABB3' }}>Sprawdzanie statusu…</p>
      </Card>
    )
  }

  // ── Sukces (właśnie nadano / ponownie wysłano dostęp) ─────────────────────
  if (mode === 'sent') {
    return (
      <Card>
        <h3 style={{ margin: '0 0 12px' }}>Dostęp klienta</h3>
        <div style={{ background: 'rgba(119,186,138,0.12)', border: '1px solid rgba(119,186,138,0.30)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: '#77BA8A', marginBottom: 6 }}>
            ✅ Dostęp nadany — {email}
          </div>
          {emailSent ? (
            <p style={{ fontSize: 13, color: '#77BA8A', margin: 0, lineHeight: 1.6 }}>
              📧 Email z linkiem logowania został wysłany automatycznie.
              Klient powinien go otrzymać w ciągu kilku minut.
            </p>
          ) : magicLink ? (
            <>
              <p style={{ fontSize: 13, color: '#77BA8A', margin: '0 0 10px', lineHeight: 1.6 }}>
                Skopiuj link i wyślij klientowi (email, SMS, WhatsApp).
                Link jest jednorazowy — po użyciu klient może logować się przez email.
              </p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <input
                  readOnly
                  value={magicLink}
                  style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(119,186,138,0.30)', background: 'var(--color-surface)', color: '#D0D4DA', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onFocus={e => e.currentTarget.select()}
                />
                <button
                  onClick={() => void copyLink()}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #77BA8A', background: copied ? '#77BA8A' : 'var(--color-surface)', color: copied ? '#fff' : '#77BA8A', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                >
                  {copied ? '✓ Skopiowano' : 'Kopiuj'}
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: '#77BA8A', margin: 0 }}>
              Klient może zalogować się przez magic link na swój email.
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMode('view')}>
          Gotowe
        </Button>
      </Card>
    )
  }

  // ── Ma dostęp ─────────────────────────────────────────────────────────────
  if (access && mode === 'view') {
    const since = new Date(access.grantedAt).toLocaleDateString('pl-PL')
    return (
      <Card>
        <h3 style={{ margin: '0 0 12px' }}>Dostęp klienta</h3>
        <div style={{ background: 'rgba(119,186,138,0.08)', border: '1px solid rgba(119,186,138,0.25)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: '#77BA8A', fontSize: 13, marginBottom: 4 }}>
            🔐 Ma dostęp
          </div>
          <div style={{ fontSize: 13, color: '#C0C4CC' }}>
            {access.fullName ? `${access.fullName} · ` : ''}{access.email}
          </div>
          <div style={{ fontSize: 11, color: '#8A8F98', marginTop: 4 }}>
            dostęp od {since}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openInviteForm(access.email, access.fullName ?? undefined)}
          >
            Wyślij ponownie dostęp
          </Button>
          {!revokeConfirm ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevokeConfirm(true)}
            >
              Cofnij dostęp
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                style={{ color: 'var(--color-danger, #EF6B6B)' }}
                loading={revoke.isPending}
                onClick={() => void handleRevoke()}
              >
                Potwierdź cofnięcie
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRevokeConfirm(false)}
              >
                Anuluj
              </Button>
            </div>
          )}
        </div>
      </Card>
    )
  }

  // ── Brak dostępu / formularz zaproszenia ──────────────────────────────────
  // mode=view (brak dostępu) | mode=invite (re-invite) | mode=sending | mode=failed
  const isReInvite = mode === 'invite' || (mode !== 'view' && Boolean(access))

  return (
    <Card>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Dostęp klienta</h3>
        {!isReInvite && (
          <p style={{ fontSize: 13, color: '#A7ABB3', marginTop: 4 }}>
            Udostępnij projekt klientowi — otrzyma link logowania do portalu
          </p>
        )}
      </div>

      {!isReInvite && (
        <p style={{ fontSize: 13, color: '#C0C4CC', lineHeight: 1.6, marginBottom: 16 }}>
          Klient otrzyma dostęp do dokumentów, wiadomości, sekcji Do zatwierdzenia i osi czasu.
          Nie zobaczy kosztów wewnętrznych, marży ani notatek firmowych.
        </p>
      )}

      {isReInvite && (
        <button
          style={{ background: 'none', border: 'none', color: '#8A8F98', fontSize: 12, cursor: 'pointer', padding: '0 0 10px', textDecoration: 'underline', display: 'block' }}
          onClick={() => setMode('view')}
        >
          ← Wróć
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleInvite()}
          type="email"
          placeholder="Email klienta *"
          className="input"
          style={{ fontSize: 13, padding: '8px 12px' }}
          disabled={mode === 'sending'}
        />
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Imię i nazwisko / nazwa (opcjonalnie)"
          className="input"
          style={{ fontSize: 13, padding: '8px 12px' }}
          disabled={mode === 'sending'}
        />
        {mode === 'failed' && errorMsg && (
          <div style={{ fontSize: 12, color: 'var(--color-error, #EF6B6B)', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 6, padding: '8px 12px' }}>
            ⚠️ {errorMsg}{' '}
            <button
              style={{ background: 'none', border: 'none', color: '#EF6B6B', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12 }}
              onClick={() => { setMode(isReInvite ? 'invite' : 'view'); setErrorMsg(null) }}
            >
              Spróbuj ponownie
            </button>
          </div>
        )}
        <Button
          onClick={() => void handleInvite()}
          disabled={!email.trim() || mode === 'sending'}
          loading={mode === 'sending'}
        >
          {mode === 'sending' ? 'Wysyłanie…' : isReInvite ? 'Wyślij ponownie dostęp' : 'Udostępnij projekt klientowi'}
        </Button>
      </div>
    </Card>
  )
}
