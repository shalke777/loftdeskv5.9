// =============================================================================
// ProjectAnalysisSections — Section renderers for ProjectAnalysisResult review UI
// =============================================================================
// Used by ProjectAnalysisPage to render the structured project analysis output.
// Each section is independently renderable — renders null if no data.

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type {
  ProjectAnalysisResult,
  ProjectRoom,
  ProjectMaterial,
  ProjectScopeItem,
  ProjectEstimateItem,
} from '@/services/ai/engines/project.types'
import type { EstimateItem } from '@/entities/estimate/model'
import { AnalysisSectionCard } from './AnalysisSectionCard'

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
    case 'required': return badge('Obowiązkowa', '#77BA8A', 'rgba(119,186,138,0.12)')
    case 'likely':   return badge('Prawdopodobna', '#60A5FA', 'rgba(96,165,250,0.12)')
    case 'optional': return badge('Opcjonalna', '#8A8F98', 'rgba(138,143,152,0.12)')
  }
}

// ── Project header summary ───────────────────────────────────────────────────

export function ProjectSummaryBar({ result }: { result: ProjectAnalysisResult }) {
  const conf = result.confidence
  const confColor = conf >= 70 ? '#77BA8A' : conf >= 40 ? '#D4960A' : '#E57373'

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
                  padding: '8px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13,
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
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
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

const ESTIMATE_DRAFT_KEY = 'estimate_form_draft'

function projectItemsToEstimate(items: ProjectEstimateItem[]): EstimateItem[] {
  return items.map((e, i) => ({
    id: crypto.randomUUID(),
    name: e.name,
    description: e.notes ?? '',
    unit: e.unit,
    quantity: e.quantity,
    unit_price: 0,
    vat_rate: 8,
    sort_order: i + 1,
  }))
}

export function ProjectEstimateSection({ items, projectName }: { items: ProjectEstimateItem[]; projectName: string | null }) {
  if (items.length === 0) return null

  const navigate = useNavigate()
  const [transferring, setTransferring] = useState(false)

  function handleTransfer() {
    if (transferring) return
    setTransferring(true)
    const estimateItems = projectItemsToEstimate(items)
    const draft = {
      name: projectName
        ? `Wycena — ${projectName}`
        : `Wycena z projektu — ${new Date().toLocaleDateString('pl-PL')}`,
      notes: 'Pozycje wygenerowane z analizy projektu AI. Uzupełnij ceny jednostkowe.',
      items: estimateItems,
      _source: 'project_analysis' as const,
    }
    try { sessionStorage.setItem(ESTIMATE_DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ }
    navigate({ to: '/estimates', search: { create: true } })
  }

  const projectDerived = items.filter(e => e.source === 'project_derived')
  const aiSuggested    = items.filter(e => e.source === 'ai_suggestion')

  return (
    <AnalysisSectionCard title="Proponowane pozycje wyceny" count={items.length} icon="📊">
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
        Draft na podstawie projektu. Uzupełnij ceny jednostkowe przed wysłaniem oferty.
      </div>

      {[
        { label: '📐 Z danych projektu', items: projectDerived, show: projectDerived.length > 0 },
        { label: '🤖 Uzupełnione przez AI', items: aiSuggested, show: aiSuggested.length > 0 },
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
                        {item.name}
                        {item.notes && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{item.notes}</div>
                        )}
                      </td>
                      <td style={colStyle}>{item.unit}</td>
                      <td style={rightCol}>
                        {item.quantity > 0 ? item.quantity : '—'}
                      </td>
                      <td style={rightCol}>
                        <span style={{ color: item.confidence >= 70 ? '#77BA8A' : item.confidence >= 40 ? '#D4960A' : '#E57373' }}>
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

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleTransfer}
          disabled={transferring}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 12, fontWeight: 600,
            color: transferring ? 'var(--color-text-muted)' : 'var(--color-primary)',
            background: 'var(--color-primary-soft)',
            border: `1px solid ${transferring ? 'var(--color-border)' : 'var(--color-primary)'}`,
            borderRadius: 8, cursor: transferring ? 'default' : 'pointer',
            opacity: transferring ? 0.6 : 1, transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!transferring) { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = '#fff' } }}
          onMouseLeave={e => { if (!transferring) { e.currentTarget.style.background = 'var(--color-primary-soft)'; e.currentTarget.style.color = 'var(--color-primary)' } }}
        >
          {transferring ? '⏳ Przenoszenie…' : '📋 Przenieś do wyceny'}
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
          color: 'var(--color-danger, #EF6B6B)',
        }}>
          {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      {missingInfo.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#D4960A', marginBottom: 4 }}>
            Brakujące dane do pełnej wyceny:
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: 'var(--color-text-secondary)' }}>
            {missingInfo.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {assumptions.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#60A5FA', marginBottom: 4 }}>
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
