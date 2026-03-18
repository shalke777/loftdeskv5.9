export function PortalInvalid() {
  return (
    <div className="portal-page" style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Nieprawidłowy link</h2>
        <p style={{ color: '#718096', lineHeight: 1.6, margin: 0 }}>
          Ten link portalu nie istnieje lub został dezaktywowany.<br />
          Skontaktuj się z firmą, aby otrzymać nowy link dostępu.
        </p>
      </div>
    </div>
  )
}
