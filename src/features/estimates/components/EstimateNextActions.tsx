// =============================================================================
// EstimateNextActions — panel "co dalej?" po wygenerowaniu wyceny
// =============================================================================
// Przepływ: Wycena → Wyślij e-mailem do klienta (auto-link) → Chat
//
// Jeśli wycena nie ma project_id → info o konieczności przypisania do projektu.
// Jeśli ma project_id → "Wyślij wycenę e-mailem" (SendToClientModal)
//                      + "Otwórz chat z klientem"
//
// UWAGA: project_portal_tokens zostały usunięte w migracji 051.
// Dostęp klienta jest teraz zarządzany wyłącznie przez Supabase magic link
// generowany przez /.netlify/functions/send-document (gdy project_id podane).

import { useState } from 'react'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { threadsApi } from '@/features/projects/api/threads.api'
import type { Estimate } from '@/entities/estimate/model'
import { useClients } from '@/features/clients/hooks/useClients'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'

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
        {' '}Kliknij <em>→ Projekt</em> powyżej, aby przypisać wycenę do projektu i odblokować wysyłkę do klienta oraz czat.
      </div>
    </div>
  )
}

// ─── Główny komponent ─────────────────────────────────────────────────────────

export function EstimateNextActions({ estimate }: { estimate: Estimate }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: clients = [] } = useClients()
  const client = clients.find((c) => c.id === estimate.client_id)

  const [sendOpen, setSendOpen] = useState(false)

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
        `Wycena ${estimate.number} \u2013 ${estimate.name}`,
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
    <>
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

          {/* ── Wyślij wycenę do klienta ──────────────────────────────── */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Wyślij wycenę klientowi</div>
            <p className="field__label" style={{ marginBottom: 8 }}>
              Klient otrzyma email z przyciskiem dostępu do portalu projektu. Link jest generowany automatycznie.
            </p>
            <Button onClick={() => setSendOpen(true)}>
              Wyślij e-mailem
            </Button>
          </div>

          {/* ── Chat z klientem ────────────────────────────────────────── */}
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

    <SendToClientModal
      open={sendOpen}
      onClose={() => setSendOpen(false)}
      documentType="estimate"
      documentName={`${estimate.number} \u2013 ${estimate.name}`}
      defaultEmail={client?.email}
      projectId={projectId ?? undefined}
      companyId={estimate.company_id}
    />
    </>
  )
}

