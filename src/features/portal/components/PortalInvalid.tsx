import { Card } from '@/shared/ui/Card/Card'

export function PortalInvalid() {
  return (
    <div className="portal-page">
      <Card>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <h3 style={{ marginBottom: 8 }}>Link do portalu jest nieprawidłowy</h3>
          <p style={{ color: '#718096', lineHeight: 1.6 }}>
            Ten adres nie istnieje lub jest uszkodzony.
            <br />
            Poproś wykonawcę o ponowne przesłanie linku.
          </p>
        </div>
      </Card>
    </div>
  )
}
