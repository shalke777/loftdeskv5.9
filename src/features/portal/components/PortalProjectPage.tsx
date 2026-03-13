// =============================================================================
// PortalProjectPage — główna strona portalu klienta (Etap 2)
// =============================================================================
// Trasa: /portal/:token   (publiczna, bez auth)
// Token pochodzi z URL params, wstrzyknięty przez PortalTokenRoutePage.
//
// Przepływ sesji:
//   1. rawToken z URL → usePortalSession → validatePortalToken (Netlify function)
//   2. Netlify function: SHA-256(rawToken) → lookup project_portal_tokens
//      → jeśli ok: INSERT project_portal_sessions → zwraca { session_id, ... }
//   3. session_id jest zapisywany w localStorage (klucz = portal_session_<token[0:16]>)
//   4. Wszystkie RPC calls używają session_id jako p_session_id
//   5. SECURITY DEFINER functions (migr. 035) walidują sesję wewnątrz bazy
//
// Zakładki:
//   - Aktualizacje (PortalUpdatesTab) — project_timeline_events, visibility=client_shared
//   - Wiadomości   (PortalMessagesTab) — project_messages, visibility=client_shared
//   - Dokumenty    (PortalDocumentsTab) — placeholder TODO Etap 3
//   - Akceptacje   (PortalApprovalsTab) — cost_approvals z odpowiedziami klienta

import { useState } from 'react'
import { usePortalSession } from '@/features/portal/hooks/usePortalSession'
import { PortalLoading }      from '@/features/portal/components/PortalLoading'
import { PortalInvalid }      from '@/features/portal/components/PortalInvalid'
import { PortalExpired }      from '@/features/portal/components/PortalExpired'
import { PortalRevoked }      from '@/features/portal/components/PortalRevoked'
import { PortalUpdatesTab }   from '@/features/portal/components/PortalUpdatesTab'
import { PortalMessagesTab }  from '@/features/portal/components/PortalMessagesTab'
import { PortalDocumentsTab } from '@/features/portal/components/PortalDocumentsTab'
import { PortalApprovalsTab } from '@/features/portal/components/PortalApprovalsTab'
import { Badge } from '@/shared/ui/Badge/Badge'

type TabKey = 'updates' | 'messages' | 'documents' | 'approvals'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'updates',   label: 'Aktualizacje' },
  { key: 'messages',  label: 'Wiadomości' },
  { key: 'documents', label: 'Dokumenty' },
  { key: 'approvals', label: 'Akceptacje' },
]

const STATUS_LABEL: Record<string, string> = {
  offer:      'Wycena',
  active:     'W realizacji',
  done:       'Zakończony',
  cancelled:  'Anulowany',
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  offer:     'default',
  active:    'warning',
  done:      'success',
  cancelled: 'danger',
}

interface Props {
  /** rawToken z URL — wstrzykiwany przez PortalTokenRoutePage */
  token: string
}

export function PortalProjectPage({ token }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('updates')
  const { status, session, revalidate } = usePortalSession(token)

  if (status === 'loading')  return <PortalLoading />
  if (status === 'expired')  return <PortalExpired />
  if (status === 'revoked')  return <PortalRevoked />
  if (status === 'error') {
    return (
      <div className="portal-page" style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ textAlign: 'center', padding: '40px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px' }}>Problem z po\u0142\u0105czeniem</h3>
          <p style={{ color: '#718096', lineHeight: 1.6, marginBottom: 16 }}>
            Nie uda\u0142o si\u0119 sprawdzi\u0107 linku portalu.<br />
            Sprawd\u017a po\u0142\u0105czenie z internetem i spr\u00f3buj ponownie.
          </p>
          <button
            onClick={revalidate}
            style={{
              padding: '10px 24px', borderRadius: 8,
              border: '1px solid #d1d5db', background: '#f9fafb',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            \ud83d\udd04 Spr\u00f3buj ponownie
          </button>
        </div>
      </div>
    )
  }
  if (status === 'invalid' || !session) return <PortalInvalid />

  const { session_id, client_name, scope, project } = session

  return (
    <div className="portal-page" style={{ maxWidth: 740, margin: '0 auto', padding: '24px 16px' }}>

      {/* ── Nagłówek projektu ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            {project ? (
              <>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                  {project.number}
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a202c', margin: 0 }}>
                  {project.name}
                </h1>
                {project.address && (
                  <p style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>
                    📍 {project.address}
                  </p>
                )}
              </>
            ) : (
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a202c', margin: 0 }}>
                Portal projektu
              </h1>
            )}
          </div>
          {project?.status && (
            <div style={{ marginTop: 4 }}>
              <Badge variant={STATUS_BADGE[project.status] ?? 'default'}>
                {STATUS_LABEL[project.status] ?? project.status}
              </Badge>
            </div>
          )}
        </div>

        {(project?.start_date || project?.end_date) && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: '#718096' }}>
            {project.start_date && <span>Rozpoczęcie: {project.start_date}</span>}
            {project.end_date   && <span>Planowane zakończenie: {project.end_date}</span>}
          </div>
        )}

        {client_name && (
          <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
            Zalogowany jako: <strong style={{ color: '#4a5568' }}>{client_name}</strong>
          </div>
        )}
      </div>

      {/* ── Zakładki ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display:      'flex',
          gap:          0,
          border:       '1px solid #e2e8f0',
          borderRadius: '8px 8px 0 0',
          overflow:     'hidden',
          marginBottom: 0,
        }}
      >
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex:             1,
              padding:          '12px 4px',
              border:           'none',
              borderRight:      i < TABS.length - 1 ? '1px solid #e2e8f0' : 'none',
              borderBottom:     activeTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
              background:       activeTab === tab.key ? '#f8faff' : '#fff',
              color:            activeTab === tab.key ? '#4f46e5' : '#718096',
              fontWeight:       activeTab === tab.key ? 600 : 400,
              fontSize:         13,
              cursor:           'pointer',
              transition:       'background 0.15s, color 0.15s',
              whiteSpace:       'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Zawartość zakładki ────────────────────────────────────────────── */}
      <div
        style={{
          border:       '1px solid #e2e8f0',
          borderTop:    'none',
          borderRadius: '0 0 8px 8px',
          padding:      16,
          background:   '#fafbfc',
        }}
      >
        {activeTab === 'updates'   && <PortalUpdatesTab   sessionId={session_id} />}
        {activeTab === 'messages'  && <PortalMessagesTab  sessionId={session_id} clientName={client_name} scope={scope} />}
        {activeTab === 'documents' && <PortalDocumentsTab sessionId={session_id} />}
        {activeTab === 'approvals' && <PortalApprovalsTab sessionId={session_id} scope={scope} />}
      </div>

      {/* ── Stopka ────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#cbd5e1' }}>
        Portal klienta · napędzany przez LoftDesk
        <br />
        <button
          onClick={revalidate}
          style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Odśwież sesję
        </button>
      </div>
    </div>
  )
}
