import { forwardRef, SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

export interface SelectOption {
  value: string
  label: string
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, className, placeholder = 'Wybierz opcję', ...props },
  ref,
) {
  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
      <select ref={ref} className={clsx('input', className)} {...props}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
})
