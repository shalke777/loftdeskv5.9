// =============================================================================
// ProjectAnalysisSections — Section renderers for ProjectAnalysisResult review UI
// =============================================================================
// Used by ProjectAnalysisPage to render the structured project analysis output.
// Each section is independently renderable — renders null if no data.

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type {
  ProjectAnalysisResult,
  ProjectRoom,
  ProjectMaterial,
  ProjectScopeItem,
  ProjectEstimateItem,
} from '@/services/ai/engines/project.types'
import type { EstimateItem } from '@/entities/estimate/model'
import { AiReliabilityBanner } from '@/shared/ui/AiGuidance'
import type { ReliabilityReport } from '@/services/ai/engines/reliability'
import { AnalysisSectionCard } from './AnalysisSectionCard'
import { useServiceCatalog, matchCatalogItem } from '@/features/service-catalog'

const colStyle:   React.CSSProperties = { padding: '6px 4px' }
const rightCol:   React.CSSProperties = { ...colStyle, textAlign: 'right' }
const headCol:    React.CSSProperties = { ...colStyle, fontWeight: 600 }
const headRight:  React.CSSProperties = { ...headCol,  textAlign: 'right' }

function badge(
  label: string,
  color: string,
  bg: string,
): React.ReactElement {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px',
      borderRadius: 6, fontSize: 10, fontWeight: 600,
      background: bg, color,
    }}>
      {label}
    </span>
  )
}

function priorityBadge(priority: 'required' | 'likely' | 'optional') {
  switch (priority) {
    case 'required': return badge('Obowiązkowa', 'var(--color-brand)', 'rgba(26,92,50,0.12)')
    case 'likely':   return badge('Prawdopodobna', 'var(--color-info)', 'rgba(96,165,250,0.12)')
    case 'optional': return badge('Opcjonalna', 'var(--color-text-muted)', 'rgba(138,143,152,0.12)')
  }
}

// ── Project header summary ───────────────────────────────────────────────────

export function ProjectSummaryBar({ result }: { result: ProjectAnalysisResult }) {
  const conf = result.confidence
  const confColor = conf >= 70 ? 'var(--color-brand)' : conf >= 40 ? 'var(--color-accent)' : 'var(--color-error)'

  const typeLabel: Record<string, string> = {
    architectural_drawing: '📐 Rzut architektoniczny',
    design_visualization:  '🎨 Wizualizacja',
    technical_spec:        '📋 Specyfikacja techniczna',
    mixed:                 '📄 Dokument mieszany',
    unknown:               '❓ Nieznany typ',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      padding: '10px 14px', borderRadius: 8,
      background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)',
      fontSize: 12, marginBottom: 12,
    }}>
      <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
        {typeLabel[result.project_type] ?? typeLabel.unknown}
      </span>
      {result.project_name && (
        <span style={{ color: 'var(--color-text-muted)' }}>— {result.project_name}</span>
      )}
      {result.total_area_m2 !== null && (
        <span style={{ color: 'var(--color-text-muted)' }}>
          🏗 {result.total_area_m2} m² łącznie
        </span>
      )}
      {result.building_type && (
        <span style={{ color: 'var(--color-text-muted)' }}>{result.building_type}</span>
      )}
      <span style={{ marginLeft: 'auto', fontWeight: 600, color: confColor }}>
        Pewność: {conf}%
      </span>
    </div>
  )
}

// ── Rooms detected ───────────────────────────────────────────────────────────

export function ProjectRoomsSection({ rooms }: { rooms: ProjectRoom[] }) {
  if (rooms.length === 0) return null
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <AnalysisSectionCard title="Pomieszczenia z projektu" count={rooms.length} icon="🏠">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rooms.map((room, i) => {
          const isOpen = expanded === i
          return (
            <div
              key={i}
              style={{
                borderRadius: 7,
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
                background: isOpen ? 'var(--color-surface-soft)' : 'transparent',
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px',
                  background: isOpen
                    ? 'var(--color-surface-hover, rgba(99,102,241,0.07))'
                    : 'var(--color-surface-soft, rgba(0,0,0,0.03))',
                  border: 'none',
                  cursor: 'pointer', fontSize: 13,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontWeight: 600, flex: 1 }}>{room.name}</span>
                {room.area_m2 !== null && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 8 }}>
                    {room.area_m2} m²
                  </span>
                )}
                {room.height_m !== null && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 8 }}>
                    h={room.height_m} m
                  </span>
                )}
                {isOpen
                  ? <ChevronUp size={14} color="var(--color-text-muted)" />
                  : <ChevronDown size={14} color="var(--color-text-muted)" />
                }
              </button>

              {isOpen && (
                <div style={{ padding: '0 12px 12px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {room.floor_finish && (
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', marginRight: 6 }}>Podłoga:</span>
                      {room.floor_finish}
                    </div>
                  )}
                  {room.wall_finish && (
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', marginRight: 6 }}>Ściany:</span>
                      {room.wall_finish}
                    </div>
                  )}
                  {room.ceiling_finish && (
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', marginRight: 6 }}>Sufit:</span>
                      {room.ceiling_finish}
                    </div>
                  )}
                  {room.fixtures.length > 0 && (
                    <div>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: 3 }}>Armatura / wyposażenie:</div>
                      <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
                        {room.fixtures.map((f, fi) => <li key={fi}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {room.installations.length > 0 && (
                    <div>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: 3 }}>Instalacje:</div>
                      <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
                        {room.installations.map((inst, ii) => <li key={ii}>{inst}</li>)}
                      </ul>
                    </div>
                  )}
                  {room.notes.length > 0 && (
                    <div style={{ marginTop: 4, padding: '6px 10px', borderRadius: 5, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: 'var(--color-text-secondary)' }}>
                      {room.notes.map((n, ni) => <div key={ni}>📝 {n}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AnalysisSectionCard>
  )
}

// ── Finish materials ─────────────────────────────────────────────────────────

export function ProjectMaterialsSection({ materials }: { materials: ProjectMaterial[] }) {
  if (materials.length === 0) return null

  return (
    <AnalysisSectionCard title="Materiały wykończeniowe" count={materials.length} icon="🧱">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={headCol}>Materiał</th>
              <th style={headCol}>Specyfikacja</th>
              <th style={headCol}>Pomieszczenie</th>
              <th style={headRight}>Ilość</th>
              <th style={headCol}>J.m.</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ ...colStyle, fontWeight: 600 }}>{m.name}</td>
                <td style={{ ...colStyle, color: 'var(--color-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.specification ?? '—'}
                </td>
                <td style={{ ...colStyle, color: 'var(--color-text-muted)', fontSize: 11 }}>{m.room ?? '—'}</td>
                <td style={rightCol}>{m.quantity !== null ? m.quantity : '—'}</td>
                <td style={colStyle}>{m.unit ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalysisSectionCard>
  )
}

// ── Work scope from project ───────────────────────────────────────────────────

export function ProjectScopeSection({ items }: { items: ProjectScopeItem[] }) {
  if (items.length === 0) return null

  // Group by room
  const byRoom = new Map<string, ProjectScopeItem[]>()
  for (const item of items) {
    const key = item.room ?? 'Ogólne / cały obiekt'
    if (!byRoom.has(key)) byRoom.set(key, [])
    byRoom.get(key)!.push(item)
  }

  return (
    <AnalysisSectionCard title="Zakres prac z projektu" count={items.length} icon="🔧">
      {Array.from(byRoom.entries()).map(([room, roomItems]) => (
        <div key={room} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {room}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {roomItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'var(--color-surface-soft)', fontSize: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span>{item.description}</span>
                  {item.quantity !== null && item.unit && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                      — {item.quantity} {item.unit}
                    </span>
                  )}
                  {item.notes && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      ({item.notes})
                    </span>
                  )}
                  {item.provenance === 'dependency_inferred' && (
                    <div style={{ fontSize: 9, color: 'var(--color-info)', marginTop: 2, fontStyle: 'italic' }}>⚙ wynika z zależności</div>
                  )}
                  {item.provenance === 'confirmation_needed' && (
                    <div style={{ fontSize: 9, color: 'var(--color-accent)', marginTop: 2, fontStyle: 'italic' }}>? wymaga potwierdzenia</div>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {priorityBadge(item.priority)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </AnalysisSectionCard>
  )
}

// ── Suggested estimate items ─────────────────────────────────────────────────

function projectItemsToEstimate(items: ProjectEstimateItem[], catalog?: import('@/entities/service_catalog/model').ServiceCatalogItem[]): EstimateItem[] {
  return items.map((e, i) => {
    const result = catalog?.length ? matchCatalogItem(e.name, catalog) : { best: null, alternatives: [] }
    const match = result.best
    // Never insert quantity=0 — use 1 as safe default (user adjusts after)
    const safeQty = (typeof e.quantity === 'number' && e.quantity > 0) ? e.quantity : 1
    return {
      id: crypto.randomUUID(),
      name: match?.canonical_name ?? e.name,
      description: e.notes ?? '',
      unit: e.unit || 'm²',
      quantity: safeQty,
      unit_price: 0,
      vat_rate: 8,
      sort_order: i + 1,
      catalog_item_id: match?.catalog_item_id ?? null,
    }
  })
}

/** Convert work_scope_from_project items to ProjectEstimateItem shape so they can be merged into the transfer. */
function scopeToEstimateItems(scope: ProjectScopeItem[]): ProjectEstimateItem[] {
  return scope.map(s => ({
    name:       s.description,
    unit:       s.unit ?? 'ryczałt',
    quantity:   s.quantity ?? 1,
    unit_price: null,
    confidence: s.confidence,
    source:     'project_derived' as const,
    notes:      s.notes ?? null,
    provenance: s.provenance,
  }))
}

export function ProjectEstimateSection({
  items,
  scopeItems = [],
  projectName,
  reliabilityReport,
  onTransfer,
  isTransferring,
}: {
  items:             ProjectEstimateItem[]
  scopeItems?:       ProjectScopeItem[]
  projectName:       string | null
  reliabilityReport?: ReliabilityReport
  onTransfer?:       (items: EstimateItem[]) => void
  isTransferring?:   boolean
}) {
  const { data: catalog } = useServiceCatalog()
  const transferring = isTransferring ?? false
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  // Merge scope items + estimate items, deduplicating by name (estimate items win on collision)
  const mergedItems: ProjectEstimateItem[] = (() => {
    const estimateNames = new Set(items.map(e => e.name.toLowerCase().trim()))
    const scopeConverted = scopeToEstimateItems(scopeItems)
      .filter(s => !estimateNames.has(s.name.toLowerCase().trim()))
    return [...scopeConverted, ...items]
  })()

  if (mergedItems.length === 0) return null

  const isBlocked    = reliabilityReport?.state === 'blocked'
  const needsConfirm = reliabilityReport?.requires_confirmation ?? false

  function doTransfer() {
    if (transferring) return
    setAwaitingConfirm(false)
    const estimateItems = projectItemsToEstimate(mergedItems, catalog)
    onTransfer?.(estimateItems)
  }

  function handleTransfer() {
    if (isBlocked || transferring) return
    if (needsConfirm && !awaitingConfirm) {
      setAwaitingConfirm(true)
      return
    }
    doTransfer()
  }

  return (
    <AnalysisSectionCard title="Proponowane pozycje wyceny" count={mergedItems.length} icon="📊">
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
        Draft na podstawie projektu — zakres prac i pozycje AI. Uzupełnij ceny jednostkowe przed wysłaniem oferty.
      </div>

      {[
        { label: '📐 Z zakresu projektu', items: mergedItems.filter(e => e.source === 'project_derived'), show: mergedItems.filter(e => e.source === 'project_derived').length > 0 },
        { label: '🤖 Uzupełnione przez AI', items: mergedItems.filter(e => e.source === 'ai_suggestion'), show: mergedItems.filter(e => e.source === 'ai_suggestion').length > 0 },
        { label: '⚙ Z zależności materiałowych', items: mergedItems.filter(e => e.provenance === 'dependency_inferred'), show: mergedItems.filter(e => e.provenance === 'dependency_inferred').length > 0 },
      ].filter(g => g.show).map(group => (
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
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, i) => {
                  const lowConf = item.confidence < 40
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', opacity: lowConf ? 0.65 : 1 }}>
                      <td style={colStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {item.name}
                          {(() => {
                            if (!catalog?.length) return null
                            const matchResult = matchCatalogItem(item.name, catalog)
                            if (matchResult.best && matchResult.best.tier === 'strong') {
                              return <span title={`Katalog: ${matchResult.best.canonical_name} (${matchResult.best.match_reason})`} style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'var(--color-success-soft)', color: 'var(--color-success)', fontWeight: 600, whiteSpace: 'nowrap' }}>📚</span>
                            }
                            if (matchResult.best && matchResult.best.tier === 'partial') {
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <span title={`Częściowe: ${matchResult.best.canonical_name} (${matchResult.best.confidence}%, ${matchResult.best.match_reason})`} style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(212,150,10,0.1)', color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>📚?</span>
                                  {matchResult.alternatives.length > 0 && <span title={`Alternatywy: ${matchResult.alternatives.map(a => a.canonical_name).join(', ')}`} style={{ fontSize: 8, padding: '0 3px', borderRadius: 3, background: 'rgba(212,150,10,0.06)', color: 'var(--color-accent)', cursor: 'help', whiteSpace: 'nowrap' }}>+{matchResult.alternatives.length}</span>}
                                </span>
                              )
                            }
                            if (matchResult.alternatives.length > 0) {
                              return <span title={`Brak dopasowania. Sugestie: ${matchResult.alternatives.map(a => a.canonical_name).join(', ')}`} style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(229,115,115,0.08)', color: 'var(--color-error)', fontWeight: 600, whiteSpace: 'nowrap' }}>❌ uzupełnij</span>
                            }
                            return <span title="Pozycja własna — uzupełnij ręcznie" style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'var(--color-surface-soft)', color: 'var(--color-text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap' }}>✍️ własna</span>
                          })()}
                        </span>
                        {item.notes && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{item.notes}</div>
                        )}
                      </td>
                      <td style={colStyle}>{item.unit}</td>
                      <td style={rightCol}>
                        {item.quantity > 0 ? item.quantity : '—'}
                      </td>
                      <td style={rightCol}>
                        <span style={{ color: item.confidence >= 70 ? 'var(--color-brand)' : item.confidence >= 40 ? 'var(--color-accent)' : 'var(--color-error)' }}>
                          {item.confidence}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

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
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--color-error)' }}>
            ⚠ Pewność analizy jest niska — pozycje wymagają ręcznej weryfikacji.
          </p>
          <p style={{ margin: '0 0 10px', color: 'var(--color-text-secondary)' }}>
            Sprawdź ilości i ceny po przeniesieniu. Czy kontynuować?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={doTransfer}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', color: 'var(--color-error)', background: 'rgba(229,115,115,0.12)', border: '1px solid rgba(229,115,115,0.4)' }}
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
            width: '100%', padding: '13px 20px', fontSize: 14, fontWeight: 700,
            color: (isBlocked || transferring) ? 'rgba(100,100,120,0.7)' : '#ffffff',
            background: (isBlocked || transferring)
              ? 'rgba(100,100,120,0.08)'
              : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            border: `1.5px solid ${(isBlocked || transferring) ? 'rgba(100,100,120,0.2)' : '#6366f1'}`,
            borderRadius: 10,
            cursor: (transferring || isBlocked) ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.15s, filter 0.15s',
            opacity: (transferring || isBlocked) ? 0.6 : 1,
            boxShadow: (isBlocked || transferring) ? 'none' : '0 2px 8px rgba(99,102,241,0.30)',
            letterSpacing: '0.01em',
          }}
          title={isBlocked ? 'Analiza zablokowana — popraw błędy przed przeniesieniem' : undefined}
          onMouseEnter={e => { if (!transferring && !isBlocked) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
        >
          {isBlocked ? '⛔ Analiza zablokowana' : transferring ? '⏳ Zapisywanie wyceny…' : '📋 Zapisz jako nową wycenę →'}
        </button>
      </div>
    </AnalysisSectionCard>
  )
}

// ── Assumptions & missing info ───────────────────────────────────────────────

export function ProjectTransparencySection({
  assumptions,
  missingInfo,
  notes,
  warnings,
}: {
  assumptions:  string[]
  missingInfo:  string[]
  notes:        string[]
  warnings:     string[]
}) {
  const hasContent = assumptions.length > 0 || missingInfo.length > 0 || notes.length > 0 || warnings.length > 0
  if (!hasContent) return null

  return (
    <AnalysisSectionCard title="Założenia i brakujące dane" icon="⚠️">
      {warnings.length > 0 && (
        <div style={{
          marginBottom: 10, padding: '8px 12px', borderRadius: 7, fontSize: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--color-danger)',
        }}>
          {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      {missingInfo.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent)', marginBottom: 4 }}>
            Brakujące dane do pełnej wyceny:
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: 'var(--color-text-secondary)' }}>
            {missingInfo.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {assumptions.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-info)', marginBottom: 4 }}>
            Przyjęte założenia:
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: 'var(--color-text-muted)' }}>
            {assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            Notatki projektowe:
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: 'var(--color-text-muted)' }}>
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </AnalysisSectionCard>
  )
}
