// =============================================================================
// ProjectAiTab — AI analysis tab shell for ProjectDetail
// =============================================================================
// Orchestrates:
//   1. AiIntakeSection  — trigger new analysis
//   2. AiRunsList       — history of runs, click to select
//   3. AiRunReviewPanel — review scope / questions / risks for selected run
// Sprint 5: fetches v_ai_run_stats once per project and passes a statsMap down
// to AiRunsList for per-run badges; computes project-level summary inline.
// =============================================================================

import { useState } from 'react'
import { useAiRunsForProject, useAiRunStatsForProject, type AiRunStats } from '../hooks/useAiReview'
import { useProjectBundleReadiness, useBundlesForProject, useFusionReviewQueue } from '../hooks/useAiBundles'
import { AiIntakeSection }         from './AiIntakeSection'
import { AiRunsList }              from './AiRunsList'
import { AiRunReviewPanel }        from './AiRunReviewPanel'
import { BundleReadinessCard }     from './BundleReadinessCard'
import { FusionReviewQueuePanel }  from './FusionReviewQueuePanel'

interface Props {
  projectId:    string
  companyId:    string
  planEnabled?: boolean
}

export function ProjectAiTab({ projectId, companyId, planEnabled = true }: Props) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [showIntake,    setShowIntake]    = useState(true)

  const { data: runs  = [], isLoading, isError: runsError }  = useAiRunsForProject(projectId)
  const { data: statsArr = [] }          = useAiRunStatsForProject(projectId)
  const { readiness: bundleReadiness, bundleCount } = useProjectBundleReadiness(projectId)

  // Fusion review queue — only when bundle is eligible for composite
  const bundlesQuery    = useBundlesForProject(projectId)
  const latestBundleId  = bundlesQuery.data?.[0]?.id
  const isEligible      = bundleReadiness?.eligible_for_composite ?? false
  const { data: reviewQueue, isLoading: queueLoading, error: queueError } =
    useFusionReviewQueue(latestBundleId, isEligible)

  // Auto-select a run: prefer user selection, fall back to latest completed
  const selectedRun = runs.find(r => r.id === selectedRunId)
    ?? (selectedRunId == null ? runs.find(r => r.status === 'completed') ?? null : null)

  // Build runId → stats map for AiRunsList badges (O(1) lookups)
  const statsMap: Record<string, AiRunStats> = Object.fromEntries(
    statsArr.map(s => [s.run_id, s]),
  )

  // Project-level aggregates (computed client-side — low N per project)
  const completedStats  = statsArr.filter(s => s.status === 'completed')
  const withEstimate    = completedStats.filter(s => s.has_estimate_draft).length
  const avgAcceptance   = completedStats.length > 0
    ? Math.round(
        completedStats.reduce((sum, s) => sum + (s.acceptance_rate ?? 0), 0)
          / completedStats.length,
      )
    : null

  function handleRunCreated(runId: string) {
    setSelectedRunId(runId)
    setShowIntake(false)
  }

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 24 }}>

      {/* Sprint 5: project-level summary row */}
      {completedStats.length > 0 && (
        <div
          style={{
            display:      'flex',
            flexWrap:     'wrap',
            gap:           16,
            padding:      '10px 14px',
            borderRadius:  8,
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            fontSize:      12,
            color:        'var(--color-text-secondary)',
          }}
        >
          <span>
            <strong style={{ color: 'var(--color-text)' }}>{completedStats.length}</strong>
            {' '}zakończonych analiz
          </span>
          <span>
            <strong style={{ color: 'var(--color-text)' }}>{withEstimate}</strong>
            {' '}z wyceną
          </span>
          {avgAcceptance != null && (
            <span>
              śr. akceptacja{' '}
              <strong style={{ color: 'var(--color-text)' }}>{avgAcceptance}%</strong>
            </span>
          )}
        </div>
      )}

      {/* P1: composite bundle readiness — shown when bundles exist */}
      {bundleReadiness && (
        <BundleReadinessCard readiness={bundleReadiness} bundleCount={bundleCount} />
      )}

      {/* P2: fusion review queue — shown when bundle is eligible for composite */}
      {isEligible && (queueLoading || reviewQueue || queueError) && (
        <FusionReviewQueuePanel
          queue={reviewQueue ?? null}
          isLoading={queueLoading}
          error={queueError ?? null}
        />
      )}

      {/* History or access error */}
      {runsError
        ? (
          <p style={{ fontSize: 13, color: 'var(--color-danger)', padding: '8px 0' }}>
            Brak dostępu do danych AI dla tego projektu. Sprawdź swoje uprawnienia lub odśwież stronę.
          </p>
        )
        : isLoading
        ? <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Ładowanie historii…</p>
        : (
          <AiRunsList
            runs={runs}
            selectedRunId={selectedRun?.id ?? null}
            onSelect={id => { setSelectedRunId(id); setShowIntake(false) }}
            statsMap={statsMap}
          />
        )
      }

      {/* Intake toggle */}
      {runs.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIntake(o => !o)}
            style={{
              fontSize:     13,
              color:        'var(--color-brand)',
              background:   'none',
              border:       'none',
              cursor:       'pointer',
              padding:       0,
              fontWeight:    500,
            }}
          >
            {showIntake ? '▲ Ukryj formularz' : '+ Nowa analiza'}
          </button>
        </div>
      )}

      {/* Intake form — shown when no runs yet, or manually toggled */}
      {(runs.length === 0 || showIntake) && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>
            Nowa analiza AI
          </p>
          <AiIntakeSection
            projectId={projectId}
            companyId={companyId}
            onRunCreated={handleRunCreated}
            planEnabled={planEnabled}
          />
        </div>
      )}

      {/* UX-6: hint when runs exist but none is auto-selected (e.g. all are processing / failed) */}
      {!isLoading && !runsError && !selectedRun && runs.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '4px 0' }}>
          Wybierz zakończoną analizę z historii, aby zobaczyć wyniki.
          {runs.some(r => r.status === 'processing') && ' Analizy w toku zostaną ukończone wkrótce — odśwież stronę za chwilę.'}
        </p>
      )}

      {/* Review panel */}
      {selectedRun && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>
            Wyniki analizy
          </p>
          <AiRunReviewPanel
            run={selectedRun}
            projectId={projectId}
          />
        </div>
      )}
    </div>
  )
}
