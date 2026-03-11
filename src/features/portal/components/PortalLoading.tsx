import { Card } from '@/shared/ui/Card/Card'

export function PortalLoading() {
  return (
    <div className="portal-page">
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '60vh',
          gap:            16,
          textAlign:      'center',
        }}
      >
        <div
          style={{
            width:        40,
            height:       40,
            borderRadius: '50%',
            border:       '3px solid #e2e8f0',
            borderTop:    '3px solid #4f46e5',
            animation:    'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: '#718096', fontSize: 15 }}>Wczytywanie portalu klienta…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
