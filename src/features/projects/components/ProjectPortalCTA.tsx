// =============================================================================
// ProjectPortalCTA — Operator zarządza portalem klienta dla projektu
// =============================================================================
// Stany:
//   loading → no_token → generating → new_token (+ invite form) → active_token
// Po wygenerowaniu tokenu operator może zaprosić klienta przez email bezpośrednio
// lub skopiować link. Status zaproszenia jest persystowany w localStorage.

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import {
  createProjectPortalToken,
  listProjectPortalTokens,
  revokeProjectPortalToken,
} from '@/features/portal/api/portal-project.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase, isDemoMode } from '@/shared/lib/supabase'

const IDENTIFY_ENDPOINT = '/.netlify/functions/client-identify'

function buildPortalUrl(rawToken: string) {
  return `${window.location.origin}/portal/${rawToken}`
}

// ── localStorage invite persistence ──────────────────────────────────────────

interface PersistedInvite {
  email: string
  status: 'sent' | 'failed'
  timestamp: string
  error?: string
}

function inviteKey(projectId: string) { return `portal-invite-${projectId}` }
function loadInvite(projectId: string): PersistedInvite | null {
  try { return JSON.parse(localStorage.getItem(inviteKey(projectId)) ?? 'null') } catch { return null }
}
function saveInvite(projectId: string, data: PersistedInvite) {
  try { localStorage.setItem(inviteKey(projectId), JSON.stringify(data)) } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  projectId:    string
  projectName?: string
}

export function ProjectPortalCTA({ projectId, projectName }: Props) {
  const companyId    = useCompanyId()
  const { user }     = useAuth()
  const queryClient  = useQueryClient()
  const [newRawToken, setNewRawToken] = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)

  // Invite form state
  const [inviteEmail,    setInviteEmail]    = useState('')
  const [inviteFullName, setInviteFullName] = useState('')
  const [inviteStatus,   setInviteStatus]   = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [inviteError,    setInviteError]    = useState<string | null>(null)
  const [lastInvite,     setLastInvite]     = useState<PersistedInvite | null>(() => loadInvite(projectId))

  // Reset invite state when projectId changes
  useEffect(() => {
    setLastInvite(loadInvite(projectId))
    setInviteStatus('idle')
    setInviteEmail('')
    setInviteFullName('')
    setInviteError(null)
  }, [projectId])

  useEffect(() => {
    console.info('CLIENT_PORTAL_OPEN', { projectId, projectName })
  }, [projectId, projectName])

  // Pobierz aktywne tokeny dla projektu
  const { data: tokens, isLoading } = useQuery({
    queryKey: ['portal-tokens', projectId],
    queryFn:  () => listProjectPortalTokens(projectId),
    staleTime: 30_000,
  })

  const activeToken = tokens?.find(t => t.active && !t.revoked_at && (!t.expires_at || new Date(t.expires_at) > new Date()))

  // Generowanie nowego tokenu
  const generate = useMutation({
    mutationFn: async () => {
      const result = await createProjectPortalToken({
        company_id:  companyId,
        project_id:  projectId,
        client_name: undefined,
      })
      if (!result) throw new Error('Nie udało się wygenerować linku portalu. Sprawdź konfigurację Supabase i Netlify.')
      return result
    },
    onSuccess: (result) => {
      setNewRawToken(result.raw_token)
      setInviteStatus('idle')
      setInviteEmail('')
      setInviteFullName('')
      setInviteError(null)
      queryClient.invalidateQueries({ queryKey: ['portal-tokens', projectId] })
      console.info('CLIENT_PORTAL_CREATE_SUCCESS', { projectId })
    },
  })

  // Unieważnienie tokenu
  const revoke = useMutation({
    mutationFn: async (tokenId: string) => {
      if (!supabase) return false
      const { data } = await supabase.auth.getSession()
      const jwt = data.session?.access_token
      if (!jwt) return false
      return revokeProjectPortalToken(tokenId, jwt)
    },
    onSuccess: () => {
      setNewRawToken(null)
      queryClient.invalidateQueries({ queryKey: ['portal-tokens', projectId] })
    },
  })

  async function handleInvite() {
    if (!inviteEmail.trim() || !newRawToken) return
    setInviteStatus('sending')
    setInviteError(null)
    console.info('CLIENT_PORTAL_INVITE_SUBMIT', { projectId, email: inviteEmail.trim() })
    try {
      const res = await fetch(IDENTIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token:     newRawToken,
          email:     inviteEmail.trim(),
          full_name: inviteFullName.trim() || undefined,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        const errMsg = json?.error ?? 'Nie udało się wysłać zaproszenia'
        setInviteStatus('failed')
        setInviteError(errMsg)
        const record: PersistedInvite = { email: inviteEmail.trim(), status: 'failed', timestamp: new Date().toISOString(), error: errMsg }
        saveInvite(projectId, record)
        setLastInvite(record)
        console.info('CLIENT_PORTAL_EMAIL_SEND_ERROR', { projectId, error: errMsg })
      } else {
        setInviteStatus('sent')
        const record: PersistedInvite = { email: inviteEmail.trim(), status: 'sent', timestamp: new Date().toISOString() }
        saveInvite(projectId, record)
        setLastInvite(record)
        console.info('CLIENT_PORTAL_EMAIL_SEND_SUCCESS', { projectId, email: inviteEmail.trim() })
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Błąd połączenia'
      setInviteStatus('failed')
      setInviteError(errMsg)
      const record: PersistedInvite = { email: inviteEmail.trim(), status: 'failed', timestamp: new Date().toISOString(), error: errMsg }
      saveInvite(projectId, record)
      setLastInvite(record)
      console.info('CLIENT_PORTAL_EMAIL_SEND_ERROR', { projectId, error: errMsg })
    }
  }

  function copyLink(rawToken: string) {
    const url = buildPortalUrl(rawToken)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Demo mode — portal wymaga prawdziwego Supabase + Netlify functions
  if (isDemoMode) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <h3 style={{ margin: 0 }}>Portal klienta</h3>
          <Badge variant="default">Tryb demo</Badge>
        </div>
        <p style={{ fontSize: 13, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
          Portal klienta działa tylko w trybie produkcyjnym (wymaga Supabase + Netlify).
        </p>
      </Card>
    )
  }

  if (isLoading) return <Spinner />

  // ── Nowo wygenerowany token — pokaż RAW TOKEN + formularz zaproszenia ────────
  if (newRawToken) {
    const url = buildPortalUrl(newRawToken)
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Portal klienta gotowy</h3>
          <Badge variant="success">Aktywny</Badge>
        </div>

        {/* Link box */}
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginBottom: 6 }}>
            ⚠️ Skopiuj link TERAZ — nie będzie widoczny po odświeżeniu strony
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#166534', wordBreak: 'break-all', userSelect: 'all' }}>
            {url}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <Button onClick={() => copyLink(newRawToken)}>{copied ? '✓ Skopiowano!' : 'Kopiuj link'}</Button>
          <Button variant="ghost" onClick={() => window.open(url, '_blank', 'noopener')}>Podgląd ↗</Button>
          <Button variant="ghost" onClick={() => setNewRawToken(null)}>Zamknij</Button>
        </div>

        {/* Invite section */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
            📧 Zaproś klienta przez email
          </div>

          {inviteStatus === 'sent' ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
                ✅ Zaproszenie wysłane na {inviteEmail}
              </div>
              <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.6 }}>
                Klient otrzyma email z linkiem logowania. Po kliknięciu linku zostanie zalogowany
                do Portalu klienta, gdzie zobaczy aktualizacje projektu, wiadomości
                i kosztorysy do akceptacji.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleInvite()}
                type="email"
                placeholder="Email klienta *"
                className="input"
                style={{ fontSize: 13, padding: '8px 12px' }}
                disabled={inviteStatus === 'sending'}
              />
              <input
                value={inviteFullName}
                onChange={e => setInviteFullName(e.target.value)}
                placeholder="Imię i nazwisko / nazwa (opcjonalnie)"
                className="input"
                style={{ fontSize: 13, padding: '8px 12px' }}
                disabled={inviteStatus === 'sending'}
              />
              {inviteStatus === 'failed' && inviteError && (
                <div style={{ fontSize: 12, color: 'var(--color-error, #dc2626)', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
                  ⚠️ {inviteError}{' '}
                  <button
                    style={{ background: 'none', border: 'none', color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12 }}
                    onClick={() => { setInviteStatus('idle'); setInviteError(null) }}
                  >
                    Spróbuj ponownie
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  onClick={() => void handleInvite()}
                  disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                  loading={inviteStatus === 'sending'}
                >
                  {inviteStatus === 'sending' ? 'Wysyłanie…' : '📧 Wyślij zaproszenie'}
                </Button>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  lub skopiuj link i wyślij samodzielnie
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>
    )
  }

  // ── Aktywny token istnieje ───────────────────────────────────────────────
  if (activeToken) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Portal klienta</h3>
            <p style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>
              {activeToken.client_name ? `Dostęp dla: ${activeToken.client_name}` : 'Link dostępu aktywny'}
            </p>
          </div>
          <Badge variant="success">Aktywny</Badge>
        </div>

        {activeToken.expires_at && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            Wygasa: {new Date(activeToken.expires_at).toLocaleString('pl-PL')}
          </p>
        )}

        {/* Show last invite status from localStorage */}
        {lastInvite && (
          <div style={{ marginBottom: 12 }}>
            {lastInvite.status === 'sent' ? (
              <div style={{ fontSize: 12, color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '8px 12px' }}>
                ✅ Zaproszony: {lastInvite.email} — {new Date(lastInvite.timestamp).toLocaleDateString('pl-PL')}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
                ⚠️ Poprzednie zaproszenie nie zostało wysłane ({lastInvite.error ?? 'błąd'})
                <br />Wygeneruj nowy link, aby spróbować ponownie.
              </div>
            )}
          </div>
        )}

        <div
          style={{
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 12,
            color: '#713f12',
            marginBottom: 12,
          }}
        >
          Link do portalu nie jest wyświetlany ponownie ze względów bezpieczeństwa.
          Jeśli klient potrzebuje nowego linku lub nie odebrał zaproszenia — wygeneruj nowy.
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            onClick={() => { generate.mutate(); console.info('CLIENT_PORTAL_RESEND_CLICK', { projectId }) }}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Generowanie…' : lastInvite?.status === 'failed' ? '🔄 Zaproś ponownie' : 'Generuj nowy link'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => revoke.mutate(activeToken.id)}
            disabled={revoke.isPending}
          >
            {revoke.isPending ? 'Unieważnianie…' : 'Unieważnij dostęp'}
          </Button>
        </div>

        {generate.isError && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-error, #dc2626)', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
            ⚠️ {(generate.error as Error)?.message ?? 'Błąd generowania linku.'}
          </div>
        )}
      </Card>
    )
  }

  // ── Brak aktywnego tokenu ────────────────────────────────────────────────
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Portal klienta</h3>
          <p style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>
            Udostępnij projekt klientowi przez bezpieczny link
          </p>
        </div>
        <Badge variant="default">Nieaktywny</Badge>
      </div>

      <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, marginBottom: 16 }}>
        Klient otrzyma dostęp do aktualizacji projektu, wiadomości, dokumentów i akceptacji kosztów.
        Nie zobaczy kosztów wewnętrznych, marży ani notatek firmowych.
      </p>

      <Button
        onClick={() => generate.mutate()}
        disabled={generate.isPending}
      >
        {generate.isPending ? 'Generowanie linku…' : '🔗 Uruchom portal klienta'}
      </Button>

      {generate.isError && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-error, #dc2626)', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
          ⚠️ {(generate.error as Error)?.message ?? 'Błąd generowania linku.'}
        </div>
      )}
    </Card>
  )
}
