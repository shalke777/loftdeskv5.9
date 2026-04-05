// =============================================================================
// ProjectAnalysisPage — Project / Design Intelligence Engine v1
// =============================================================================
// Entry point from dashboard "AI Projekt" tile.
// Flow: project picker → upload (PDF or image) → processing → results.
// Supports: architectural drawings, design visualizations, technical specs.
// Results can be transferred to estimate via ProjectEstimateSection.

import { useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useAnalyzeProject } from '@/features/expenses/hooks/useAnalyzeProject'
import { useAnalyzeRoomPhotos } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import { compareProjectToReality } from '@/services/ai/engines/comparison'
import type { ProjectAnalysisResult, ProjectComparisonResult } from '@/services/ai/engines/project.types'
import { AiErrorState, AiQualityBadge, AiReliabilityBanner, AiUploadRules, AiProgressSteps, aiPreflightValidate, sniffFileIntent, AiDraftDisclaimer, AiProjectContextBadge, AiNextActionBar } from '@/shared/ui/AiGuidance'
import { computeProjectReliability } from '@/services/ai/engines/reliability'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { ProjectPickerCard } from '@/shared/ui/ProjectPickerCard/ProjectPickerCard'
import {
  ProjectSummaryBar,
  ProjectRoomsSection,
  ProjectMaterialsSection,
  ProjectScopeSection,
  ProjectEstimateSection,
  ProjectTransparencySection,
} from './ProjectAnalysisSections'
import { ComparisonResultView } from './ComparisonResultView'

type Step = 'project' | 'upload' | 'processing' | 'results'

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

const PROJECT_UPLOAD_RULES = {
  formats: ['PDF', 'JPG', 'PNG', 'WEBP', 'HEIC'],
  maxSizeMb: 20,
  tips: [
    'Rzuty architektoniczne z wymiarami dają najlepszy wynik',
    'Możesz wgrać PDF projektu lub wizualizację jako obraz',
    'Użyj pola „Kontekst”, aby AI lepiej zrozumiał specyfikę obiektu',
    'Nie wrzucaj zdjęć pomieszczeń — użyj trybu „AI Analiza pomieszczenia”',
    'Nie wrzucaj faktur ani dokumentów kosztowych — użyj modułu „Koszty”',
  ],
}

const TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF',
}

function fileLabel(file: File): string {
  const ext = TYPE_LABELS[file.type.toLowerCase()] ?? file.name.split('.').pop()?.toUpperCase() ?? '?'
  const kb = (file.size / 1024).toFixed(0)
  return `${file.name} (${ext}, ${kb} kB)`
}

/** Map project room_type to RoomTypeId used by room engine */
function inferRoomType(r: ProjectAnalysisResult): string {
  const rt = r.rooms_detected[0]?.room_type ?? 'other'
  const MAP: Record<string, string> = {
    bathroom: 'bathroom', kitchen: 'kitchen',
    bedroom: 'room',      living_room: 'room',
    hallway: 'hallway',   garage: 'other',
    utility_room: 'other', other: 'other',
  }
  return MAP[rt] ?? 'other'
}

export function ProjectAnalysisPage() {
  const companyId   = useCompanyId()
  const analyze     = useAnalyzeProject()
  const analyzeRoom = useAnalyzeRoomPhotos()
  const navigate    = useNavigate()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const { projectId: urlProjectId } = useSearch({ strict: false }) as { projectId?: string }

  // If projectId comes from URL (via type chooser), skip picker step
  const initialStep: Step = urlProjectId ? 'upload' : 'project'
  const [step, setStep]       = useState<Step>(initialStep)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(urlProjectId ?? '')
  const [file, setFile]       = useState<File | null>(null)
  const [context, setContext] = useState('')
  const [result, setResult]   = useState<ProjectAnalysisResult | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const reliabilityReport = result ? computeProjectReliability(result) : null
  const [fileHint, setFileHint]           = useState<'document' | null>(null)
  const [fileHintDismissed, setFileHintDismissed] = useState(false)

  // ── Comparison state ──
  const [showCompare, setShowCompare]             = useState(false)
  const [compareFiles, setCompareFiles]           = useState<File[]>([])
  const [comparingRoom, setComparingRoom]         = useState(false)
  const [comparisonResult, setComparisonResult]   = useState<ProjectComparisonResult | null>(null)
  const [comparisonError, setComparisonError]     = useState<string | null>(null)

  const inputRef        = useRef<HTMLInputElement>(null)
  const compareInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('project')
    setSelectedProjectId('')
    setFile(null)
    setContext('')
    setResult(null)
    setError(null)
    setFileHint(null)
    setFileHintDismissed(false)
    setShowCompare(false)
    setCompareFiles([])
    setComparingRoom(false)
    setComparisonResult(null)
    setComparisonError(null)
    analyze.reset()
    analyzeRoom.reset()
    if (inputRef.current) inputRef.current.value = ''
    if (compareInputRef.current) compareInputRef.current.value = ''
  }

  function handleCompareFiles(files: FileList | null) {
    if (!files) return
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imgs.length > 0) setCompareFiles(imgs)
  }

  function startComparison() {
    if (!result || compareFiles.length === 0) return
    setComparingRoom(true)
    setComparisonError(null)
    analyzeRoom.mutate(
      { files: compareFiles, roomType: inferRoomType(result), projectId: selectedProjectId },
      {
        onSuccess: (roomResult) => {
          const comparison = compareProjectToReality(result, roomResult)
          setComparisonResult(comparison)
          setComparingRoom(false)
        },
        onError: (err) => {
          setComparisonError(
            err instanceof Error ? err.message : 'Analiza zdjęć nie powiodła się.'
          )
          setComparingRoom(false)
        },
      }
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setFileHint(sniffFileIntent(f))
      setFileHintDismissed(false)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setFile(f)
      setFileHint(sniffFileIntent(f))
      setFileHintDismissed(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function startAnalysis() {
    if (!file) return
    const preflight = aiPreflightValidate(file, {
      maxSizeBytes: 40 * 1024 * 1024,
      allowedTypes: ['application/pdf', 'image/*'],
    })
    if (!preflight.ok) {
      setError(`${preflight.message}${preflight.hint ? ' ' + preflight.hint : ''}`)
      setStep('results')
      return
    }
    setStep('processing')
    analyze.mutate({ file, context: context.trim() || undefined, projectId: selectedProjectId, companyId }, {
      onSuccess: (res) => {
        setResult(res)
        setError(null)
        setStep('results')
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Analiza nie powiodła się.')
        setStep('results')
      },
    })
  }

  const isPdf = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf')

  // ── Project selection ──
  if (step === 'project') {
    return (
      <div>
        <PageHeader title="AI Analiza projektu" />
        <ProjectPickerCard
          projects={projects}
          loading={projectsLoading}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onNext={() => setStep('upload')}
          nextLabel="Dalej — wgraj materiały"
          onBack={() => navigate({ to: '/ai' as any })}
          backLabel="← Tryb pomieszczenia"
        />
      </div>
    )
  }


  // ── Upload step ──────────────────────────────────────────────────────────
  if (step === 'upload') {
    const uploadProject = projects.find(p => p.id === selectedProjectId)
    return (
      <div>
        <PageHeader title="AI Analiza projektu" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 40px' }}>

          {uploadProject && (
            <AiProjectContextBadge
              projectNumber={uploadProject.number}
              projectName={uploadProject.name}
              onChangeProject={() => navigate({ to: '/ai' as any })}
            />
          )}

          {/* Engine switcher — subtle, top-right */}
          <div style={{ textAlign: 'right', marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => navigate({ to: '/ai' as any })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', padding: 0 }}
            >
              ← Zmień typ analizy
            </button>
          </div>

          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            Wgraj PDF projektu, rzut architektoniczny lub wizualizację wnętrza.<br />
            AI wyciągnie zakres prac, materiały i draft wyceny.
          </p>

          {/* Smart routing hint — only shown when filename looks like an invoice */}
          {fileHint === 'document' && !fileHintDismissed && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 12px', borderRadius: 7, marginBottom: 12,
              background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.25)',
              fontSize: 12, color: 'var(--color-accent)',
            }}>
              <span style={{ flex: 1, lineHeight: 1.5 }}>
                💡 Nazwa pliku sugeruje fakturę lub paragon — to może być dokument kosztowy.
                Jeśli tak, użyj{' '}
                <button
                  type="button"
                  onClick={() => navigate({ to: '/expenses' as any })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 700, fontSize: 12, padding: 0, textDecoration: 'underline' }}
                >
                  modułu Koszty
                </button>
                .
              </span>
              <button
                type="button"
                onClick={() => setFileHintDismissed(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: 0.6, color: 'currentColor', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                aria-label="Zamknij sugestię"
              >
                ×
              </button>
            </div>
          )}

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
            style={{
              border: `2px dashed ${file ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 10,
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? 'rgba(var(--color-primary-rgb, 74,144,226),0.04)' : 'var(--color-surface-soft)',
              transition: 'border-color 0.15s, background 0.15s',
              marginBottom: 16,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {file ? (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>
                  {isPdf ? '📄' : '🖼️'}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, wordBreak: 'break-all' }}>
                  {fileLabel(file)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Kliknij, żeby zmienić plik
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  Przeciągnij plik lub kliknij, żeby wybrać
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                  PDF projektu / rzutu · Wizualizacja (JPEG, PNG, WEBP)<br />
                  Maksymalny rozmiar: 15 MB
                </div>
              </div>
            )}
          </div>

          {/* Context field */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Kontekst (opcjonalnie)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Np. łazienka 6 m² na 1. piętrze, remont kapitalny, klient chce gresu 60×60…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 13, lineHeight: 1.5, resize: 'vertical',
              }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
              Dodatkowe informacje pomagają AI lepiej zinterpretować projekt.
            </p>
          </div>

          {/* Supported formats help */}
          <AiUploadRules config={PROJECT_UPLOAD_RULES} />

          <button
            type="button"
            className="btn btn-primary"
            disabled={!file}
            onClick={startAnalysis}
            style={{ width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 600 }}
          >
            Analizuj projekt →
          </button>
        </div>
      </div>
    )
  }

  // ── Processing step ──────────────────────────────────────────────────────
  if (step === 'processing') {
    const processingProject = projects.find(p => p.id === selectedProjectId)
    return (
      <div>
        <PageHeader title="AI Analiza projektu" />
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
            <AiProgressSteps variant="project" />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
              Trwa 20–45&nbsp;sekund.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Results step ─────────────────────────────────────────────────────────
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div>
      <PageHeader title="AI Analiza projektu" />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        {/* Project context badge */}
        {selectedProject && (
          <AiProjectContextBadge
            projectNumber={selectedProject.number}
            projectName={selectedProject.name}
            onChangeProject={reset}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          {reliabilityReport && <AiReliabilityBanner report={reliabilityReport} compact />}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
              ← Nowa analiza
            </button>
          </div>
        </div>

        {error && !result && (
          <AiErrorState
            error={error}
            engineType="project"
            onRetry={reset}
            onChangeFile={reset}
          />
        )}

        {result && (
          <>
            {/* Trust disclaimer */}
            <AiDraftDisclaimer />

            <ProjectSummaryBar result={result} />
            {result.warnings.length > 0 && !error && (
              <div style={{
                padding: '10px 14px', borderRadius: 6, marginBottom: 12,
                background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.3)',
                fontSize: 12, color: 'var(--color-accent)',
              }}>
                {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
            <ProjectRoomsSection rooms={result.rooms_detected} />
            <ProjectMaterialsSection materials={result.finish_materials} />
            <ProjectScopeSection items={result.work_scope_from_project} />
            <ProjectEstimateSection items={result.suggested_estimate_items} projectName={result.project_name} reliabilityReport={reliabilityReport ?? undefined} />
            <ProjectTransparencySection
              assumptions={result.assumptions}
              missingInfo={result.missing_information}
              notes={result.project_notes}
              warnings={result.warnings}
            />

            {/* ── Comparison section ──────────────────────────────────── */}
            <div style={{
              marginTop: 16,
              borderTop: '1px solid var(--color-border)',
              paddingTop: 16,
            }}>

              {/* Entry CTA — shown when comparison not yet started */}
              {!showCompare && (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCompare(true)}
                    style={{ fontSize: 13 }}
                  >
                    🔍 Porównaj z rzeczywistością → wgraj zdjęcia pomieszczenia
                  </button>
                </div>
              )}

              {/* Photo upload for room comparison */}
              {showCompare && !comparisonResult && !comparingRoom && (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <h4 style={{
                    margin: '0 0 8px', fontSize: 14, fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}>
                    Porównaj projekt ze stanem faktycznym
                  </h4>
                  <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    Wgraj zdjęcia pomieszczenia (JPEG/PNG). AI wykryje materiały i zakres prac,
                    a&nbsp;następnie porówna je z projektem. Dodaj zdjęcia z różnych kątów dla lepszych wyników.
                  </p>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => compareInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') compareInputRef.current?.click() }}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleCompareFiles(e.dataTransfer.files)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      border: `2px dashed ${compareFiles.length > 0 ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 8, padding: '20px 16px',
                      textAlign: 'center', cursor: 'pointer',
                      background: compareFiles.length > 0
                        ? 'rgba(var(--color-primary-rgb,74,144,226),0.04)'
                        : 'var(--color-surface-soft)',
                      transition: 'border-color 0.15s',
                      marginBottom: 12,
                    }}
                  >
                    <input
                      ref={compareInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleCompareFiles(e.target.files)}
                    />
                    {compareFiles.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>📸</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {compareFiles.length} {compareFiles.length === 1 ? 'zdjęcie' : 'zdjęcia'} gotowe
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Kliknij, żeby zmienić
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                          Przeciągnij zdjęcia lub kliknij
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          Akceptowane: JPEG, PNG, WEBP · Maks. 8 MB / zdjęcie
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => { setShowCompare(false); setCompareFiles([]) }}
                      style={{ fontSize: 13 }}
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={compareFiles.length === 0}
                      onClick={startComparison}
                      style={{ flex: 1, fontSize: 13, fontWeight: 600 }}
                    >
                      Analizuj i porównaj →
                    </button>
                  </div>
                </div>
              )}

              {/* Spinner while room analysis + comparison running */}
              {comparingRoom && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 14, padding: '32px 16px',
                  background: 'var(--color-surface-soft)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}>
                  <div className="spinner" style={{ width: 32, height: 32 }} />
                  <div style={{ textAlign: 'center', fontSize: 13 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
                      Analizuję zdjęcia i porównuję z projektem…
                    </p>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      AI wykrywa materiały i zakres prac, porównuje je z projektem.<br />
                      Trwa 15–30&nbsp;sekund.
                    </p>
                  </div>
                </div>
              )}

              {/* Comparison error */}
              {comparisonError && !comparingRoom && (
                <div style={{
                  padding: '12px 14px', borderRadius: 7, marginBottom: 8,
                  background: 'rgba(229,115,115,0.08)', border: '1px solid rgba(229,115,115,0.3)',
                  fontSize: 13, color: 'var(--color-danger)',
                }}>
                  <strong>Błąd porównania:</strong> {comparisonError}
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setComparisonError(null)
                        setCompareFiles([])
                        analyzeRoom.reset()
                      }}
                      style={{ fontSize: 12 }}
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                </div>
              )}

              {/* Comparison result */}
              {comparisonResult && !comparingRoom && (
                <div>
                  <ComparisonResultView
                    result={comparisonResult}
                    projectName={result.project_name}
                  />
                  <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setComparisonResult(null)
                        setCompareFiles([])
                        setComparisonError(null)
                        analyzeRoom.reset()
                      }}
                      style={{ fontSize: 12 }}
                    >
                      🔄 Porównaj z innymi zdjęciami
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* ── end comparison ─────────────────────────────────────────  */}

            {/* Next action bar */}
            {result.suggested_estimate_items.length > 0 && (
              <AiNextActionBar
                primaryLabel="📋 Przenieś do wyceny"
                primaryOnClick={() => navigate({ to: '/estimates' as any, search: { create: '1' } as any })}
                secondaryLabel={selectedProjectId ? 'Wróć do projektu' : undefined}
                secondaryOnClick={selectedProjectId ? () => navigate({ to: '/projects' as any }) : undefined}
              />
            )}
            {result.suggested_estimate_items.length === 0 && selectedProjectId && (
              <AiNextActionBar
                primaryLabel="Wróć do projektu"
                primaryOnClick={() => navigate({ to: '/projects' as any })}
                secondaryLabel="Nowa analiza"
                secondaryOnClick={reset}
              />
            )}
          </>
        )}

        {!result && !error && (
          <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Brak wyników analizy.
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
            ← Analizuj inny plik
          </button>
        </div>
      </div>
    </div>
  )
}
