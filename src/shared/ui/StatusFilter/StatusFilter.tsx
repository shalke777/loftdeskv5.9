import { ChevronDown } from 'lucide-react'

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
  return (
    <div className={`status-filter${className ? ` ${className}` : ''}`}>
      <select
        className="status-filter__select"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}{o.count !== undefined ? ` (${o.count})` : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="status-filter__icon" aria-hidden />
    </div>
  )
}
