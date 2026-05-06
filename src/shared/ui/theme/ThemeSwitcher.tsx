import type { ReactNode } from 'react'
import { Moon, Droplets, Leaf, Sunset } from 'lucide-react'
import { useTheme, type Theme } from '@/shared/hooks/useTheme'

interface ThemeOption {
  id: Theme
  label: string
  icon: ReactNode
  bg: string
  accent: string
}

const OPTIONS: ThemeOption[] = [
  { id: 'dark',   label: 'Ciemny',  icon: <Moon size={13} />,     bg: '#131610', accent: '#3EA85A' },
  { id: 'ocean',  label: 'Morski',  icon: <Droplets size={13} />, bg: '#0B1220', accent: '#3B82F6' },
  { id: 'forest', label: 'Leśny',   icon: <Leaf size={13} />,     bg: '#F0F5F1', accent: '#1A5C32' },
  { id: 'sunset', label: 'Zmierzch', icon: <Sunset size={13} />,  bg: '#FFF8F4', accent: '#C0440C' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Wybierz motyw"
      className="flex items-center gap-1"
    >
      {OPTIONS.map((opt) => {
        const isActive = theme === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            aria-pressed={isActive}
            aria-label={`Motyw ${opt.label}`}
            title={opt.label}
            style={{ '--swatch-bg': opt.bg, '--swatch-accent': opt.accent } as React.CSSProperties}
            className={[
              'relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium',
              'border transition-all duration-150 select-none cursor-pointer',
              isActive
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-brand-foreground)] shadow-sm'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-border)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            <span aria-hidden="true" className="flex-shrink-0">{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
