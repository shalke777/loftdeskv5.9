// =============================================================================
// RoomAnalysisPage — standalone AI room analysis (no project context needed)
// =============================================================================
// Entry point from dashboard "AI Analiza" tile.
// Flow: room type selector → multi-photo → clarification → AI analysis → results.
// Results can be transferred to estimates via session storage.

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAnalyzeRoomPhotos } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { BathroomClarification } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { RoomTypeId } from '@/services/ai/room-types'
import { getRoomTypeName } from '@/services/ai/room-types'
import type { AnalysisResult } from '@/services/ai/analysis.types'
import { AiErrorState, AiReliabilityBanner, AiUploadRules } from '@/shared/ui/AiGuidance'
import { computeRoomReliabilityFromAnalysis } from '@/services/ai/engines/reliability'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { ExpenseCameraCapture } from './ExpenseCameraCapture'
import { BathroomClarificationForm } from './BathroomClarificationForm'
import {
  DetectedMaterialsSection,
  WorkScopeSection,
  SuggestedEstimateSection,
} from './AnalysisSections'

type Step = 'capture' | 'clarification' | 'processing' | 'results'

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

  const [step, setStep] = useState<Step>('capture')
  const [roomFiles, setRoomFiles] = useState<File[]>([])
  const [roomType, setRoomType] = useState<RoomTypeId>('bathroom')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reliabilityReport = result ? computeRoomReliabilityFromAnalysis(result) : null

  function reset() {
    setStep('capture')
    setRoomFiles([])
    setRoomType('bathroom')
    setResult(null)
    setError(null)
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
    analyzeRooms.mutate({ files: roomFiles, clarification, roomType }, {
      onSuccess: (res) => { setResult(res); setError(null); setStep('results') },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Analiza nie powiodła się.')
        setStep('results')
      },
    })
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
    const photoCount = roomFiles.length
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
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 15 }}>
                Analizuję {photoCount > 1 ? `${photoCount} zdjęć` : 'zdjęcie'}…
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                AI rozpoznaje materiały, stan wykończenia i generuje draft zakresu prac.<br />
                Trwa 15–30&nbsp;sekund.
              </p>
            </div>
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
            {/* Reliability banner — covers confidence and extraction warnings */}
            {reliabilityReport && (
              <AiReliabilityBanner report={reliabilityReport} />
            )}

            {/* Analysis sections */}
            {result.detected_materials && result.detected_materials.length > 0 && (
              <DetectedMaterialsSection items={result.detected_materials} />
            )}
            {result.work_scope && result.work_scope.length > 0 && (
              <WorkScopeSection items={result.work_scope} />
            )}
            {result.suggested_estimate_items && result.suggested_estimate_items.length > 0 && (
              <SuggestedEstimateSection items={result.suggested_estimate_items} reliabilityReport={reliabilityReport ?? undefined} />
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
