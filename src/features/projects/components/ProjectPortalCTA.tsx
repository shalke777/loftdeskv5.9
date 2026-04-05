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
import { threadsApi } from '@/features/projects/api/threads.api'
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
  const [openingChat,   setOpeningChat]  = useState(false)

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

  async function handleOpenMessages() {
    if (!access) return
    setOpeningChat(true)
    try {
      const thread = await threadsApi.getOrCreateClientSharedThread(
        projectId,
        access.clientAccountId,
        `Wiadomości z ${access.fullName || access.email}`,
        companyId ?? undefined,
      )
      void navigate({ to: '/chat', search: { threadId: thread.id } })
    } finally {
      setOpeningChat(false)
    }
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
        <p style={{ fontSize: 13, color: 'var(--color-accent)', background: 'rgba(212,150,10,0.15)', border: '1px solid rgba(212,150,10,0.30)', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
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
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sprawdzanie statusu…</p>
      </Card>
    )
  }

  // ── Sukces (właśnie nadano / ponownie wysłano dostęp) ─────────────────────
  if (mode === 'sent') {
    return (
      <Card>
        <h3 style={{ margin: '0 0 12px' }}>Dostęp klienta</h3>
        <div style={{ background: 'rgba(26,92,50,0.12)', border: '1px solid rgba(26,92,50,0.30)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: 'var(--color-brand)', marginBottom: 6 }}>
            ✅ Dostęp nadany — {email}
          </div>
          {emailSent ? (
            <p style={{ fontSize: 13, color: 'var(--color-brand)', margin: 0, lineHeight: 1.6 }}>
              📧 Email z linkiem logowania został wysłany automatycznie.
              Klient powinien go otrzymać w ciągu kilku minut.
            </p>
          ) : magicLink ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--color-brand)', margin: '0 0 10px', lineHeight: 1.6 }}>
                Skopiuj link i wyślij klientowi (email, SMS, WhatsApp).
                Link jest jednorazowy — po użyciu klient może logować się przez email.
              </p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <input
                  readOnly
                  value={magicLink}
                  style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(26,92,50,0.30)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onFocus={e => e.currentTarget.select()}
                />
                <button
                  onClick={() => void copyLink()}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-brand)', background: copied ? 'var(--color-brand)' : 'var(--color-surface)', color: copied ? '#fff' : 'var(--color-brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                >
                  {copied ? '✓ Skopiowano' : 'Kopiuj'}
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-brand)', margin: 0 }}>
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

  // ── Ma dostęp (wysłany lub aktywny) ──────────────────────────────────────
  if (access && mode === 'view') {
    const since = new Date(access.grantedAt).toLocaleDateString('pl-PL')
    const isActive  = access.hasLoggedIn
    const statusColor  = isActive  ? 'var(--color-brand)' : 'var(--color-accent)'
    const statusBg     = isActive  ? 'rgba(26,92,50,0.08)' : 'rgba(212,150,10,0.10)'
    const statusBorder = isActive  ? 'rgba(26,92,50,0.25)' : 'rgba(212,150,10,0.30)'
    const statusLabel  = isActive  ? 'Klient ma aktywny dostęp' : 'Dostęp wysłany'
    const statusIcon   = isActive  ? '🟢' : '🟡'
    const contextLine  = isActive
      ? 'Klient może otwierać dokumenty, odpowiadać na zatwierdzenia i pisać wiadomości.'
      : 'Link dostępowy został wysłany. Klient jeszcze nie zalogował się do portalu.'

    return (
      <Card>
        <h3 style={{ margin: '0 0 14px' }}>Dostęp klienta</h3>

        {/* A. Klient */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Klient</p>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {access.fullName || access.email}
          </div>
          {access.fullName && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{access.email}</div>
          )}
        </div>

        {/* B + C. Status dostępu + meta */}
        <div style={{ background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: statusColor, marginBottom: 4 }}>
            {statusIcon} {statusLabel}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Wysłano: {since}
          </div>
        </div>

        {/* E. Kontekst operacyjny */}
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
          {contextLine}
        </p>

        {/* D. Akcje — dwa warianty zależne od stanu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isActive ? (
            /* 🟢 Klient ma aktywny dostęp — główne CTA: Otwórz wiadomości */
            <>
              <Button
                loading={openingChat}
                onClick={() => void handleOpenMessages()}
              >
                Otwórz wiadomości
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openInviteForm(access.email, access.fullName ?? undefined)}
              >
                Wyślij ponownie dostęp
              </Button>
            </>
          ) : (
            /* 🟡 Dostęp wysłany — główne CTA: Wyślij ponownie */
            <Button
              variant="secondary"
              onClick={() => openInviteForm(access.email, access.fullName ?? undefined)}
            >
              Wyślij ponownie dostęp
            </Button>
          )}

          {/* Cofnij dostęp — zawsze dostępne jako pomocnicze */}
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
                style={{ color: 'var(--color-danger, var(--color-error))' }}
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
  const knownClient = !isReInvite && (clientName || clientEmail)

  return (
    <Card>
      <h3 style={{ margin: '0 0 14px' }}>Dostęp klienta</h3>

      {/* A. Klient — jeśli znany z projektu */}
      {knownClient && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Klient</p>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {clientName || clientEmail}
          </div>
          {clientName && clientEmail && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{clientEmail}</div>
          )}
        </div>
      )}

      {/* B. Status */}
      {!isReInvite && (
        <div style={{ background: 'rgba(167,171,179,0.10)', border: '1px solid rgba(167,171,179,0.20)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
            ⚪ Brak dostępu
          </div>
        </div>
      )}

      {isReInvite && (
        <button
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer', padding: '0 0 10px', textDecoration: 'underline', display: 'block' }}
          onClick={() => setMode('view')}
        >
          ← Wróć
        </button>
      )}

      {/* E. Kontekst */}
      {!isReInvite && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 12px' }}>
          Klient otrzyma dostęp do dokumentów, wiadomości, sekcji Do zatwierdzenia i osi czasu.
          Nie zobaczy kosztów wewnętrznych ani notatek firmowych.
        </p>
      )}

      {/* D. Formularz */}
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
          <div style={{ fontSize: 12, color: 'var(--color-error, var(--color-error))', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 6, padding: '8px 12px' }}>
            ⚠️ {errorMsg}{' '}
            <button
              style={{ background: 'none', border: 'none', color: 'var(--color-error)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12 }}
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
