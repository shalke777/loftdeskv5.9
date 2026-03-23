import type { ProjectCompleteness as ProjectCompletenessType } from '@/entities/project/model'

const CHECKS: { key: keyof ProjectCompletenessType; label: string }[] = [
  { key: 'has_client',   label: 'Klient' },
  { key: 'has_estimate', label: 'Wycena' },
  { key: 'has_contract', label: 'Umowa' },
  { key: 'has_invoice',  label: 'Faktura' },
  { key: 'has_protocol', label: 'Protokół' },
  { key: 'has_note',     label: 'Notatka' },
]

interface Props {
  score: number
  flags?: ProjectCompletenessType | null
  compact?: boolean
}

export function ProjectCompleteness({ score, flags, compact = false }: Props) {
  const color = score >= 80 ? '#77BA8A' : score >= 50 ? '#D4960A' : '#EF6B6B'

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 60,
            height: 6,
            background: 'var(--color-border)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${score}%`,
              height: '100%',
              background: color,
              borderRadius: 3,
              transition: 'width .3s',
            }}
          />
        </div>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{score}%</span>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            flex: 1,
            height: 8,
            background: 'var(--color-border)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${score}%`,
              height: '100%',
              background: color,
              borderRadius: 4,
              transition: 'width .3s',
            }}
          />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 40, color }}>{score}%</span>
      </div>
      {flags && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CHECKS.map(({ key, label }) => (
            <span
              key={key}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: flags[key] ? 'rgba(119,186,138,0.18)' : 'rgba(239,68,68,0.18)',
                color: flags[key] ? '#77BA8A' : '#EF6B6B',
              }}
            >
              {flags[key] ? '✓' : '✗'} {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
