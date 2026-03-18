interface Props {
  estimateNumber:  string
  estimateName:    string
  customerName:    string
  contractorName:  string
  contractorEmail: string
  expiresAt:       string
  expired:         boolean
  estimateStatus:  string
}

export function PortalHeader({
  estimateNumber,
  estimateName,
  customerName,
  contractorName,
  contractorEmail,
  expiresAt,
  expired,
}: Props) {
  return (
    <div
      style={{
        background:    '#fff',
        borderRadius:  12,
        border:        '1px solid #e5e7eb',
        padding:       '20px 24px',
        marginBottom:  20,
      }}
    >
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'flex-start',
          flexWrap:       'wrap',
          gap:            12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{estimateNumber}</div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{estimateName}</h2>
          <div style={{ fontSize: 13, color: '#718096' }}>
            Dla: <strong>{customerName}</strong>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#718096' }}>
          <div>{contractorName}</div>
          <a href={`mailto:${contractorEmail}`} style={{ color: '#4f46e5' }}>{contractorEmail}</a>
          {!expired && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
              Ważna do: {new Date(expiresAt).toLocaleDateString('pl-PL')}
            </div>
          )}
        </div>
      </div>

      {expired && (
        <div
          style={{
            marginTop:    12,
            padding:      '8px 12px',
            background:   '#fef2f2',
            border:       '1px solid #fca5a5',
            borderRadius: 8,
            fontSize:     13,
            color:        '#dc2626',
          }}
        >
          ⚠️ Ta wycena wygasła.
        </div>
      )}
    </div>
  )
}
