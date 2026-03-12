import { FolderOpen } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'

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
          padding:      '40px 24px',
          textAlign:    'center',
          color:        '#94a3b8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <FolderOpen size={40} strokeWidth={1.25} color="#94a3b8" />
        </div>
        <p style={{ fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
          Brak udostępnionych dokumentów
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 360, margin: '0 auto', color: '#94a3b8' }}>
          Gdy wykonawca udostępni umowę, kosztorys lub inne pliki związane z projektem,
          pojawią się tutaj.
        </p>
      </div>
    </Card>
  )
}
