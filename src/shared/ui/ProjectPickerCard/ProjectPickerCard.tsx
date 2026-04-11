import { useState, useMemo } from 'react'
import { FolderOpen, InboxIcon, MapPin } from 'lucide-react'
import type { CSSProperties } from 'react'

interface Project {
  id: string
  number: string
  name: string
  status: string
  address?: string
  investment_address?: string | null
}

interface Props {
  projects: Project[]
  loading: boolean
  selectedId: string
  onSelect: (id: string) => void
  onNext: () => void
  nextLabel: string
  onBack?: () => void
  backLabel?: string
}

export function ProjectPickerCard({
  projects, loading, selectedId, onSelect, onNext, onBack, backLabel, nextLabel,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.number.toLowerCase().includes(q) ||
      (p.address ?? '').toLowerCase().includes(q) ||
      (p.investment_address ?? '').toLowerCase().includes(q)
    )
  }, [projects, search])

  const selected = projects.find(p => p.id === selectedId)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      {onBack && (
        <div style={{ textAlign: 'right', marginBottom: 6 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ fontSize: 13, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {backLabel ?? '← Wróć'}
          </button>
        </div>
      )}

      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <FolderOpen size={22} color="var(--color-brand)" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text-primary, #111)' }}>
            Wybierz projekt
          </h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Wyniki analizy zostaną powiązane z wybranym projektem.
        </p>

        {/* States */}
        {loading ? (
          <div style={emptyStyle}>
            <div style={spinnerStyle} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Ładowanie projektów…</span>
          </div>
        ) : projects.length === 0 ? (
          <div style={emptyStyle}>
            <InboxIcon size={28} color="var(--color-text-muted)" style={{ opacity: 0.5 }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '4px 0 0', textAlign: 'center' }}>
              Brak projektów.<br />
              <span style={{ fontSize: 12 }}>Utwórz projekt w zakładce <strong>Projekty</strong>, aby korzystać z analizy AI.</span>
            </p>
          </div>
        ) : (
          <>
            {/* Search (show when >5 projects) */}
            {projects.length > 5 && (
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj projektu…"
                style={searchStyle}
              />
            )}

            {/* Project list */}
            <div style={listStyle}>
              {filtered.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '16px 0', textAlign: 'center' }}>
                  Brak wyników dla „{search}"
                </p>
              ) : filtered.map(p => {
                const isSelected = p.id === selectedId
                const addr = p.investment_address || p.address || ''
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelect(p.id)}
                    style={{
                      ...itemStyle,
                      borderColor: isSelected ? 'var(--color-brand)' : 'var(--color-border)',
                      background: isSelected ? 'rgba(26,92,50,0.08)' : 'var(--color-surface)',
                      boxShadow: isSelected ? '0 0 0 2px rgba(26,92,50,0.2)' : 'none',
                      color: 'var(--color-text)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        border: isSelected ? '5px solid var(--color-brand)' : '2px solid var(--color-border-dark)',
                        background: isSelected ? 'var(--color-surface)' : 'transparent',
                        boxSizing: 'border-box',
                      }} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {p.number}
                          </span>
                          <StatusDot status={p.status} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary, #111)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </div>
                        {addr && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={9} style={{ flexShrink: 0 }} />
                            {addr}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Selected project summary */}
            {selected && (
              <div style={selectedSummaryStyle}>
                Wybrany: <strong>{selected.number} · {selected.name}</strong>
              </div>
            )}

            {/* CTA */}
            <button
              type="button"
              disabled={!selectedId}
              onClick={onNext}
              style={{
                ...ctaStyle,
                background: selectedId ? 'var(--color-brand)' : 'var(--color-surface-soft)',
                color: selectedId ? '#fff' : 'var(--color-text-muted)',
                cursor: selectedId ? 'pointer' : 'default',
                border: selectedId ? 'none' : '1px solid var(--color-border)',
              }}
            >
              {nextLabel}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Status dot ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--color-brand)',
  in_progress: 'var(--color-info)',
  completed: 'var(--color-text-muted)',
  on_hold: 'var(--color-accent)',
  draft: 'var(--color-text-muted)',
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'var(--color-text-muted)'
  return (
    <span
      title={status}
      style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: 'var(--color-surface, #fff)',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  padding: '24px 24px 20px',
  marginBottom: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

const emptyStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '32px 16px', gap: 10,
}

const searchStyle: CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', fontSize: 13,
  background: 'var(--color-surface-soft)', outline: 'none',
  marginBottom: 10, boxSizing: 'border-box',
}

const listStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  maxHeight: 320, overflowY: 'auto', marginBottom: 14,
  paddingRight: 2,
}

const itemStyle: CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1.5px solid', cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
  display: 'flex', alignItems: 'center',
  fontFamily: 'inherit', outline: 'none',
}

const selectedSummaryStyle: CSSProperties = {
  fontSize: 12, color: 'var(--color-text-muted)',
  marginBottom: 10, paddingLeft: 2,
}

const ctaStyle: CSSProperties = {
  width: '100%', padding: '13px 0', borderRadius: 10,
  color: '#fff', fontWeight: 600, fontSize: 15,
  border: 'none', letterSpacing: 0.2,
  transition: 'background 0.15s',
}

const spinnerStyle: CSSProperties = {
  width: 24, height: 24, borderRadius: '50%',
  border: '2.5px solid var(--color-border)',
  borderTopColor: 'var(--color-primary)',
  animation: 'spin 0.8s linear infinite',
}
