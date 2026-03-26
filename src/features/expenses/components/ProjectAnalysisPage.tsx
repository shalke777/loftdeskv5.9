// =============================================================================
// ProjectAnalysisPage — Project / Design Intelligence Engine v1
// =============================================================================
// Entry point from dashboard "AI Projekt" tile.
// Flow: upload (PDF or image) → processing → results.
// Supports: architectural drawings, design visualizations, technical specs.
// Results can be transferred to estimate via ProjectEstimateSection.

import { useRef, useState } from 'react'
import { useAnalyzeProject } from '@/features/expenses/hooks/useAnalyzeProject'
import type { ProjectAnalysisResult } from '@/services/ai/engines/project.types'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import {
  ProjectSummaryBar,
  ProjectRoomsSection,
  ProjectMaterialsSection,
  ProjectScopeSection,
  ProjectEstimateSection,
  ProjectTransparencySection,
} from './ProjectAnalysisSections'

type Step = 'upload' | 'processing' | 'results'

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

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

export function ProjectAnalysisPage() {
  const analyze = useAnalyzeProject()

  const [step, setStep]       = useState<Step>('upload')
  const [file, setFile]       = useState<File | null>(null)
  const [context, setContext] = useState('')
  const [result, setResult]   = useState<ProjectAnalysisResult | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setFile(null)
    setContext('')
    setResult(null)
    setError(null)
    analyze.reset()
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setFile(f)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function startAnalysis() {
    if (!file) return
    setStep('processing')
    analyze.mutate({ file, context: context.trim() || undefined }, {
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

  // ── Upload step ──────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div>
        <PageHeader title="AI Analiza projektu" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 40px' }}>

          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            Wgraj PDF projektu, rzut architektoniczny lub wizualizację wnętrza.<br />
            AI wyciągnie zakres prac, materiały i draft wyceny.
          </p>

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
          <div style={{
            fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 20,
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--color-surface-soft)',
            border: '1px solid var(--color-border)',
            lineHeight: 1.6,
          }}>
            <strong>Obsługiwane formaty:</strong>{' '}
            PDF (projekty, rzuty) · JPEG / PNG / WEBP (wizualizacje, renders, zdjęcia koncepcyjne)
          </div>

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
    return (
      <div>
        <PageHeader title="AI Analiza projektu" />
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
                {isPdf ? 'Czytam PDF projektu…' : 'Analizuję wizualizację…'}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                AI wyciąga pomieszczenia, materiały, zakres prac i przygotowuje draft wyceny.<br />
                Trwa 20–45&nbsp;sekund.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Results step ─────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="AI Analiza projektu" />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
            ← Nowa analiza
          </button>
        </div>

        {error && !result && (
          <div style={{
            padding: '14px 16px', borderRadius: 7, marginBottom: 16,
            background: 'rgba(229,115,115,0.08)', border: '1px solid rgba(229,115,115,0.3)',
            fontSize: 13, color: 'var(--color-danger, #E57373)',
          }}>
            <strong>Błąd analizy:</strong> {error}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 12 }}>
                Spróbuj ponownie
              </button>
            </div>
          </div>
        )}

        {result && (
          <>
            <ProjectSummaryBar result={result} />
            {result.warnings.length > 0 && !error && (
              <div style={{
                padding: '10px 14px', borderRadius: 6, marginBottom: 12,
                background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.3)',
                fontSize: 12, color: '#B5830A',
              }}>
                {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
            <ProjectRoomsSection rooms={result.rooms_detected} />
            <ProjectMaterialsSection materials={result.finish_materials} />
            <ProjectScopeSection items={result.work_scope_from_project} />
            <ProjectEstimateSection items={result.suggested_estimate_items} projectName={result.project_name} />
            <ProjectTransparencySection
              assumptions={result.assumptions}
              missingInfo={result.missing_information}
              notes={result.project_notes}
              warnings={result.warnings}
            />
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
