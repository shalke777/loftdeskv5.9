export function PortalLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240, padding: 32 }}>
      <div style={{ textAlign: 'center', color: '#718096' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <p style={{ margin: 0 }}>Ładowanie portalu…</p>
      </div>
    </div>
  )
}
