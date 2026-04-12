import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
  count?: number
}

interface Props {
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function StatusFilter({ options, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <div ref={ref} className={`status-filter${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="status-filter__trigger"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="status-filter__label">
          {selected?.label}
          {selected?.count !== undefined && (
            <span className="status-filter__badge">{selected.count}</span>
          )}
        </span>
        <ChevronDown size={13} className={`status-filter__chevron${open ? ' status-filter__chevron--open' : ''}`} aria-hidden />
      </button>

      {open && (
        <ul className="status-filter__menu" role="listbox">
          {options.map(o => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`status-filter__item${o.value === value ? ' status-filter__item--active' : ''}`}
              onMouseDown={() => { onChange(o.value); setOpen(false) }}
            >
              <span className="status-filter__item-label">{o.label}</span>
              {o.count !== undefined && (
                <span className="status-filter__item-count">{o.count}</span>
              )}
              {o.value === value && <Check size={12} className="status-filter__item-check" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
