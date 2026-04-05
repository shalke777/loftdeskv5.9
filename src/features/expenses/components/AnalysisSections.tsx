// =============================================================================
// AnalysisSections v2 — Section renderers for AnalysisResult review UI
// =============================================================================
// v2: quantity hints, coverage engine (missing tasks), professional estimator layout.

import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type {
  DocumentLineItem,
  DetectedMaterial,
  WorkScopeItem,
  SuggestedEstimateItem,
} from '@/services/ai/analysis.types'
import type { EstimateItem } from '@/entities/estimate/model'
import { AiReliabilityBanner } from '@/shared/ui/AiGuidance'
import type { ReliabilityReport } from '@/services/ai/engines/reliability'
import { AnalysisSectionCard } from './AnalysisSectionCard'
import { useServiceCatalog, matchCatalogItem } from '@/features/service-catalog'
import type { CatalogMatchResult } from '@/features/service-catalog/lib/catalog-matcher'

// ── Line Items (active today) ────────────────────────────────────────────────

const colStyle: React.CSSProperties = { padding: '6px 4px' }
const rightCol: React.CSSProperties = { ...colStyle, textAlign: 'right' }
const headCol:  React.CSSProperties = { ...colStyle, fontWeight: 600 }
const headRight: React.CSSProperties = { ...headCol, textAlign: 'right' }

export function LineItemsSection({ items: rawItems }: { items: DocumentLineItem[] }) {
  const items = rawItems.filter(it =>
    it.name != null || it.quantity != null || it.net_amount != null || it.gross_amount != null
  )
  if (items.length === 0) return null

  return (
    <AnalysisSectionCard title="Pozycje dokumentu" count={items.length} icon="📋">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={headCol}>#</th>
              <th style={headCol}>Nazwa</th>
              <th style={headRight}>Ilość</th>
              <th style={headCol}>J.m.</th>
              <th style={headRight}>Netto</th>
              <th style={headRight}>VAT%</th>
              <th style={headRight}>Brutto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ ...colStyle, color: 'var(--color-text-muted)' }}>{i + 1}</td>
                <td style={{ ...colStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name ?? '—'}
                </td>
                <td style={rightCol}>{item.quantity != null ? item.quantity : '—'}</td>
                <td style={colStyle}>{item.unit ?? '—'}</td>
                <td style={rightCol}>{item.net_amount != null ? item.net_amount.toFixed(2) : '—'}</td>
                <td style={rightCol}>{item.vat_rate != null ? `${item.vat_rate}%` : '—'}</td>
                <td style={{ ...rightCol, fontWeight: 600 }}>{item.gross_amount != null ? item.gross_amount.toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalysisSectionCard>
  )
}

// ── Detected Materials (future — renders only with real data) ────────────────

export function DetectedMaterialsSection({ items }: { items: DetectedMaterial[] }) {
  if (!items || items.length === 0) return null

  return (
    <AnalysisSectionCard title="Wykryte materiały" count={items.length} icon="🧱">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={headCol}>Materiał</th>
              <th style={headCol}>Kategoria</th>
              <th style={headRight}>Ilość</th>
              <th style={headCol}>J.m.</th>
              <th style={headRight}>Pewność</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={colStyle}>{m.name}</td>
                <td style={{ ...colStyle, color: 'var(--color-text-muted)' }}>{m.category ?? '—'}</td>
                <td style={rightCol}>{m.quantity != null ? m.quantity : '—'}</td>
                <td style={colStyle}>{m.unit ?? '—'}</td>
                <td style={rightCol}>{m.confidence != null ? `${m.confidence}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalysisSectionCard>
  )
}

// ── Work Scope (future — renders only with real data) ────────────────────────

export function WorkScopeSection({ items }: { items: WorkScopeItem[] }) {
  if (!items || items.length === 0) return null

  return (
    <AnalysisSectionCard title="Proponowany zakres prac" count={items.length} icon="🔧">
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
        {items.map((w, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <span>{w.description}</span>
            {w.category && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                ({w.category})
              </span>
            )}
            {w.confidence != null && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                — {w.confidence}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </AnalysisSectionCard>
  )
}

// ── Suggested Estimate Items (future — renders only with real data) ──────────

import { getTaskById, BATHROOM_CATEGORIES, checkCoverage } from '@/services/ai/bathroom-task-library'
import type { TaskPriority, CoverageResult } from '@/services/ai/bathroom-task-library'

const ESTIMATE_DRAFT_KEY = 'estimate_form_draft'

function suggestedToEstimateItems(items: SuggestedEstimateItem[], catalog?: import('@/entities/service_catalog/model').ServiceCatalogItem[]): EstimateItem[] {
  return items.map((s, i) => {
    const result = catalog?.length ? matchCatalogItem(s.name, catalog) : { best: null, alternatives: [] }
    const match = result.best
    return {
      id: crypto.randomUUID(),
      name: match?.canonical_name ?? s.name,
      description: s.notes ?? '',
      unit: s.unit,
      quantity: s.quantity,
      unit_price: s.unit_price ?? 0,
      vat_rate: 8,
      sort_order: i + 1,
      catalog_item_id: match?.catalog_item_id ?? null,
    }
  })
}

/** Extract library_id from notes field (AI puts it there) */
function extractLibraryId(notes?: string | null): string | null {
  if (!notes) return null
  // Match known task id patterns like "waterproof_wet", "tile_floor" etc.
  const match = notes.match(/\b([a-z]+_[a-z_]+)\b/)
  if (match) {
    const task = getTaskById(match[1])
    if (task) return match[1]
  }
  return null
}

function getPriorityLabel(priority: TaskPriority): { label: string; color: string; bg: string } {
  switch (priority) {
    case 'required':    return { label: 'Obowiązkowa', color: '#1A5C32', bg: 'rgba(26,92,50,0.12)' }
    case 'likely':      return { label: 'Prawdopodobna', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' }
    case 'conditional': return { label: 'Warunkowa', color: '#B8742A', bg: 'rgba(212,150,10,0.12)' }
    case 'optional':    return { label: 'Opcjonalna', color: '#6E6A60', bg: 'rgba(138,143,152,0.12)' }
  }
}

function getCategoryName(categoryId: string): string {
  return BATHROOM_CATEGORIES.find(c => c.id === categoryId)?.name ?? ''
}

export function SuggestedEstimateSection({ items, reliabilityReport }: { items: SuggestedEstimateItem[]; reliabilityReport?: ReliabilityReport }) {
  if (!items || items.length === 0) return null

  const navigate = useNavigate()
  const { data: catalog } = useServiceCatalog()
  const [transferring, setTransferring] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  const isBlocked    = reliabilityReport?.state === 'blocked'
  const needsConfirm = reliabilityReport?.requires_confirmation ?? false

  // Pre-compute match results for display
  const matchResults = useMemo(() => {
    if (!catalog?.length) return new Map<number, CatalogMatchResult>()
    const m = new Map<number, CatalogMatchResult>()
    items.forEach((item, i) => {
      m.set(i, matchCatalogItem(item.name, catalog))
    })
    return m
  }, [items, catalog])

  function doTransfer() {
    if (transferring) return
    setTransferring(true)
    setAwaitingConfirm(false)
    const estimateItems = suggestedToEstimateItems(items, catalog)
    const draft = {
      name: `Wycena z analizy AI — ${new Date().toLocaleDateString('pl-PL')}`,
      notes: 'Pozycje wygenerowane z analizy AI. Sprawdź ilości i uzupełnij ceny.',
      items: estimateItems,
      _source: 'ai_analysis' as const,
    }
    try { sessionStorage.setItem(ESTIMATE_DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ }
    navigate({ to: '/estimates', search: { create: true } })
  }

  function handleTransfer() {
    if (isBlocked || transferring) return
    if (needsConfirm && !awaitingConfirm) {
      setAwaitingConfirm(true)
      return
    }
    doTransfer()
  }

  // Enrich items with library data for categorization
  const enriched = items.map(item => {
    const libId = extractLibraryId(item.notes)
    const task = libId ? getTaskById(libId) : null
    return { ...item, libId, task }
  })

  // Group by priority
  const required = enriched.filter(e => e.task?.priority === 'required')
  const likely   = enriched.filter(e => e.task?.priority === 'likely')
  const rest     = enriched.filter(e => !e.task || (e.task.priority !== 'required' && e.task.priority !== 'likely'))

  const groups = [
    { label: '✅ Pozycje obowiązkowe', items: required, show: required.length > 0 },
    { label: '📋 Pozycje prawdopodobne', items: likely, show: likely.length > 0 },
    { label: '🔍 Pozycje warunkowe / dodatkowe', items: rest, show: rest.length > 0 },
  ]

  // Coverage engine — check what's missing
  const presentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of enriched) {
      if (item.libId) ids.add(item.libId)
    }
    return ids
  }, [enriched])

  const coverage = useMemo(() => checkCoverage(presentIds), [presentIds])

  return (
    <AnalysisSectionCard title="Proponowane pozycje wyceny" count={items.length} icon="📊">
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
        Draft — propozycja AI dopasowana do biblioteki pozycji łazienkowych. Ilości i pozycje wymagają potwierdzenia.
      </div>

      {/* Coverage bar */}
      <CoverageBar coverage={coverage} />

      {/* Catalog match summary */}
      {catalog && catalog.length > 0 && (() => {
        const strong = Array.from(matchResults.values()).filter(r => r.best?.tier === 'strong').length
        const partial = Array.from(matchResults.values()).filter(r => r.best?.tier === 'partial').length
        const unmatched = items.length - strong - partial
        return (
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8, flexWrap: 'wrap' }}>
            <span>Dopasowanie do katalogu:</span>
            {strong > 0 && <span style={{ color: 'var(--color-success, #16a34a)' }}>📚 {strong} pewnych</span>}
            {partial > 0 && <span style={{ color: '#B8742A' }}>📚? {partial} częściowych</span>}
            {unmatched > 0 && <span style={{ color: 'var(--color-text-muted)' }}>✍️ {unmatched} własnych</span>}
          </div>
        )
      })()}

      {groups.filter(g => g.show).map(group => (
        <div key={group.label} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
            {group.label}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={headCol}>Pozycja</th>
                  <th style={headCol}>J.m.</th>
                  <th style={headRight}>Ilość</th>
                  <th style={headRight}>Pewność</th>
                  <th style={headCol}>Status</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, i) => {
                  const prio = item.task ? getPriorityLabel(item.task.priority) : null
                  const catName = item.task ? getCategoryName(item.task.category) : ''
                  const lowConf = item.confidence < 40
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', opacity: lowConf ? 0.6 : 1 }}>
                      <td style={colStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {item.name}
                          {(() => {
                            const globalIdx = items.indexOf(item)
                            const mr = matchResults.get(globalIdx)
                            if (mr?.best?.tier === 'strong') return <span title={`Katalog: ${mr.best.canonical_name} (${mr.best.match_reason})`} style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'var(--color-success-soft, #dcfce7)', color: 'var(--color-success, #16a34a)', fontWeight: 600, whiteSpace: 'nowrap' }}>📚</span>
                            if (mr?.best?.tier === 'partial') return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                <span title={`Częściowe: ${mr.best.canonical_name} (${mr.best.confidence}%, ${mr.best.match_reason})`} style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(212,150,10,0.1)', color: '#B8742A', fontWeight: 600, whiteSpace: 'nowrap' }}>📚?</span>
                                {mr.alternatives.length > 0 && <span title={`Alternatywy: ${mr.alternatives.map(a => a.canonical_name).join(', ')}`} style={{ fontSize: 8, padding: '0 3px', borderRadius: 3, background: 'rgba(212,150,10,0.06)', color: '#B8742A', cursor: 'help', whiteSpace: 'nowrap' }}>+{mr.alternatives.length}</span>}
                              </span>
                            )
                            if (mr?.alternatives && mr.alternatives.length > 0) return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                <span title={`Brak dopasowania. Sugestie: ${mr.alternatives.map(a => a.canonical_name).join(', ')}`} style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(229,115,115,0.08)', color: '#E57373', fontWeight: 600, whiteSpace: 'nowrap' }}>❌ uzupełnij</span>
                              </span>
                            )
                            return <span title="Pozycja własna — uzupełnij ręcznie" style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'var(--color-surface-soft, #f1f5f9)', color: 'var(--color-text-tertiary, #94a3b8)', fontWeight: 500, whiteSpace: 'nowrap' }}>✍️ własna</span>
                          })()}
                        </span>
                        {catName && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{catName}</div>
                        )}
                        {item.notes && !item.libId && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{item.notes}</div>
                        )}
                        {item.provenance === 'dependency_inferred' && (
                          <div style={{ fontSize: 9, color: '#60A5FA', marginTop: 2, fontStyle: 'italic' }}>⚙ wynika z zależności</div>
                        )}
                        {item.provenance === 'confirmation_needed' && (
                          <div style={{ fontSize: 9, color: '#B8742A', marginTop: 2, fontStyle: 'italic' }}>? wymaga potwierdzenia</div>
                        )}
                      </td>
                      <td style={colStyle}>{item.unit ?? '—'}</td>
                      <td style={rightCol}>
                        {item.quantity != null && item.quantity > 0 ? item.quantity : '—'}
                        {item.quantity === 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}> brak danych</span>}
                      </td>
                      <td style={rightCol}>
                        <span style={{ color: item.confidence >= 70 ? '#1A5C32' : item.confidence >= 40 ? '#B8742A' : '#E57373' }}>
                          {item.confidence != null ? `${item.confidence}%` : '—'}
                        </span>
                      </td>
                      <td style={colStyle}>
                        {prio ? (
                          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: prio.bg, color: prio.color }}>
                            {prio.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>AI</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Missing tasks section */}
      <MissingTasksSection coverage={coverage} />

      {reliabilityReport && reliabilityReport.state !== 'strong' && (
        <div style={{ marginTop: 8 }}>
          <AiReliabilityBanner report={reliabilityReport} compact />
        </div>
      )}

      {awaitingConfirm && (
        <div style={{
          padding: '10px 12px', marginTop: 8, borderRadius: 6,
          background: 'rgba(229,115,115,0.08)', border: '1px solid rgba(229,115,115,0.3)',
          fontSize: 12,
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#C62828' }}>
            ⚠ Pewność analizy jest niska — pozycje wymagają ręcznej weryfikacji.
          </p>
          <p style={{ margin: '0 0 10px', color: 'var(--color-text-secondary)' }}>
            Sprawdź ilości i ceny po przeniesieniu. Czy kontynuować?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={doTransfer}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', color: '#C62828', background: 'rgba(229,115,115,0.12)', border: '1px solid rgba(229,115,115,0.4)' }}
            >
              Tak, przenieś mimo to
            </button>
            <button
              type="button"
              onClick={() => setAwaitingConfirm(false)}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-muted)', background: 'transparent', border: '1px solid var(--color-border)' }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={handleTransfer}
          disabled={transferring || isBlocked}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 700,
            color: isBlocked ? 'var(--color-text-muted)' : transferring ? 'var(--color-text-muted)' : '#fff',
            background: isBlocked ? 'var(--color-surface-soft)' : transferring ? 'var(--color-surface-soft)' : 'var(--color-primary, #2563EB)',
            border: `1px solid ${isBlocked || transferring ? 'var(--color-border)' : 'var(--color-primary, #2563EB)'}`,
            borderRadius: 10,
            cursor: (transferring || isBlocked) ? 'not-allowed' : 'pointer', transition: 'background 0.15s, transform 0.1s',
            opacity: (transferring || isBlocked) ? 0.55 : 1,
          }}
          title={isBlocked ? 'Analiza zablokowana — popraw błędy przed przeniesieniem' : undefined}
          onMouseEnter={e => { if (!transferring && !isBlocked) e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { if (!transferring && !isBlocked) e.currentTarget.style.opacity = '1' }}
        >
          {isBlocked ? '⛔ Analiza zablokowana' : transferring ? '⏳ Przenoszenie…' : '📋 Przenieś do wyceny →'}
        </button>
      </div>
    </AnalysisSectionCard>
  )
}

// ── Coverage Bar ─────────────────────────────────────────────────────────────

function CoverageBar({ coverage }: { coverage: CoverageResult }) {
  const pct = coverage.coveragePercent
  const color = pct >= 80 ? '#1A5C32' : pct >= 50 ? '#B8742A' : '#E57373'
  const label = pct >= 80 ? 'Dobra' : pct >= 50 ? 'Częściowa' : 'Niska'

  return (
    <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: 'var(--color-surface-soft, #1E2024)', border: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          Pokrycie obowiązkowych pozycji
        </span>
        <span style={{ fontWeight: 600, color }}>{label} ({pct}%)</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      {coverage.brokenDependencies.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#B8742A' }}>
          ⚠️ {coverage.brokenDependencies.length} pozycja(e) bez wymaganej zależności
        </div>
      )}
    </div>
  )
}

// ── Missing Tasks Section ────────────────────────────────────────────────────

function MissingTasksSection({ coverage }: { coverage: CoverageResult }) {
  const hasMissing = coverage.missingRequired.length > 0 || coverage.missingLikely.length > 0
  if (!hasMissing && coverage.unconfirmed.length === 0) return null

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(212,150,10,0.06)', border: '1px solid rgba(212,150,10,0.2)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#B8742A', marginBottom: 6 }}>
        ⚠️ Brakujące pozycje
      </div>

      {coverage.missingRequired.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#E57373', marginBottom: 2 }}>Brak obowiązkowych:</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.6 }}>
            {coverage.missingRequired.map(t => (
              <li key={t.id} style={{ color: 'var(--color-text-secondary)' }}>
                {t.name} <span style={{ color: 'var(--color-text-muted)' }}>({t.unit})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {coverage.missingLikely.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#60A5FA', marginBottom: 2 }}>Brak prawdopodobnych:</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.6 }}>
            {coverage.missingLikely.slice(0, 8).map(t => (
              <li key={t.id} style={{ color: 'var(--color-text-secondary)' }}>
                {t.name} <span style={{ color: 'var(--color-text-muted)' }}>— {t.when}</span>
              </li>
            ))}
            {coverage.missingLikely.length > 8 && (
              <li style={{ color: 'var(--color-text-muted)' }}>…i {coverage.missingLikely.length - 8} więcej</li>
            )}
          </ul>
        </div>
      )}

      {coverage.unconfirmed.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#B8742A', marginBottom: 2 }}>Do potwierdzenia ({coverage.unconfirmed.length}):</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.6 }}>
            {coverage.unconfirmed.slice(0, 6).map(t => (
              <li key={t.id} style={{ color: 'var(--color-text-secondary)' }}>
                {t.name} <span style={{ color: 'var(--color-text-muted)' }}>— {t.when}</span>
              </li>
            ))}
            {coverage.unconfirmed.length > 6 && (
              <li style={{ color: 'var(--color-text-muted)' }}>…i {coverage.unconfirmed.length - 6} więcej</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Clarification Questions Section (Interactive v1) ─────────────────────────

import type { ClarificationQuestion, ClarificationAnswer, QuestionSeverity } from '@/services/ai/engines/clarification.types'

const SEVERITY_CONFIG: Record<QuestionSeverity, { label: string; color: string; bg: string; border: string }> = {
  critical_for_scope:     { label: 'Krytyczne', color: '#E57373', bg: 'rgba(229,115,115,0.08)', border: 'rgba(229,115,115,0.25)' },
  important_for_accuracy: { label: 'Istotne',   color: '#B8742A', bg: 'rgba(212,150,10,0.07)',  border: 'rgba(212,150,10,0.22)' },
  optional_detail:        { label: 'Opcjonalne', color: '#6E6A60', bg: 'rgba(138,143,152,0.06)', border: 'rgba(138,143,152,0.18)' },
}

const CONFIRMED_GREEN = '#52A56E'
const CONFIRMED_BG    = 'rgba(82,165,110,0.08)'
const CONFIRMED_BDR   = 'rgba(82,165,110,0.25)'
const REJECTED_RED    = '#E57373'

function makeBtn(color: string, bg: string): React.CSSProperties {
  return { padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer', color, background: bg, border: `1px solid ${color}`, lineHeight: 1.5, fontFamily: 'inherit' }
}

const inputCss: React.CSSProperties = {
  fontSize: 12, padding: '3px 8px', borderRadius: 5,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
}

// ── Single interactive answer row ─────────────────────────────────────────────

function QuestionAnswerRow({
  question, answer, onAnswer, cfg,
}: {
  question: ClarificationQuestion
  answer:   ClarificationAnswer | undefined
  onAnswer: (a: ClarificationAnswer) => void
  cfg:      { color: string; bg: string; border: string }
}) {
  const [draft,   setDraft]   = useState('')
  const [editing, setEditing] = useState(false)

  const isAnswered = !!answer && !editing

  function submit(val: string | boolean | number) {
    onAnswer({ questionId: question.id, answerValue: val, answeredAt: new Date().toISOString(), source: 'user', affects: question.affects })
    setEditing(false)
    setDraft('')
  }

  function startEdit() {
    setEditing(true)
    setDraft(answer ? String(answer.answerValue) : '')
  }

  const answerLabel = answer
    ? question.answerType === 'yes_no'
      ? (answer.answerValue ? 'Tak' : 'Nie')
      : String(answer.answerValue)
    : null

  const labelColor = isAnswered && question.answerType === 'yes_no' && answer?.answerValue === false
    ? REJECTED_RED
    : CONFIRMED_GREEN

  return (
    <li style={{
      padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.5,
      background: isAnswered ? CONFIRMED_BG  : cfg.bg,
      border:    `1px solid ${isAnswered ? CONFIRMED_BDR : cfg.border}`,
      transition: 'background 0.15s',
    }}>
      {/* Question text + answered badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: isAnswered ? 'var(--color-text-muted)' : 'var(--color-text-primary)', flex: 1 }}>
          {question.text}
        </span>
        {isAnswered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>✓ {answerLabel}</span>
            <button type="button" onClick={startEdit}
              style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit' }}>
              zmień
            </button>
          </div>
        )}
      </div>

      {/* Answer controls — only shown when unanswered or editing */}
      {!isAnswered && (
        <div style={{ marginTop: 6 }}>
          {question.answerType === 'yes_no' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => submit(true)}  style={makeBtn(CONFIRMED_GREEN, 'rgba(82,165,110,0.10)')}>Tak</button>
              <button type="button" onClick={() => submit(false)} style={makeBtn(REJECTED_RED,   'rgba(229,115,115,0.10)')}>Nie</button>
            </div>
          )}
          {question.answerType === 'single_choice' && (question.options?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {question.options!.map(opt => (
                <button key={opt} type="button" onClick={() => submit(opt)}
                  style={makeBtn('var(--color-primary, #2D7DD2)', 'rgba(45,125,210,0.08)')}>
                  {opt}
                </button>
              ))}
            </div>
          )}
          {question.answerType === 'number' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && draft.trim() && submit(Number(draft))}
                style={{ ...inputCss, width: 80 }} placeholder="np. 12" />
              <button type="button" onClick={() => draft.trim() && submit(Number(draft))}
                style={makeBtn('var(--color-primary, #2D7DD2)', 'rgba(45,125,210,0.08)')}>OK</button>
            </div>
          )}
          {question.answerType === 'text' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                style={{ ...inputCss, flex: 1, resize: 'vertical', minHeight: 44 }} placeholder="Opisz…" />
              <button type="button" onClick={() => draft.trim() && submit(draft.trim())}
                style={makeBtn('var(--color-primary, #2D7DD2)', 'rgba(45,125,210,0.08)')}>OK</button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ── Grouped by severity ───────────────────────────────────────────────────────

function InteractiveQuestionGroup({
  severity, questions, answerMap, onAnswer,
}: {
  severity:  QuestionSeverity
  questions: ClarificationQuestion[]
  answerMap: Map<string, ClarificationAnswer>
  onAnswer:  (a: ClarificationAnswer) => void
}) {
  if (questions.length === 0) return null

  const cfg          = SEVERITY_CONFIG[severity]
  const answeredCount = questions.filter(q => answerMap.has(q.id)).length
  const allDone      = answeredCount === questions.length

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase',
        letterSpacing: '0.04em', display: 'flex', gap: 8, alignItems: 'center',
        color: allDone ? CONFIRMED_GREEN : cfg.color,
      }}>
        <span>{cfg.label}</span>
        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 10 }}>
          {answeredCount}/{questions.length}
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {questions.map(q => (
          <QuestionAnswerRow key={q.id} question={q} answer={answerMap.get(q.id)} onAnswer={onAnswer} cfg={cfg} />
        ))}
      </ul>
    </div>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────

export function ClarificationQuestionsSection({
  questions,
  answers  = [],
  onAnswer,
}: {
  questions: ClarificationQuestion[]
  answers?:  ClarificationAnswer[]
  onAnswer?: (answer: ClarificationAnswer) => void
}) {
  const [showOptional, setShowOptional] = useState(false)

  if (!questions || questions.length === 0) return null

  const answerMap = new Map(answers.map(a => [a.questionId, a]))
  const noop      = (_: ClarificationAnswer) => {}
  const handler   = onAnswer ?? noop

  const critical  = questions.filter(q => q.severity === 'critical_for_scope')
  const important = questions.filter(q => q.severity === 'important_for_accuracy')
  const optional  = questions.filter(q => q.severity === 'optional_detail')

  const totalAnswered = answers.length
  const remaining     = questions.length - totalAnswered

  return (
    <AnalysisSectionCard title="Pytania wymagające doprecyzowania" count={remaining > 0 ? remaining : undefined} icon="❓">
      {remaining > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
          Odpowiedzi ulepszają zakres prac i wycenę. Krytyczne pytania mają największy wpływ.
        </div>
      )}
      {remaining === 0 && (
        <div style={{ fontSize: 12, color: CONFIRMED_GREEN, marginBottom: 10, fontWeight: 600 }}>
          ✓ Wszystkie pytania zostały odpowiedziane.
        </div>
      )}

      <InteractiveQuestionGroup severity="critical_for_scope"     questions={critical}  answerMap={answerMap} onAnswer={handler} />
      <InteractiveQuestionGroup severity="important_for_accuracy" questions={important} answerMap={answerMap} onAnswer={handler} />

      {optional.length > 0 && !showOptional && (
        <button type="button" onClick={() => setShowOptional(true)}
          style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline', fontFamily: 'inherit' }}>
          + Pokaż pytania opcjonalne ({optional.length})
        </button>
      )}
      {optional.length > 0 && showOptional && (
        <>
          <InteractiveQuestionGroup severity="optional_detail" questions={optional} answerMap={answerMap} onAnswer={handler} />
          <button type="button" onClick={() => setShowOptional(false)}
            style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline', fontFamily: 'inherit' }}>
            − Ukryj pytania opcjonalne
          </button>
        </>
      )}
    </AnalysisSectionCard>
  )
}
