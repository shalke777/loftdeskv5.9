import type { PortalEstimateItem } from '@/features/portal/api/portal.api'

interface Props {
  estimateNumber:  string
  estimateName:    string
  totalGross:      number
  estimateStatus:  string
  onAccept:        () => void
  onReject:        () => void
  disabled:        boolean
  items?:          PortalEstimateItem[]
  notes?:          string
  validUntil?:     string | null
}

const STATUS_LABEL: Record<string, string> = {
  draft:    'Robocza',
  sent:     'Oczekuje na odpowied┼║',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  accepted: { background: '#dcfce7', color: '#166534' },
  rejected: { background: '#fee2e2', color: '#dc2626' },
  sent:     { background: '#e0e7ff', color: '#4f46e5' },
  draft:    { background: '#f3f4f6', color: '#6b7280' },
}

export function PortalEstimate({
  estimateNumber,
  totalGross,
  estimateStatus,
  onAccept,
  onReject,
  disabled,
  items,
  notes,
  validUntil,
}: Props) {
  const canDecide = estimateStatus === 'sent'
  const statusStyle = STATUS_STYLE[estimateStatus] ?? STATUS_STYLE.draft

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
          alignItems:     'center',
          marginBottom:   16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Kosztorys {estimateNumber}</h3>
        <span
          style={{
            ...statusStyle,
            fontSize:     12,
            padding:      '4px 10px',
            borderRadius: 20,
            fontWeight:   600,
          }}
        >
          {STATUS_LABEL[estimateStatus] ?? estimateStatus}
        </span>
      </div>

      {items && items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left',  padding: '4px 8px', fontWeight: 600, color: '#6b7280' }}>Pozycja</th>
              <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: '#6b7280' }}>Ilo┼Ť─ç</th>
              <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: '#6b7280' }}>Cena brutto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 8px' }}>
                  <div>{item.name}</div>
                  {item.description && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{item.description}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  {item.quantity} {item.unit}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  {(item.quantity * item.unit_price * (1 + item.vat_rate / 100)).toLocaleString('pl-PL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} z┼é
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {notes && (
        <p style={{ fontSize: 13, color: '#718096', marginBottom: 16, lineHeight: 1.6 }}>{notes}</p>
      )}
      {validUntil && (
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Wa┼╝na do: {validUntil}</p>
      )}

      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          borderTop:      '1px solid #e5e7eb',
          paddingTop:     16,
          gap:            12,
          flexWrap:       'wrap',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          Razem:{' '}
          {totalGross.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          z┼é <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>(brutto)</span>
        </div>

        {canDecide && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn--secondary btn--sm"
              onClick={onReject}
              disabled={disabled}
            >
              Odrzu─ç
            </button>
            <button
              className="btn btn--sm"
              onClick={onAccept}
              disabled={disabled}
            >
              Ôťô Akceptuj─Ö
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
