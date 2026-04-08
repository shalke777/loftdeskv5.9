// =============================================================================
// AnalysisSectionCard — reusable collapsible section for analysis review UI
// =============================================================================
// Renders a section only when it has data. Supports future sections
// (detected_entities, detected_materials, work_scope, suggested_estimate_items)
// without requiring form restructuring.

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  title:        string
  count?:       number
  icon?:        React.ReactNode
  defaultOpen?: boolean
  children:     React.ReactNode
}

const wrapStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10, overflow: 'hidden',
  background: 'var(--color-surface-card, var(--color-surface-soft))',
}

export function AnalysisSectionCard({ title, count, icon, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={wrapStyle}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', border: 'none', cursor: 'pointer',
          background: open
            ? 'var(--color-surface-hover, rgba(99,102,241,0.06))'
            : 'var(--color-surface-soft, rgba(0,0,0,0.03))',
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          color: 'var(--color-text-secondary)',
          transition: 'background 0.15s',
          borderBottom: open ? '1px solid var(--color-border)' : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <span>{icon}</span>}
          {title}
          {count != null && count > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 20, height: 18, padding: '0 5px',
              borderRadius: 9, fontSize: 10, fontWeight: 700,
              background: 'var(--color-primary-soft, rgba(99,102,241,0.12))',
              color: 'var(--color-primary)',
            }}>
              {count}
            </span>
          )}
        </span>
        {open
          ? <ChevronUp size={15} color="var(--color-text-muted)" />
          : <ChevronDown size={15} color="var(--color-text-muted)" />
        }
      </button>
      {open && (
        <div style={{ padding: '12px 14px 14px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
