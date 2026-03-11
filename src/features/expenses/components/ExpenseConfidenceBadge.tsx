import type { ParseInvoiceResult } from '@/features/expenses/api/expenses.api'

interface Props {
  confidence: ParseInvoiceResult['extraction_confidence']
  warnings?:  ParseInvoiceResult['extraction_warnings']
}

export function ExpenseConfidenceBadge({ confidence, warnings }: Props) {
  const level =
    confidence >= 70 ? 'high'
    : confidence >= 40 ? 'medium'
    : 'low'

  const label =
    level === 'high'   ? 'Wysoka pewność'
    : level === 'medium' ? 'Średnia pewność'
    : 'Niska pewność'

  const color =
    level === 'high'   ? 'var(--color-success, #16a34a)'
    : level === 'medium' ? 'var(--color-warning, #ca8a04)'
    : 'var(--color-danger, #dc2626)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 99,
            fontSize: 12, fontWeight: 600, letterSpacing: 0.2,
            color, border: `1px solid ${color}`,
          }}
        >
          <span
            style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: color,
            }}
          />
          {label} — {confidence}%
        </span>

        {level === 'low' && (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
            Sprawdź dane przed zapisem
          </span>
        )}
      </div>

      {warnings && warnings.length > 0 && (
        <ul style={{ margin: 0, padding: '4px 0 0 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {warnings.map((w, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--color-warning, #ca8a04)' }}>
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
