// =============================================================================
// RoomAnalysisPage — AI room analysis (requires project context)
// =============================================================================
// Entry point from dashboard "AI Analiza" tile.
// Flow: project picker → room type selector → multi-photo → clarification → AI analysis → results.
// Every analysis is tied to a project (company_id + project_id).

import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAnalyzeRoomPhotos } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { BathroomClarification } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { RoomTypeId } from '@/services/ai/room-types'
import { getRoomTypeName } from '@/services/ai/room-types'
import type { AnalysisResult } from '@/services/ai/analysis.types'
import type { ClarificationAnswer } from '@/services/ai/engines/clarification.types'
import { applyAnswersToResult } from '@/services/ai/engines/clarification-effects'
import { AiErrorState, AiReliabilityBanner, AiUploadRules, AiProgressSteps } from '@/shared/ui/AiGuidance'
import { computeRoomReliabilityFromAnalysis } from '@/services/ai/engines/reliability'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useProjects } from '@/features/projects/hooks/useProjects'
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

  const [step, setStep] = useState<Step>('project')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
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
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ textAlign: 'right', marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => navigate({ to: '/ai' as any })}
              style={{ fontSize: 13, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Tryb projektu
            </button>
          </div>
          <div style={{
            background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12,
            padding: 24, marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Wybierz projekt</h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Analiza AI wymaga kontekstu projektu. Wyniki zostaną powiązane z wybranym projektem.
            </p>
            {projectsLoading ? (
              <p style={{ color: '#9CA3AF', fontSize: 13 }}>Ładowanie projektów…</p>
            ) : projects.length === 0 ? (
              <p style={{ color: '#EF4444', fontSize: 13 }}>
                Brak projektów. Utwórz projekt, aby korzystać z analizy AI.
              </p>
            ) : (
              <>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #D1D5DB', fontSize: 14, marginBottom: 16,
                    background: '#FFFFFF',
                  }}
                >
                  <option value="">— Wybierz projekt —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.number} · {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedProjectId}
                  onClick={() => setStep('capture')}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 10,
                    background: selectedProjectId ? '#2563EB' : '#D1D5DB',
                    color: '#fff', fontWeight: 600, fontSize: 15,
                    border: 'none', cursor: selectedProjectId ? 'pointer' : 'default',
                  }}
                >
                  Dalej — zrób zdjęcia
                </button>
              </>
            )}
          </div>
        </div>
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
    return (
      <div>
        <PageHeader title="AI Analiza pomieszczenia" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px' }}>
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
  return (
    <div>
      <PageHeader title="AI Analiza pomieszczenia" />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
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

            {/* No results */}
            {!result.detected_materials?.length && !result.work_scope?.length && !result.suggested_estimate_items?.length && !error && (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                border: '2px dashed var(--color-border)', borderRadius: 10,
                color: 'var(--color-text-muted)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Brak wyników</p>
                <p style={{ margin: 0, fontSize: 13 }}>AI nie rozpoznał zakresu prac. Spróbuj dodać więcej zdjęć i uzupełnić formularz.</p>
              </div>
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
