// =============================================================================
// ProjectPortalCTA — Operator zaprasza kontrahenta do portalu projektu
// =============================================================================
// Phase 5: tokenless email-first invite
//   1. Operator wpisuje email + opcjonalną nazwę kontrahenta
//   2. Klik "Zaproś kontrahenta"
//   3. POST /.netlify/functions/client-identify
//      Authorization: Bearer <operator_jwt>
//      Body: { project_id, company_id, email, full_name? }
//   4. Backend: company_members check + project check + client_accounts upsert
//              + project_client_access upsert + magic link
//   5. Kontrahent dostaje email → /auth/callback?mode=client&project_id=... → /client/project/:id
//
// Brak tokenów URL, brak project_portal_tokens, jeden kanoniczny portal.

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { supabase, isDemoMode } from '@/shared/lib/supabase'

import { netlifyFn } from '@/shared/lib/functions'

const INVITE_ENDPOINT = netlifyFn('client-identify')

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
  const companyId = useCompanyId()

  const [email,      setEmail]      = useState('')
  const [fullName,   setFullName]   = useState('')
  const [status,     setStatus]     = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const [magicLink,  setMagicLink]  = useState<string | null>(null)
  const [emailSent,  setEmailSent]  = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [lastInvite, setLastInvite] = useState<PersistedInvite | null>(() => loadInvite(projectId))

  useEffect(() => {
    setLastInvite(loadInvite(projectId))
    setStatus('idle')
    setEmail('')
    setFullName('')
    setErrorMsg(null)
    setMagicLink(null)
    setEmailSent(false)
    setCopied(false)
  }, [projectId])

  useEffect(() => {
    if (import.meta.env.DEV) console.info('CLIENT_PORTAL_OPEN', { projectId, projectName })
  }, [projectId, projectName])

  const canUsePortal = useFeatureAccess('portal')
  const navigate = useNavigate()

  async function handleInvite() {
    if (!email.trim()) return
    setStatus('sending')
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
        setStatus('failed')
        setErrorMsg(msg)
        const rec: PersistedInvite = { email: email.trim(), status: 'failed', timestamp: new Date().toISOString(), error: msg }
        saveInvite(projectId, rec)
        setLastInvite(rec)
        if (import.meta.env.DEV) console.info('CLIENT_PORTAL_INVITE_ERROR', { projectId, error: msg })
      } else {
        setStatus('sent')
        setMagicLink(body?.magic_link ?? null)
        setEmailSent(body?.email_sent ?? false)
        const rec: PersistedInvite = { email: email.trim(), status: 'sent', timestamp: new Date().toISOString() }
        saveInvite(projectId, rec)
        setLastInvite(rec)
        if (import.meta.env.DEV) console.info('CLIENT_PORTAL_INVITE_SUCCESS', { projectId, email: email.trim(), has_link: !!body?.magic_link })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Błąd połączenia'
      setStatus('failed')
      setErrorMsg(msg)
      const rec: PersistedInvite = { email: email.trim(), status: 'failed', timestamp: new Date().toISOString(), error: msg }
      saveInvite(projectId, rec)
      setLastInvite(rec)
    }
  }

  // Plan gate — portal invite requires Pro/Business
  if (!canUsePortal) {
    return (
      <AccessNotice
        title="Portal klienta"
        description="Zapraszanie klientów do portalu projektu jest dostępne od planu Pro lub Business."
        actionLabel="Zmień plan"
        onAction={() => void navigate({ to: '/billing' })}
      />
    )
  }

  // Demo mode
  if (isDemoMode) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <h3 style={{ margin: 0 }}>Portal klienta</h3>
        </div>
        <p style={{ fontSize: 13, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
          Portal klienta działa tylko w trybie produkcyjnym (wymaga Supabase + Netlify).
        </p>
      </Card>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (status === 'sent') {
    async function copyLink() {
      if (!magicLink) return
      try {
        await navigator.clipboard.writeText(magicLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch {
        // fallback: select the text
      }
    }

    return (
      <Card>
        <h3 style={{ margin: '0 0 12px' }}>Portal klienta</h3>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
            ✅ Dostęp nadany dla {email}
          </div>
          {emailSent ? (
            <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.6 }}>
              📧 Email z linkiem logowania został wysłany automatycznie.
              Klient powinien go otrzymać w ciągu kilku minut.
            </p>
          ) : magicLink ? (
            <>
              <p style={{ fontSize: 13, color: '#166534', margin: '0 0 10px', lineHeight: 1.6 }}>
                Skopiuj link i wyślij do klienta (email, SMS, itp.).
                Link jest jednorazowy — po użyciu klient może logować się ponownie przez email.
              </p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <input
                  readOnly
                  value={magicLink}
                  style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac', background: '#fff', color: '#374151', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onFocus={e => e.currentTarget.select()}
                />
                <button
                  onClick={() => void copyLink()}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #16a34a', background: copied ? '#16a34a' : '#fff', color: copied ? '#fff' : '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                >
                  {copied ? '✓ Skopiowano' : 'Kopiuj'}
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.6 }}>
              Klient może zalogować się przez magic link na swój email.
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setStatus('idle'); setEmail(''); setMagicLink(null); setCopied(false); setEmailSent(false) }}>
          Wyślij kolejne zaproszenie
        </Button>
      </Card>
    )
  }

  // ── Invite form ───────────────────────────────────────────────────────────
  return (
    <Card>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Portal klienta</h3>
        <p style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>
          Zaproś kontrahenta emailem — otrzyma link logowania do portalu projektu
        </p>
      </div>

      <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, marginBottom: 16 }}>
        Klient otrzyma dostęp do aktualizacji projektu, wiadomości, dokumentów i akceptacji kosztów.
        Nie zobaczy kosztów wewnętrznych, marży ani notatek firmowych.
      </p>

      {/* Previous invite status */}
      {lastInvite && status === 'idle' && (
        <div style={{ marginBottom: 12 }}>
          {lastInvite.status === 'sent' ? (
            <div style={{ fontSize: 12, color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '8px 12px' }}>
              ✅ Poprzednio zaproszony: {lastInvite.email} — {new Date(lastInvite.timestamp).toLocaleDateString('pl-PL')}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
              ⚠️ Poprzednie zaproszenie nie zostało wysłane ({lastInvite.error ?? 'błąd'})
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleInvite()}
          type="email"
          placeholder="Email kontrahenta *"
          className="input"
          style={{ fontSize: 13, padding: '8px 12px' }}
          disabled={status === 'sending'}
        />
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Imię i nazwisko / nazwa (opcjonalnie)"
          className="input"
          style={{ fontSize: 13, padding: '8px 12px' }}
          disabled={status === 'sending'}
        />
        {status === 'failed' && errorMsg && (
          <div style={{ fontSize: 12, color: 'var(--color-error, #dc2626)', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
            ⚠️ {errorMsg}{' '}
            <button
              style={{ background: 'none', border: 'none', color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12 }}
              onClick={() => { setStatus('idle'); setErrorMsg(null) }}
            >
              Spróbuj ponownie
            </button>
          </div>
        )}
        <Button
          onClick={() => void handleInvite()}
          disabled={!email.trim() || status === 'sending'}
          loading={status === 'sending'}
        >
          {status === 'sending' ? 'Wysyłanie…' : '📧 Zaproś kontrahenta'}
        </Button>
      </div>
    </Card>
  )
}
