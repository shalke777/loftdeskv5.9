// =============================================================================
// EstimateNextActions — panel "co dalej?" po wygenerowaniu wyceny
// =============================================================================
// Przepływ: Wycena → Portal klienta → Chat z klientem
//
// Jeśli wycena nie ma project_id → info o konieczności przypisania do projektu.
// Jeśli ma project_id → link do zarządzania portalem w widoku Projektu
//                      + przycisk "Otwórz chat z klientem".
//
// Zaproszenia klientów do portalu są zarządzane wyłącznie z widoku Projektu
// (sekcja "Portal klienta" → ProjectPortalCTA). Generowanie tokenów /portal/:token
// z wyceny zostało wycofane w v5.9 — jedyną metodą zaproszenia jest magic link email.

import { useState } from 'react'
import { ExternalLink, MessageSquare, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { threadsApi } from '@/features/projects/api/threads.api'
import type { Estimate } from '@/entities/estimate/model'

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

  const projectId = estimate.project_id ?? null

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
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Portal klienta</div>
            <p className="field__label" style={{ marginBottom: 8 }}>
              Zaproś kontrahenta do portalu projektu — zarządzaj z widoku Projektu.
            </p>
            <Button
              variant="secondary"
              icon={<ExternalLink size={15} />}
              onClick={() => void navigate({ to: '/projects' })}
            >
              Otwórz projekt
            </Button>
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
