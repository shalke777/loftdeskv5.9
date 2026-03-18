// Placeholder ÔÇö project_portal_tokens was dropped in migration 051.
// This tab will never render since usePortalSession always returns status='invalid'.

interface Props {
  sessionId: string
}

export function PortalDocumentsTab({ sessionId: _sessionId }: Props) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Brak dokument├│w do wy┼Ťwietlenia.
    </div>
  )
}
