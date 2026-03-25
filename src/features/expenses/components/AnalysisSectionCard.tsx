// =============================================================================
// AnalysisSectionCard — reusable collapsible section for analysis review UI
// =============================================================================
// Renders a section only when it has data. Supports future sections
// (detected_entities, detected_materials, work_scope, suggested_estimate_items)
// without requiring form restructuring.

import { useState } from 'react'

interface Props {
  title:       string
  count?:      number
  icon?:       string
  defaultOpen?: boolean
  children:    React.ReactNode
}

const headerStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
  color: 'var(--color-text-muted)',
}

const wrapStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 8, overflow: 'hidden',
  background: 'var(--color-surface-soft, rgba(0,0,0,0.02))',
}

export function AnalysisSectionCard({ title, count, icon, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={wrapStyle}>
      <button type="button" onClick={() => setOpen(v => !v)} style={headerStyle}>
        <span>
          {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
          {title}
          {count != null && count > 0 && ` (${count})`}
        </span>
        <span style={{ fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
