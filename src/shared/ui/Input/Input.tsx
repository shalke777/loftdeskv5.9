import { InputHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, error, className, ...props }, ref) {
  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
      <input ref={ref} className={clsx('input', error && 'input--error', className)} {...props} />
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  )
})
