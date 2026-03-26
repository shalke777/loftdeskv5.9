// =============================================================================
// AnalysisSections — Section renderers for AnalysisResult review UI
// =============================================================================
// Each renderer:
//   - renders only when it has real data (no fake placeholders)
//   - uses AnalysisSectionCard for consistent collapsible UI
//   - is ready for future pipeline output

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type {
  DocumentLineItem,
  DetectedMaterial,
  WorkScopeItem,
  SuggestedEstimateItem,
} from '@/services/ai/analysis.types'
import type { EstimateItem } from '@/entities/estimate/model'
import { AnalysisSectionCard } from './AnalysisSectionCard'

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

import { getTaskById, BATHROOM_CATEGORIES } from '@/services/ai/bathroom-task-library'
import type { TaskPriority } from '@/services/ai/bathroom-task-library'

const ESTIMATE_DRAFT_KEY = 'estimate_form_draft'

function suggestedToEstimateItems(items: SuggestedEstimateItem[]): EstimateItem[] {
  return items.map((s, i) => ({
    id: crypto.randomUUID(),
    name: s.name,
    description: s.notes ?? '',
    unit: s.unit,
    quantity: s.quantity,
    unit_price: s.unit_price ?? 0,
    vat_rate: 8,
    sort_order: i + 1,
  }))
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
    case 'required':    return { label: 'Obowiązkowa', color: '#77BA8A', bg: 'rgba(119,186,138,0.12)' }
    case 'likely':      return { label: 'Prawdopodobna', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' }
    case 'conditional': return { label: 'Warunkowa', color: '#D4960A', bg: 'rgba(212,150,10,0.12)' }
    case 'optional':    return { label: 'Opcjonalna', color: '#8A8F98', bg: 'rgba(138,143,152,0.12)' }
  }
}

function getCategoryName(categoryId: string): string {
  return BATHROOM_CATEGORIES.find(c => c.id === categoryId)?.name ?? ''
}

export function SuggestedEstimateSection({ items }: { items: SuggestedEstimateItem[] }) {
  if (!items || items.length === 0) return null

  const navigate = useNavigate()
  const [transferring, setTransferring] = useState(false)

  function handleTransfer() {
    if (transferring) return
    setTransferring(true)
    const estimateItems = suggestedToEstimateItems(items)
    const draft = {
      name: `Wycena z analizy AI — ${new Date().toLocaleDateString('pl-PL')}`,
      notes: 'Pozycje wygenerowane z analizy AI. Sprawdź ilości i uzupełnij ceny.',
      items: estimateItems,
      _source: 'ai_analysis' as const,
    }
    try { sessionStorage.setItem(ESTIMATE_DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ }
    navigate({ to: '/estimates', search: { create: true } })
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

  return (
    <AnalysisSectionCard title="Proponowane pozycje wyceny" count={items.length} icon="📊">
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
        Draft — propozycja AI dopasowana do biblioteki pozycji łazienkowych. Ilości i pozycje wymagają potwierdzenia.
      </div>

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
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={colStyle}>
                        {item.name}
                        {catName && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{catName}</div>
                        )}
                        {item.notes && !item.libId && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{item.notes}</div>
                        )}
                      </td>
                      <td style={colStyle}>{item.unit ?? '—'}</td>
                      <td style={rightCol}>{item.quantity != null ? item.quantity : '—'}</td>
                      <td style={rightCol}>{item.confidence != null ? `${item.confidence}%` : '—'}</td>
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
            borderRadius: 8,
            cursor: transferring ? 'default' : 'pointer', transition: 'background 0.15s',
            opacity: transferring ? 0.6 : 1,
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
