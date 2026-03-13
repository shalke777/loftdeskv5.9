// =============================================================================
// EstimateNextActions — panel "co dalej?" po wygenerowaniu wyceny
// =============================================================================
// Przepływ: Wycena → Portal klienta → Chat z klientem
//
// Jeśli wycena nie ma project_id → info o konieczności przypisania do projektu.
// Jeśli ma project_id → sekcja portalu (nowy model project_portal_tokens)
//                      + przycisk "Otwórz chat z klientem".

import { useState } from 'react'
import { ExternalLink, Link2, Mail, MessageSquare, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import {
  createProjectPortalToken,
  listProjectPortalTokens,
} from '@/features/portal/api/portal-project.api'
import { threadsApi } from '@/features/projects/api/threads.api'
import type { Estimate } from '@/entities/estimate/model'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── helper: clipboard ────────────────────────────────────────────────────────

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

// ─── Sub-komponenty ───────────────────────────────────────────────────────────

function NoProjectNotice() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--color-warning-bg, #fef9c3)',
        border: '1px solid var(--color-warning-border, #fde047)',
        fontSize: 13,
        color: 'var(--color-warning-text, #713f12)',
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Brak przypisanego projektu.</strong>
        {' '}Kliknij <em>→ Projekt</em> powyżej, aby przypisać wycenę do projektu i odblokować portal klienta oraz czat.
      </div>
    </div>
  )
}

// ─── Główny komponent ─────────────────────────────────────────────────────────

export function EstimateNextActions({ estimate }: { estimate: Estimate }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const projectId = estimate.project_id ?? null

  // ── Tokeny portalu (nowy model: project_portal_tokens) ─────────────────────
  const tokensQuery = useQuery({
    queryKey: ['project-portal-tokens', projectId],
    queryFn: () => listProjectPortalTokens(projectId!),
    enabled: Boolean(projectId),
  })

  const activeToken = tokensQuery.data?.find((t) => t.active) ?? null

  // raw_token nie jest przechowywany w DB (tylko token_hash).
  // Pełny URL jest dostępny tylko bezpośrednio po wygenerowaniu tokenu (w tej sesji).
  const [freshToken, setFreshToken] = useState<{ raw_token: string; id: string } | null>(null)
  const fullPortalUrl = freshToken
    ? `${window.location.origin}/portal/${freshToken.raw_token}`
    : null

  const createToken = useMutation({
    mutationFn: () =>
      createProjectPortalToken({
        company_id: user?.companyId ?? '',
        project_id: projectId!,
        client_name: estimate.name,
      }),
    onSuccess: (result) => {
      setFreshToken(result)
      queryClient.invalidateQueries({ queryKey: ['project-portal-tokens', projectId] })
      const url = `${window.location.origin}/portal/${result.raw_token}`
      copyText(url)
        .then(() => toast.success('Link portalu wygenerowany', 'Adres skopiowany do schowka.'))
        .catch(() => toast.success('Link portalu wygenerowany', 'Skopiuj adres ręcznie.'))
    },
    onError: (err) => {
      toast.error('Błąd generowania linku', translateError(err))
    },
  })

  // ── Czat z klientem ────────────────────────────────────────────────────────
  const [chatLoading, setChatLoading] = useState(false)

  const handleOpenChat = async () => {
    if (!projectId) return
    setChatLoading(true)
    try {
      const thread = await threadsApi.getOrCreateClientSharedThread(
        projectId,
        estimate.client_id,
        `Wycena ${estimate.number} – ${estimate.name}`,
        user?.companyId,
      )
      void navigate({ to: '/chat', search: { threadId: thread.id } })
    } catch (err) {
      toast.error('Błąd otwierania chatu', translateError(err))
    } finally {
      setChatLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <h3>Co dalej?</h3>
          <p className="field__label">{estimate.number} · {estimate.name}</p>
        </div>
      </div>

      {!projectId ? (
        <NoProjectNotice />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Sekcja portalu ─────────────────────────────────────────── */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              Portal klienta
              {activeToken && (
                <Badge variant="success" style={{ marginLeft: 8, fontSize: 11 }}>aktywny</Badge>
              )}
            </div>

            {fullPortalUrl ? (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  wordBreak: 'break-all',
                  background: 'var(--color-surface-alt, #f8fafc)',
                  padding: '6px 10px',
                  borderRadius: 7,
                  marginBottom: 8,
                  border: '1px solid var(--color-border-light)',
                }}
              >
                {fullPortalUrl}
              </div>
            ) : null}

            <div className="actions-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <Button
                variant="primary"
                icon={<Link2 size={15} />}
                loading={createToken.isPending}
                disabled={!user}
                onClick={() => createToken.mutate()}
              >
                {activeToken ? 'Generuj nowy link' : 'Generuj link portalu'}
              </Button>

              {fullPortalUrl ? (
                <>
                  <Button
                    variant="secondary"
                    icon={<Link2 size={15} />}
                    onClick={async () => {
                      try { await copyText(fullPortalUrl) } catch { /* ignore */ }
                      toast.info('Skopiowano link portalu')
                    }}
                  >
                    Kopiuj link
                  </Button>

                  {typeof navigator !== 'undefined' && 'share' in navigator ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigator.share({ title: `Wycena ${estimate.number}`, url: fullPortalUrl }).catch(() => {})
                      }
                    >
                      Wyślij
                    </Button>
                  ) : null}

                  <a href={fullPortalUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" icon={<ExternalLink size={15} />}>
                      Otwórz portal
                    </Button>
                  </a>

                  <Button
                    variant="secondary"
                    icon={<Mail size={15} />}
                    onClick={() => {
                      const subject = encodeURIComponent(`Dostęp do portalu: ${estimate.number} – ${estimate.name}`)
                      const body = encodeURIComponent(
                        `Dzień dobry,%0D%0A%0D%0Aotrzymujesz dostęp do portalu klienta:%0D%0A${fullPortalUrl}%0D%0A%0D%0APozdrawiam,%0D%0A${user?.fullName ?? ''}`,
                      )
                      window.location.href = `mailto:?subject=${subject}&body=${body}`
                    }}
                  >
                    Wyślij e-mailem
                  </Button>
                </>
              ) : null}
            </div>

            {!fullPortalUrl && activeToken ? (
              <p className="field__label" style={{ marginTop: 6 }}>
                Token aktywny w bazie — wygeneruj nowy link, aby uzyskać adres URL (poprzedni zostanie unieważniony).
              </p>
            ) : null}
          </div>

          {/* ── Sekcja czatu ────────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Chat z klientem</div>
            <p className="field__label" style={{ marginBottom: 8 }}>
              Otwórz wspólny wątek widoczny dla klienta przez portal.
            </p>
            <Button
              variant="secondary"
              icon={<MessageSquare size={15} />}
              loading={chatLoading}
              onClick={handleOpenChat}
            >
              Otwórz chat z klientem
            </Button>
          </div>

        </div>
      )}
    </Card>
  )
}
