// =============================================================================
// AiGuidance — shared UI primitives for AI engine intake and user guidance
// =============================================================================
// Used by: ExpensesPage (document engine), RoomAnalysisPage (room engine),
//          ProjectAnalysisPage (project engine)
//
// Exports:
//   aiPreflightValidate()  — pure client-side file validation before sending
//   categorizeAiError()    — maps raw error string → human-readable category
//   AiErrorState           — standardised error display with fallback CTAs
//   AiQualityBadge         — maps confidence number → quality label + colour
//   AiUploadRules          — compact upload-rules microcopy card (expandable tips)

import { useState } from 'react'

// ── Smart file-intent sniff (filename heuristic, conservative) ────────────────
// Returns a suggested engine type when the filename strongly implies a mismatch.
// Only fires on high-confidence patterns — no guessing.

/**
 * Sniffs the file name for strong signals that the file belongs to a different
 * AI engine than the one the user is currently in.
 * Returns 'document' if the filename looks like an invoice/receipt, null otherwise.
 */
export function sniffFileIntent(file: File): 'document' | null {
  const name = file.name.toLowerCase()
  const INVOICE_KEYWORDS = [
    'faktura', 'fvat', 'fv_', '_fv', '-fv', 'fv-',
    'paragon', 'rachunek', 'invoice', 'receipt', 'nota_', '_nota',
  ]
  if (INVOICE_KEYWORDS.some(kw => name.includes(kw))) return 'document'
  return null
}

// ── Preflight validation ───────────────────────────────────────────────────────

export interface PreflightRules {
  maxSizeBytes: number
  /** MIME exact types or prefixes ending in /* (e.g. 'image/*') */
  allowedTypes: string[]
  maxCount?: number
  minCount?: number
}

export interface PreflightResult {
  ok: boolean
  issue?: 'size' | 'type' | 'count_too_few' | 'count_too_many' | 'empty'
  message?: string
  hint?: string
}

export function aiPreflightValidate(
  files: File | File[],
  rules: PreflightRules,
): PreflightResult {
  const arr = Array.isArray(files) ? files : [files]

  if (arr.length === 0) {
    return { ok: false, issue: 'empty', message: 'Nie wybrano żadnego pliku.', hint: 'Dodaj plik przed analizą.' }
  }
  if (rules.minCount != null && arr.length < rules.minCount) {
    return {
      ok: false, issue: 'count_too_few',
      message: `Za mało plików — minimum ${rules.minCount}.`,
      hint: `Dodaj co najmniej ${rules.minCount} ${rules.minCount === 1 ? 'plik' : 'zdjęcia'}.`,
    }
  }
  if (rules.maxCount != null && arr.length > rules.maxCount) {
    return {
      ok: false, issue: 'count_too_many',
      message: `Za dużo plików — maksimum ${rules.maxCount}.`,
      hint: `Ogranicz liczbę do ${rules.maxCount}.`,
    }
  }
  for (const file of arr) {
    if (file.size > rules.maxSizeBytes) {
      const mb    = (file.size / (1024 * 1024)).toFixed(1)
      const limit = (rules.maxSizeBytes / (1024 * 1024)).toFixed(0)
      return {
        ok: false, issue: 'size',
        message: `Plik „${file.name}" jest za duży (${mb} MB — limit to ${limit} MB).`,
        hint: 'Skompresuj plik lub użyj mniejszej wersji.',
      }
    }
    const typeOk = rules.allowedTypes.some(allowed => {
      if (allowed.endsWith('/*')) return file.type.startsWith(allowed.slice(0, -2) + '/')
      return (
        file.type === allowed ||
        file.name.toLowerCase().endsWith('.' + allowed.replace(/^\./, ''))
      )
    })
    if (!typeOk) {
      const ext = file.name.split('.').pop()?.toUpperCase() ?? '?'
      return {
        ok: false, issue: 'type',
        message: `Format pliku „${ext}" nie jest obsługiwany.`,
        hint: 'Użyj jednego z obsługiwanych formatów.',
      }
    }
  }
  return { ok: true }
}

// ── Error categorization ──────────────────────────────────────────────────────

interface AiErrorCategory {
  title: string
  detail: string
  /** Primary recovery hint — drives which CTA buttons appear prominently */
  action: 'retry' | 'refresh' | 'wait' | 'change_file' | 'add_more' | 'manual'
}

export function categorizeAiError(rawError: string): AiErrorCategory {
  const e = rawError.toLowerCase()

  if (e.includes('sesja') || e.includes('wygasła') || e.includes('zaloguj') || e.includes('401') || e.includes('nieautoryzowany')) {
    return { title: 'Sesja wygasła', detail: 'Twoja sesja logowania wygasła. Odśwież stronę i zaloguj się ponownie.', action: 'refresh' }
  }
  if (e.includes('za dużo żądań') || e.includes('429') || e.includes('rate limit')) {
    return { title: 'Zbyt wiele żądań', detail: 'Przekroczono chwilowy limit analiz AI. Poczekaj kilkadziesiąt sekund i spróbuj ponownie.', action: 'wait' }
  }
  if (e.includes('niedostępny') || e.includes('serwer') || e.includes('503') || e.includes('504') || e.includes('fetch') || e.includes('network')) {
    return { title: 'Serwer analizy chwilowo niedostępny', detail: 'Usługa AI nie odpowiada w tej chwili. Zazwyczaj problem mija w ciągu kilku minut — spróbuj ponownie.', action: 'retry' }
  }
  if (e.includes('timeout') || e.includes('timed out') || e.includes('zbyt długo')) {
    return { title: 'Analiza trwała zbyt długo', detail: 'Serwer nie zdążył odpowiedzieć. Plik może być zbyt duży lub skomplikowany — spróbuj ponownie lub zmniejsz plik.', action: 'retry' }
  }
  if (e.includes('za duży') || e.includes('too large') || e.includes('413') || e.includes('rozmiar pliku')) {
    return { title: 'Plik jest za duży', detail: 'Serwer odrzucił plik z powodu rozmiaru. Skompresuj go lub użyj mniejszej wersji.', action: 'change_file' }
  }
  if (e.includes('format') || e.includes('nieobsługiwan') || e.includes('unsupported') || e.includes('invalid type')) {
    return { title: 'Nieobsługiwany format pliku', detail: 'AI nie może przetworzyć tego formatu. Użyj PDF, JPG lub PNG.', action: 'change_file' }
  }
  if (e.includes('api key') || e.includes('nie skonfigurowano') || e.includes('brak openai') || e.includes('ai nie jest skonfigurowane')) {
    return { title: 'AI niedostępne w tej chwili', detail: 'Usługa AI nie jest aktywna. Spróbuj ponownie lub wprowadź dane ręcznie.', action: 'manual' }
  }
  return {
    title: 'Analiza nie powiodła się',
    detail: 'Wystąpił nieoczekiwany problem. Możesz spróbować ponownie lub uzupełnić dane ręcznie.',
    action: 'retry',
  }
}

// ── AiErrorState ──────────────────────────────────────────────────────────────

interface AiErrorStateProps {
  error: string
  onRetry?: () => void
  onManual?: () => void
  onAddMore?: () => void
  onChangeFile?: () => void
  /** 'room' shows "Dodaj więcej zdjęć"; 'project'/'document' shows file-change fallback */
  engineType?: 'document' | 'room' | 'project'
}

export function AiErrorState({
  error,
  onRetry,
  onManual,
  onAddMore,
  onChangeFile,
  engineType = 'document',
}: AiErrorStateProps) {
  const cat = categorizeAiError(error)
  const showRetry = onRetry && cat.action !== 'manual'

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 8, marginBottom: 16,
      background: 'rgba(229,115,115,0.07)',
      border: '1px solid rgba(229,115,115,0.28)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: 'var(--color-danger, #E57373)' }}>
            {cat.title}
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
            {cat.detail}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {showRetry && (
              <button type="button" className="btn btn-ghost" onClick={onRetry} style={{ fontSize: 12 }}>
                Spróbuj ponownie
              </button>
            )}
            {onAddMore && engineType === 'room' && (
              <button type="button" className="btn btn-ghost" onClick={onAddMore} style={{ fontSize: 12 }}>
                Dodaj więcej zdjęć
              </button>
            )}
            {onChangeFile && (
              <button type="button" className="btn btn-ghost" onClick={onChangeFile} style={{ fontSize: 12 }}>
                {engineType === 'room' ? 'Zmień zdjęcia' : 'Zmień plik'}
              </button>
            )}
            {onManual && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onManual}
                style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
              >
                Wprowadź ręcznie
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AiQualityBadge ────────────────────────────────────────────────────────────

interface AiQualityBadgeProps {
  confidence: number
}

export function AiQualityBadge({ confidence }: AiQualityBadgeProps) {
  const label = confidence >= 70 ? 'Dobry wynik' : confidence >= 40 ? 'Częściowy wynik' : 'Słaby materiał'
  const color = confidence >= 70 ? '#77BA8A' : confidence >= 40 ? '#D4960A' : '#E57373'
  const bg    = confidence >= 70 ? 'rgba(119,186,138,0.12)' : confidence >= 40 ? 'rgba(212,150,10,0.1)' : 'rgba(229,115,115,0.1)'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      color, background: bg,
      border: `1px solid ${color}44`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label} — {confidence}%
    </span>
  )
}

// ── AiUploadRules ─────────────────────────────────────────────────────────────

export interface AiUploadRulesConfig {
  formats: string[]
  maxSizeMb: number
  maxFiles?: number
  minFiles?: number
  /** Shown in expandable tips section */
  tips?: string[]
}

interface AiUploadRulesProps {
  config: AiUploadRulesConfig
}

export function AiUploadRules({ config }: AiUploadRulesProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 14,
      borderRadius: 7,
      background: 'var(--color-surface-soft)',
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
    }}>
      {/* Summary row */}
      <div style={{ padding: '7px 12px', lineHeight: 1.8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 6px' }}>
        <span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Formaty:</span>{' '}
          {config.formats.join(' · ')}
        </span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Maks.:</span>{' '}
          {config.maxSizeMb} MB
        </span>
        {config.maxFiles != null && (
          <>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Zdjęcia:</span>{' '}
              {config.minFiles ?? 1}–{config.maxFiles}
            </span>
          </>
        )}
        {config.tips && config.tips.length > 0 && (
          <>
            <span style={{ opacity: 0.3 }}>|</span>
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? '▲ Ukryj wskazówki' : '▼ Wskazówki'}
            </button>
          </>
        )}
      </div>

      {/* Expandable tips */}
      {expanded && config.tips && (
        <div style={{
          padding: '6px 12px 10px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {config.tips.map((t, i) => (
            <div key={i} style={{ color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              <span style={{ color: '#77BA8A', marginRight: 5 }}>✓</span>{t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AiReliabilityBanner ───────────────────────────────────────────────────────
// Renders the quality-control report produced by computeXxxReliability().
// Shows state tier (strong/partial/weak/blocked), confidence, issues, and
// a confirmation warning when requires_confirmation is true.

import type { ReliabilityReport, ReliabilityState } from '@/services/ai/engines/reliability'

interface StateConfig {
  label: string
  color: string
  bg: string
  icon: string
}

const RELIABILITY_STATE_CONFIG: Record<ReliabilityState, StateConfig> = {
  strong:  { label: 'Wysoka pewność',    color: '#77BA8A', bg: 'rgba(119,186,138,0.08)', icon: '✓' },
  partial: { label: 'Częściowa pewność', color: '#D4960A', bg: 'rgba(212,150,10,0.07)',  icon: '≈' },
  weak:    { label: 'Niska pewność',     color: '#E57373', bg: 'rgba(229,115,115,0.07)', icon: '⚠' },
  blocked: { label: 'Zablokowany',       color: '#D32F2F', bg: 'rgba(211,47,47,0.08)',   icon: '✕' },
}

interface AiReliabilityBannerProps {
  report: ReliabilityReport
  /** When true, render a minimal inline pill only (no issues list) */
  compact?: boolean
}

export function AiReliabilityBanner({ report, compact = false }: AiReliabilityBannerProps) {
  const [showInfo, setShowInfo] = useState(false)

  const cfg          = RELIABILITY_STATE_CONFIG[report.state]
  const visibleIssues = report.issues.filter(i => i.severity !== 'info')
  const infoIssues    = report.issues.filter(i => i.severity === 'info')

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        color: cfg.color, background: cfg.bg,
        border: `1px solid ${cfg.color}44`,
      }}>
        <span>{cfg.icon}</span>
        {cfg.label} — {report.confidence}%
      </span>
    )
  }

  return (
    <div style={{
      borderRadius: 8, border: `1px solid ${cfg.color}44`,
      background: cfg.bg, padding: '10px 14px', marginBottom: 12,
    }}>
      {/* Header row: state pill + summary */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: (visibleIssues.length > 0 || report.requires_confirmation) ? 8 : 0,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          color: cfg.color, background: `${cfg.color}22`,
          border: `1px solid ${cfg.color}55`, flexShrink: 0,
        }}>
          {cfg.icon} {cfg.label}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
          {report.summary}
        </span>
      </div>

      {/* Confirmation warning bar */}
      {report.requires_confirmation && (
        <div style={{
          padding: '6px 10px', borderRadius: 5,
          marginBottom: visibleIssues.length > 0 ? 8 : 0,
          background: 'rgba(229,115,115,0.1)', border: '1px solid rgba(229,115,115,0.25)',
          fontSize: 12, color: '#C62828', fontWeight: 500,
        }}>
          ⚠ Wymagane potwierdzenie przed przekazaniem do kosztorysu
        </div>
      )}

      {/* Issues: critical + warnings */}
      {visibleIssues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visibleIssues.map((issue, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, lineHeight: 1.5 }}>
              <span style={{
                flexShrink: 0, marginTop: 1, fontSize: 12,
                color: issue.severity === 'critical' ? '#D32F2F' : '#B5830A',
              }}>
                {issue.severity === 'critical' ? '✕' : '△'}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {issue.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Info toggle */}
      {infoIssues.length > 0 && (
        <div style={{ marginTop: visibleIssues.length > 0 ? 6 : 0 }}>
          <button
            type="button"
            onClick={() => setShowInfo(s => !s)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--color-text-muted)', padding: 0,
            }}
          >
            {showInfo ? '▲ Ukryj szczegóły' : `▼ ${infoIssues.length} informacji diagnostycznych`}
          </button>
          {showInfo && (
            <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {infoIssues.map((issue, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  ℹ {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { AiProgressSteps } from './AiProgressSteps'
