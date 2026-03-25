// =============================================================================
// AnalysisSections — Section renderers for AnalysisResult review UI
// =============================================================================
// Each renderer:
//   - renders only when it has real data (no fake placeholders)
//   - uses AnalysisSectionCard for consistent collapsible UI
//   - is ready for future pipeline output

import type {
  DocumentLineItem,
  DetectedMaterial,
  WorkScopeItem,
  SuggestedEstimateItem,
} from '@/services/ai/analysis.types'
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

export function SuggestedEstimateSection({ items }: { items: SuggestedEstimateItem[] }) {
  if (!items || items.length === 0) return null

  return (
    <AnalysisSectionCard title="Proponowane pozycje wyceny" count={items.length} icon="📊">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={headCol}>Pozycja</th>
              <th style={headCol}>J.m.</th>
              <th style={headRight}>Ilość</th>
              <th style={headRight}>Cena j.</th>
              <th style={headRight}>Pewność</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={colStyle}>{item.name}</td>
                <td style={colStyle}>{item.unit ?? '—'}</td>
                <td style={rightCol}>{item.quantity != null ? item.quantity : '—'}</td>
                <td style={rightCol}>{item.unit_price != null ? item.unit_price.toFixed(2) : '—'}</td>
                <td style={rightCol}>{item.confidence != null ? `${item.confidence}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalysisSectionCard>
  )
}
