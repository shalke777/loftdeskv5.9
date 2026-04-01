// =============================================================================
// AiRunsList — compact history of AI analysis runs for a project
// Sprint 5: accepts optional statsMap (keyed by run_id) for per-run badges.
// =============================================================================

import { computeConfidenceBand } from '@/shared/lib/confidence-model'
import type { AiAnalysisRun } from '../api/ai-review.api'
import type { AiRunStats }    from '../hooks/useAiReview'

const STATUS_LABEL: Record<AiAnalysisRun['status'], string> = {
  draft:      'Szkic',
  processing: 'Przetwarzanie…',
  completed:  'Zakończona',
  failed:     'Błąd',
}

const STATUS_COLOR: Record<AiAnalysisRun['status'], string> = {
  draft:      'var(--color-text-secondary)',
  processing: 'var(--color-warning, #F59E0B)',
  completed:  'var(--color-success, #10B981)',
  failed:     'var(--color-danger, #EF4444)',
}

const ROOM_LABEL: Record<AiAnalysisRun['room_type'], string> = {
  bathroom: 'Łazienka',
  wc:       'WC',
}

interface Props {
  runs:          AiAnalysisRun[]
  selectedRunId: string | null
  onSelect:      (runId: string) => void
  statsMap?:     Record<string, AiRunStats>
}

export function AiRunsList({ runs, selectedRunId, onSelect, statsMap = {} }: Props) {
  if (!runs.length) return null

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>
        Historia analiz
      </p>
      {runs.map(run => {
        const isSelected = selectedRunId === run.id
        const confidenceBand = run.confidence_summary != null
          ? computeConfidenceBand({
              rawScore:           run.confidence_summary,
              hasMissingData:     run.missing_data,
              openQuestionsCount: 0, // not available in list context
              openRisksCount:     0,
              photoOnly:          true, // P0 runs: photos only, no drawings
            })
          : null
        const stats = statsMap[run.id]

        return (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelect(run.id)}
            style={{
              textAlign:    'left',
              padding:      '8px 12px',
              borderRadius:  8,
              border:       `1px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
              background:    isSelected ? 'var(--color-brand-subtle, #EFF6FF)' : 'transparent',
              cursor:       'pointer',
              display:      'flex',
              justifyContent: 'space-between',
              alignItems:   'center',
              gap:           8,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--color-text)' }}>
              {ROOM_LABEL[run.room_type]}
              {' · '}
              {new Date(run.created_at).toLocaleDateString('pl-PL')}
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Sprint 5: per-run badges — only for completed runs with stats loaded */}
              {run.status === 'completed' && stats && (
                <>
                  <span
                    style={{
                      fontSize:     11,
                      color:        'var(--color-success, #10B981)',
                      background:   'var(--color-success-subtle, #D1FAE5)',
                      borderRadius:  4,
                      padding:      '1px 6px',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    ✓ {stats.accepted_count + stats.modified_count}/{stats.total_scope_items}
                  </span>
                  {stats.has_estimate_draft && (
                    <span
                      style={{
                        fontSize:     11,
                        color:        'var(--color-brand)',
                        background:   'var(--color-brand-subtle, #EFF6FF)',
                        borderRadius:  4,
                        padding:      '1px 6px',
                        whiteSpace:   'nowrap',
                      }}
                    >
                      wycena ↗
                    </span>
                  )}
                </>
              )}

              <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                <span style={{ color: STATUS_COLOR[run.status] }}>{STATUS_LABEL[run.status]}</span>
                {run.status === 'completed' && confidenceBand && (
                  <span style={{ color: confidenceBand.color, marginLeft: 4 }}>
                    · {confidenceBand.label}
                  </span>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
