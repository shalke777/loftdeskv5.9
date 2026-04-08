// =============================================================================
// ComparisonResultView — renders ProjectComparisonResult for contractor review
// =============================================================================
// Used by ProjectAnalysisPage to show project-vs-reality comparison output.
// Displays:
//   ✅ Zgodne z projektem (matching)
//   🟠 Brakujące na zdjęciach (missing_from_reality)
//   🟡 Różnice od projektu (changed)
//   ⚪ Niepotwierdzone (uncertain)
//   🔵 Dodatkowe prace ze zdjęć (scope_additions)
// Plus optional "Transfer scope additions to estimate" action.

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ProjectComparisonResult, ComparisonDiff, ProjectScopeItem } from '@/services/ai/engines/project.types'
import { computeComparisonReliability } from '@/services/ai/engines/reliability'
import type { ReliabilityReport } from '@/services/ai/engines/reliability'
import { AiReliabilityBanner } from '@/shared/ui/AiGuidance'
import { AnalysisSectionCard } from './AnalysisSectionCard'

// ── Draft key (shared with other analysis sections) ──────────────────────────
const ESTIMATE_DRAFT_KEY = 'estimate_form_draft'

interface Props {
  result:      ProjectComparisonResult
  projectName?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const colStyle: React.CSSProperties = { padding: '6px 4px', fontSize: 12 }

function confColor(c: number): string {
  return c >= 70 ? 'var(--color-brand)' : c >= 40 ? 'var(--color-accent)' : 'var(--color-error)'
}

interface DiffRowProps {
  diff: ComparisonDiff
}
function DiffRow({ diff }: DiffRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails =
    diff.project_description ||
    diff.reality_description  ||
    diff.impact_on_scope      ||
    diff.notes

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        background: 'var(--color-surface-soft)',
        marginBottom: 4,
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontWeight: 500 }}>{diff.element}</span>
        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              border: 'none',
              background: expanded
                ? 'var(--color-surface-hover, rgba(99,102,241,0.08))'
                : 'var(--color-surface-soft, rgba(0,0,0,0.04))',
              borderRadius: 5,
              cursor: 'pointer',
              padding: '2px 7px', fontSize: 11, color: 'var(--color-text-muted)',
              transition: 'background 0.15s',
            }}
          >
            {expanded
              ? <><ChevronUp size={11} />ukryj</>
              : <><ChevronDown size={11} />szczegóły</>
            }
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
          {diff.project_description && (
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 60, ...colStyle }}>Projekt:</span>
              <span style={colStyle}>{diff.project_description}</span>
            </div>
          )}
          {diff.reality_description && (
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 60, ...colStyle }}>Zdjęcia:</span>
              <span style={colStyle}>{diff.reality_description}</span>
            </div>
          )}
          {diff.impact_on_scope && (
            <div style={{
              marginTop: 4, padding: '4px 8px', borderRadius: 4, fontSize: 11,
              background: 'rgba(212,150,10,0.08)', color: 'var(--color-accent)',
            }}>
              ℹ {diff.impact_on_scope}
            </div>
          )}
          {diff.notes && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              {diff.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section component ─────────────────────────────────────────────────────────

interface SectionProps {
  title:   string
  icon:    string
  diffs:   ComparisonDiff[]
  accent:  string     // CSS color or rgba for left border accent
}

function DiffSection({ title, icon, diffs, accent }: SectionProps) {
  if (diffs.length === 0) return null
  return (
    <AnalysisSectionCard title={title} count={diffs.length} icon={icon}>
      <div style={{
        borderLeft: `3px solid ${accent}`,
        paddingLeft: 8,
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {diffs.map((d, i) => <DiffRow key={i} diff={d} />)}
      </div>
    </AnalysisSectionCard>
  )
}

// ── Scope additions (extra work from photos) ──────────────────────────────────

interface ScopeAdditionsProps {
  items:            ProjectScopeItem[]
  projectName:      string | null | undefined
  reliabilityReport?: ReliabilityReport
}

function ScopeAdditionsSection({ items, projectName, reliabilityReport }: ScopeAdditionsProps) {
  if (items.length === 0) return null

  const navigate = useNavigate()
  const [transferring, setTransferring]     = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  const isBlocked    = reliabilityReport?.state === 'blocked'
  const needsConfirm = reliabilityReport?.requires_confirmation ?? false

  function doTransfer() {
    if (transferring) return
    setTransferring(true)
    setAwaitingConfirm(false)
    const estimateItems = items.map((item, i) => ({
      id: crypto.randomUUID(),
      name: item.description,
      description: item.notes ?? '',
      unit: item.unit ?? 'ryczałt',
      quantity: item.quantity ?? 1,
      unit_price: 0,
      vat_rate: 8,
      sort_order: i + 1,
    }))
    const draft = {
      name: projectName
        ? `Prace dodatkowe — ${projectName}`
        : `Prace dodatkowe ze zdjęć — ${new Date().toLocaleDateString('pl-PL')}`,
      notes: 'Prace wykryte na zdjęciach, nieobecne w projekcie. Uzupełnij ceny jednostkowe.',
      items: estimateItems,
      _source: 'project_analysis' as const,
    }
    try { sessionStorage.setItem(ESTIMATE_DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ }
    navigate({ to: '/estimates', search: { create: true } })
  }

  function handleTransferClick() {
    if (isBlocked || transferring) return
    if (needsConfirm && !awaitingConfirm) {
      setAwaitingConfirm(true)
      return
    }
    doTransfer()
  }

  return (
    <AnalysisSectionCard title="Dodatkowe prace ze zdjęć" count={items.length} icon="🔵">
      <div style={{
        fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontStyle: 'italic',
      }}>
        Prace wykryte na zdjęciach pomieszczenia, których nie ma w projekcie.
        Mogą dotyczyć demontażu istniejącego stanu lub prac nieujętych w dokumentacji.
      </div>

      <div style={{
        borderLeft: '3px solid rgba(96,165,250,0.5)',
        paddingLeft: 8,
        display: 'flex', flexDirection: 'column', gap: 4,
        marginBottom: 12,
      }}>
        {items.map((item, i) => (
          <div key={i} style={{
            padding: '7px 10px', borderRadius: 6,
            background: 'var(--color-surface-soft)', fontSize: 12,
          }}>
            <div style={{ fontWeight: 500 }}>{item.description}</div>
            {(item.quantity !== null && item.unit) && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {item.quantity} {item.unit}
              </div>
            )}
            {item.notes && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation gate — shown when requires_confirmation and user clicked transfer */}
      {awaitingConfirm && (
        <div style={{
          padding: '10px 12px', marginBottom: 10, borderRadius: 6,
          background: 'rgba(229,115,115,0.08)', border: '1px solid rgba(229,115,115,0.3)',
          fontSize: 12,
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--color-error)' }}>
            ⚠ Pewność analizy jest niska — przekazanie może wymagać poprawek.
          </p>
          <p style={{ margin: '0 0 10px', color: 'var(--color-text-secondary)' }}>
            Uzupełnij ceny i sprawdź pozycje po przeniesieniu. Czy kontynuować?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={doTransfer}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 600,
                borderRadius: 6, cursor: 'pointer',
                color: 'var(--color-error)', background: 'rgba(229,115,115,0.12)',
                border: '1px solid rgba(229,115,115,0.4)',
              }}
            >
              Tak, przenieś mimo to
            </button>
            <button
              type="button"
              onClick={() => setAwaitingConfirm(false)}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 600,
                borderRadius: 6, cursor: 'pointer',
                color: 'var(--color-text-muted)', background: 'transparent',
                border: '1px solid var(--color-border)',
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleTransferClick}
          disabled={transferring || isBlocked}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 12, fontWeight: 600,
            color: isBlocked ? 'var(--color-text-muted)' : transferring ? 'var(--color-text-muted)' : 'var(--color-primary)',
            background: isBlocked ? 'var(--color-surface-soft)' : 'var(--color-primary-soft)',
            border: `1px solid ${isBlocked || transferring ? 'var(--color-border)' : 'var(--color-primary)'}`,
            borderRadius: 8, cursor: (transferring || isBlocked) ? 'not-allowed' : 'pointer',
            opacity: (transferring || isBlocked) ? 0.55 : 1,
          }}
          title={isBlocked ? 'Analiza zablokowana — popraw błędy przed przeniesieniem' : undefined}
        >
          {isBlocked ? '⛔ Analiza zablokowana' : transferring ? '⏳ Przenoszenie…' : '📋 Dodaj do wyceny'}
        </button>
      </div>
    </AnalysisSectionCard>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ComparisonResultView({ result, projectName }: Props) {
  const matching  = result.diffs.filter(d => d.category === 'matching')
  const missing   = result.diffs.filter(d => d.category === 'missing_from_reality')
  const changed   = result.diffs.filter(d => d.category === 'changed')
  const uncertain = result.diffs.filter(d => d.category === 'uncertain')

  const reliabilityReport = computeComparisonReliability(result)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        padding: '10px 14px', borderRadius: 8,
        background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)',
        fontSize: 12,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)', flex: 1 }}>
          🔍 Porównanie projekt vs rzeczywistość
        </span>
        <AiReliabilityBanner report={reliabilityReport} compact />
      </div>

      {/* Summary sentence */}
      {result.summary && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, fontSize: 12,
          background: 'var(--color-surface-soft)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
        }}>
          {result.summary}
        </div>
      )}

      {/* Reliability banner — full (shows issues when state is not strong) */}
      {reliabilityReport.state !== 'strong' && (
        <AiReliabilityBanner report={reliabilityReport} />
      )}

      {/* Engine warnings (separate from reliability — comparison engine-level notes) */}
      {result.warnings.length > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, fontSize: 11,
          background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.25)',
          color: 'var(--color-accent)', lineHeight: 1.7,
        }}>
          {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      {/* No data at all */}
      {result.diffs.length === 0 && result.scope_additions.length === 0 && (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          color: 'var(--color-text-muted)', fontSize: 13,
          border: '2px dashed var(--color-border)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
          <p style={{ margin: 0 }}>
            Zbyt mało danych do porównania. Dodaj więcej zdjęć pomieszczenia z różnych kątów.
          </p>
        </div>
      )}

      {/* Matching */}
      <DiffSection
        title="Zgodne z projektem"
        icon="✅"
        diffs={matching}
        accent="rgba(26,92,50,0.6)"
      />

      {/* Missing from reality */}
      <DiffSection
        title="Brakujące na zdjęciach"
        icon="🟠"
        diffs={missing}
        accent="rgba(212,150,10,0.6)"
      />

      {/* Changed */}
      <DiffSection
        title="Różnice od projektu"
        icon="🟡"
        diffs={changed}
        accent="rgba(234,179,8,0.5)"
      />

      {/* Uncertain */}
      <DiffSection
        title="Niepotwierdzone"
        icon="⚪"
        diffs={uncertain}
        accent="rgba(138,143,152,0.4)"
      />

      {/* Extra scope from reality */}
      <ScopeAdditionsSection
        items={result.scope_additions}
        projectName={projectName}
        reliabilityReport={reliabilityReport}
      />
    </div>
  )
}
