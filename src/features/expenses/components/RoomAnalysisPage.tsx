// =============================================================================
// RoomAnalysisPage — AI room analysis (requires project context)
// =============================================================================
// Entry point from dashboard "AI Analiza" tile.
// Flow: project picker → room type selector → multi-photo → clarification → AI analysis → results.
// Every analysis is tied to a project (company_id + project_id).

import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useAnalyzeRoomPhotos } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { BathroomClarification } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { RoomTypeId } from '@/services/ai/room-types'
import { getRoomTypeName } from '@/services/ai/room-types'
import type { AnalysisResult } from '@/services/ai/analysis.types'
import type { ClarificationAnswer } from '@/services/ai/engines/clarification.types'
import { applyAnswersToResult } from '@/services/ai/engines/clarification-effects'
import { AiErrorState, AiReliabilityBanner, AiUploadRules, AiProgressSteps, AiDraftDisclaimer, AiProjectContextBadge, AiNextActionBar } from '@/shared/ui/AiGuidance'
import { computeRoomReliabilityFromAnalysis } from '@/services/ai/engines/reliability'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { ProjectPickerCard } from '@/shared/ui/ProjectPickerCard/ProjectPickerCard'
import { ExpenseCameraCapture } from './ExpenseCameraCapture'
import { BathroomClarificationForm } from './BathroomClarificationForm'
import {
  DetectedMaterialsSection,
  WorkScopeSection,
  SuggestedEstimateSection,
  ClarificationQuestionsSection,
} from './AnalysisSections'

type Step = 'project' | 'capture' | 'clarification' | 'processing' | 'results'

const ROOM_UPLOAD_RULES = {
  formats: ['JPG', 'PNG', 'WEBP', 'HEIC'],
  maxSizeMb: 8,
  maxFiles: 10,
  minFiles: 1,
  tips: [
    'Fotografuj z różnych kątów: frontalnie, narożnik, detal',
    'Dobre oświetlenie poprawia dokładność — unikaj zdjęć pod słońce',
    'Pokaż materiały, instalacje i ewentualne uszkodzenia',
    '2–4 zdjęcia dają dobry wynik, 5–10 zakres pełny',
    'Nie wrzucaj projektów ani rysunków — użyj trybu „AI Projekt”',
  ],
}

export function RoomAnalysisPage() {
  const navigate = useNavigate()
  const analyzeRooms = useAnalyzeRoomPhotos()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const { projectId: urlProjectId } = useSearch({ strict: false }) as { projectId?: string }

  // If projectId comes from URL (via type chooser), skip picker step
  const initialStep: Step = urlProjectId ? 'capture' : 'project'
  const [step, setStep] = useState<Step>(initialStep)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(urlProjectId ?? '')
  const [roomFiles, setRoomFiles] = useState<File[]>([])
  const [roomType, setRoomType] = useState<RoomTypeId>('bathroom')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clarificationAnswers, setClarificationAnswers] = useState<ClarificationAnswer[]>([])

  // Reset answers when a new analysis result arrives so stale answers don't bleed in
  useEffect(() => { setClarificationAnswers([]) }, [result])

  // Derive displayResult from current answers — stays referentially stable when answers=[]
  const displayResult = useMemo(
    () => result
      ? applyAnswersToResult(result, clarificationAnswers, result.clarification_questions ?? [])
      : null,
    [result, clarificationAnswers],
  )

  const reliabilityReport = displayResult ? computeRoomReliabilityFromAnalysis(displayResult) : null

  function reset() {
    setStep('project')
    setSelectedProjectId('')
    setRoomFiles([])
    setRoomType('bathroom')
    setResult(null)
    setError(null)
    setClarificationAnswers([])
    analyzeRooms.reset()
  }

  /** Retry with same files — go back to clarification step */
  function handleRetry() {
    setStep('clarification')
    setError(null)
    analyzeRooms.reset()
  }

  /** Add more photos — go back to capture step, keep room type */
  function handleAddMore() {
    setStep('capture')
    setRoomFiles([])
    setError(null)
    analyzeRooms.reset()
  }

  function handleRoomPhotos(files: File[], rt: RoomTypeId) {
    setRoomFiles(files)
    setRoomType(rt)
    setStep('clarification')
  }

  function startAnalysis(clarification?: BathroomClarification) {
    setStep('processing')
    setClarificationAnswers([])
    analyzeRooms.mutate({ files: roomFiles, clarification, roomType, projectId: selectedProjectId }, {
      onSuccess: (res) => { setResult(res); setError(null); setStep('results') },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Analiza nie powiodła się.')
        setStep('results')
      },
    })
  }

  function handleAnswer(answer: ClarificationAnswer) {
    setClarificationAnswers(prev => [
      ...prev.filter(a => a.questionId !== answer.questionId),
      answer,
    ])
  }

  // ── Project selection ──
  if (step === 'project') {
    return (
      <div>
        <PageHeader title="AI Analiza pomieszczenia" />
        <ProjectPickerCard
          projects={projects}
          loading={projectsLoading}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onNext={() => setStep('capture')}
          nextLabel="Dalej — zrób zdjęcia"
          onBack={() => navigate({ to: '/ai' as any })}
          backLabel="← Tryb projektu"
        />
      </div>
    )
  }

  // ── Capture ──
  if (step === 'capture') {
    return (
      <div>
        <PageHeader title="AI Analiza pomieszczenia" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
          {/* Engine switcher — subtle, top-right */}
          <div style={{ textAlign: 'right', marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => navigate({ to: '/ai' as any })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', padding: 0 }}
            >
              ← Inny typ analizy
            </button>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            Zrób zdjęcia pomieszczenia z różnych kątów → AI wygeneruje zakres prac, materiały i draft wyceny.
          </p>
          <AiUploadRules config={ROOM_UPLOAD_RULES} />
          <ExpenseCameraCapture
            onCapture={() => {}}
            onRoomPhotos={handleRoomPhotos}
            onManual={() => {}}
            disabled={false}
            roomAnalysisOnly
          />
        </div>
      </div>
    )
  }

  // ── Clarification ──
  if (step === 'clarification') {
    return (
      <div>
        <PageHeader title="AI Analiza pomieszczenia" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
              ← Wróć
            </button>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Uzupełnij szczegóły — {getRoomTypeName(roomType)}
            </h3>
          </div>
          <BathroomClarificationForm
            photoCount={roomFiles.length}
            roomType={roomType}
            onSubmit={(data) => startAnalysis(data)}
            onSkip={() => startAnalysis()}
            disabled={analyzeRooms.isPending}
          />
        </div>
      </div>
    )
  }

  // ── Processing ──
  if (step === 'processing') {
    const processingProject = projects.find(p => p.id === selectedProjectId)
    return (
      <div>
        <PageHeader title="AI Analiza pomieszczenia" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px' }}>
          {processingProject && (
            <AiProjectContextBadge
              projectNumber={processingProject.number}
              projectName={processingProject.name}
            />
          )}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 20, padding: '52px 24px',
            background: 'var(--color-surface-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, minHeight: 280,
          }}>
            <AiProgressSteps variant="room" />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
              Trwa 15–30&nbsp;sekund.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Results ──
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div>
      <PageHeader title="AI Analiza pomieszczenia" />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
        {/* Project context badge */}
        {selectedProject && (
          <AiProjectContextBadge
            projectNumber={selectedProject.number}
            projectName={selectedProject.name}
            onChangeProject={reset}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
            ← Nowa analiza
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Wyniki — {getRoomTypeName(roomType)}
          </h3>
        </div>

        {error && (
          <AiErrorState
            error={error}
            engineType="room"
            onRetry={handleRetry}
            onAddMore={handleAddMore}
          />
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Trust disclaimer */}
            <AiDraftDisclaimer />

            {/* Reliability banner — reflects answers via displayResult */}
            {reliabilityReport && (
              <AiReliabilityBanner report={reliabilityReport} />
            )}

            {/* Analysis sections — displayResult carries answer effects */}
            {result.detected_materials && result.detected_materials.length > 0 && (
              <DetectedMaterialsSection items={result.detected_materials} />
            )}
            {displayResult?.work_scope && displayResult.work_scope.length > 0 && (
              <WorkScopeSection items={displayResult.work_scope} />
            )}
            {displayResult?.suggested_estimate_items && displayResult.suggested_estimate_items.length > 0 && (
              <SuggestedEstimateSection items={displayResult.suggested_estimate_items} reliabilityReport={reliabilityReport ?? undefined} />
            )}
            {/* Interactive Q/C questions — always from original result so user can revisit any answer */}
            {result.clarification_questions && result.clarification_questions.length > 0 && (
              <ClarificationQuestionsSection
                questions={result.clarification_questions}
                answers={clarificationAnswers}
                onAnswer={handleAnswer}
              />
            )}

            {/* No results — improved guidance */}
            {!result.detected_materials?.length && !result.work_scope?.length && !result.suggested_estimate_items?.length && !error && (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                border: '2px dashed var(--color-border)', borderRadius: 10,
                color: 'var(--color-text-muted)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)' }}>AI nie rozpoznał zakresu prac</p>
                <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6 }}>
                  Zdjęcia mogą być zbyt ciemne, rozmyte lub nie pokazują wystarczających szczegółów.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" onClick={handleAddMore} style={{ fontSize: 13 }}>
                    Dodaj więcej zdjęć
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={handleRetry} style={{ fontSize: 13 }}>
                    Spróbuj ponownie
                  </button>
                </div>
              </div>
            )}

            {/* Next action bar — always visible when results exist */}
            {(result.suggested_estimate_items?.length ?? 0) > 0 && (
              <AiNextActionBar
                primaryLabel="📋 Przenieś do wyceny"
                primaryOnClick={() => navigate({ to: '/estimates' as any, search: { create: '1' } as any })}
                secondaryLabel={selectedProjectId ? 'Wróć do projektu' : undefined}
                secondaryOnClick={selectedProjectId ? () => navigate({ to: '/projects' as any }) : undefined}
              />
            )}
            {(result.suggested_estimate_items?.length ?? 0) === 0 && selectedProjectId && (
              <AiNextActionBar
                primaryLabel="Wróć do projektu"
                primaryOnClick={() => navigate({ to: '/projects' as any })}
                secondaryLabel="Nowa analiza"
                secondaryOnClick={reset}
              />
            )}
          </div>
        )}

        {!result && !error && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
            Brak wyników do wyświetlenia.
          </div>
        )}
      </div>
    </div>
  )
}
