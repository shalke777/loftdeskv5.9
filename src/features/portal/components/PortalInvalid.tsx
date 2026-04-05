export function PortalInvalid() {
  return (
    <div className="portal-page" style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Link nieaktywny</h2>
        <p style={{ color: '#6E6A60', lineHeight: 1.6, margin: 0 }}>
          Ten link do portalu jest nieaktywny lub wygasł.<br />
          Zaloguj się przez link w emailu od wykonawcy lub skontaktuj się z firmą.
        </p>
      </div>
    </div>
  )
}
