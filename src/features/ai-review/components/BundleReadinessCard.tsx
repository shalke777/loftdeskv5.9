// =============================================================================
// BundleReadinessCard — read-only P1 composite readiness summary
// =============================================================================
// Shows bundle readiness status for a project's latest bundle.
// Mounted inside ProjectAiTab when bundles exist.
// No actions, no mutations — pure read display.
// =============================================================================

import type { BundleReadinessSummary } from '@/services/ai/composite/bundle-readiness'

interface Props {
  readiness:   BundleReadinessSummary
  bundleCount: number
}

const REASON_LABELS: Record<string, string> = {
  eligible:                      'Gotowy do analizy kompozytowej',
  insufficient_technical_layers: 'Za mało warstw technicznych',
  visualization_only:            'Tylko wizualizacje — analiza niedostępna',
  needs_more_sources:            'Za mało źródeł (min. 2)',
  unknown_document_type:         'Typ dokumentu nierozpoznany',
  no_assets:                     'Brak plików w bundlu',
}

function statusColor(eligible: boolean): string {
  return eligible ? 'var(--color-success)' : 'var(--color-warning)'
}

export function BundleReadinessCard({ readiness, bundleCount }: Props) {
  const r = readiness

  return (
    <div
      style={{
        display:       'grid',
        gap:            8,
        padding:       '12px 14px',
        borderRadius:   8,
        background:    'var(--color-surface)',
        border:        '1px solid var(--color-border)',
        fontSize:       12,
        color:         'var(--color-text-secondary)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width:        8,
            height:       8,
            borderRadius: '50%',
            background:   statusColor(r.eligible_for_composite),
            flexShrink:   0,
          }}
        />
        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 13 }}>
          Composite Readiness
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11 }}>
          {bundleCount} {bundleCount === 1 ? 'bundle' : 'bundli'}
        </span>
      </div>

      {/* Status line */}
      <div>
        <span style={{ color: statusColor(r.eligible_for_composite), fontWeight: 500 }}>
          {REASON_LABELS[r.eligibility_reason] ?? r.eligibility_reason}
        </span>
        {r.document_type && r.document_type !== 'unknown' && (
          <span style={{ marginLeft: 8 }}>
            · {r.document_type === 'projekt_wykonawczy' ? 'Projekt wykonawczy' : 'Pack wizualizacyjny'}
          </span>
        )}
      </div>

      {/* Counts row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <span>
          <strong style={{ color: 'var(--color-text)' }}>{r.asset_count}</strong> plików
        </span>
        {r.must_use_present.length > 0 && (
          <span>
            <strong style={{ color: 'var(--color-text)' }}>{r.must_use_present.length}</strong> warstw MUST USE
          </span>
        )}
        {r.must_use_missing.length > 0 && (
          <span style={{ color: 'var(--color-warning)' }}>
            <strong>{r.must_use_missing.length}</strong> brakujących
          </span>
        )}
      </div>

      {/* Warnings */}
      {r.warnings.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, listStyleType: "'⚠ '" }}>
          {r.warnings.map((w, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{w}</li>
          ))}
        </ul>
      )}

      {/* Extraction / fusion flags */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, opacity: 0.75 }}>
        <span>extraction: {r.ready_for_extraction ? '✓' : '–'}</span>
        <span>fusion: –</span>
      </div>
    </div>
  )
}
