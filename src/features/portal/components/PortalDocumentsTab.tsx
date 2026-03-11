import { Card } from '@/shared/ui/Card/Card'

// TODO Etap 3: Dokumenty
// ──────────────────────────────────────────────────────────────────────────────
// Ten komponent jest PLACEHOLDEREM do Etapu 3.
//
// Plan:
//   - Tabela project_documents (lub rozszerzenie project_project_documents z 033)
//     musi zyskać kolumnę visible_to_portal boolean
//   - Portal query: SELECT * FROM project_documents
//                   WHERE project_id = ... AND visible_to_portal = true
//   - Funkcja RPC: portal_get_documents(p_session_id uuid) → jsonb
//   - Operator zaznacza które dokumenty są widoczne dla klienta w ustawieniach projektu
//
// Przykładowa lista dokumentów (mock):
//   - Umowa (PDF)
//   - Kosztorys zatwierdzony (PDF)
//   - Zdjęcia z budowy (ZIP)

interface Props {
  sessionId: string
}

export function PortalDocumentsTab({ sessionId: _sessionId }: Props) {
  return (
    <Card>
      <h3 style={{ marginBottom: 12 }}>Dokumenty projektu</h3>
      <div
        style={{
          background:   '#f8fafc',
          border:       '1px dashed #cbd5e1',
          borderRadius: 8,
          padding:      '32px 24px',
          textAlign:    'center',
          color:        '#94a3b8',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
        <p style={{ fontWeight: 500, color: '#64748b', marginBottom: 8 }}>
          Dokumenty będą dostępne wkrótce
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
          Wykonawca może tutaj udostępnić umowę, kosztorys, zdjęcia z budowy
          oraz inne dokumenty związane z projektem.
        </p>
        {/* TODO Etap 3: zastąpić powyższe listą dokumentów z portal_get_documents() */}
      </div>
    </Card>
  )
}
