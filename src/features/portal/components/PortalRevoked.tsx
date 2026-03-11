import { Card } from '@/shared/ui/Card/Card'

export function PortalRevoked() {
  return (
    <div className="portal-page">
      <Card>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h3 style={{ marginBottom: 8 }}>Dostęp do portalu został wyłączony</h3>
          <p style={{ color: '#718096', lineHeight: 1.6 }}>
            Ten link dostępu został dezaktywowany przez wykonawcę.
            <br />
            Skontaktuj się z wykonawcą, aby uzyskać nowy link.
          </p>
        </div>
      </Card>
    </div>
  )
}
