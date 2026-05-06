import { useTheme, type Theme } from '@/shared/hooks/useTheme'

interface ThemeOption {
  id: Theme
  label: string
  /** Dominant surface color — fills the swatch bg */
  surface: string
  /** Accent stripe color — bottom band or ring color */
  accent: string
  /** Subtle mid tone for the upper-half gradient */
  mid: string
}

const OPTIONS: ThemeOption[] = [
  { id: 'dark',   label: 'Ciemny',   surface: '#181f17', mid: '#1e2a1c', accent: '#3EA85A' },
  { id: 'ocean',  label: 'Morski',   surface: '#0e1828', mid: '#1a2d48', accent: '#3B82F6' },
  { id: 'forest', label: 'Leśny',    surface: '#eef5ee', mid: '#d8ead9', accent: '#1A5C32' },
  { id: 'sunset', label: 'Zmierzch', surface: '#fff6f0', mid: '#fce8da', accent: '#C0440C' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Wybierz motyw"
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
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
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 10,
              cursor: 'pointer',
              padding: 0,
              border: isActive
                ? `2.5px solid ${opt.accent}`
                : '2px solid transparent',
              outline: isActive ? `3px solid ${opt.accent}30` : 'none',
              outlineOffset: 1,
              boxShadow: isActive
                ? `0 0 0 1px ${opt.accent}40, 0 2px 8px ${opt.accent}25`
                : '0 1px 3px rgba(0,0,0,0.12)',
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
            }}
          >
            {/* Upper 60% — surface gradient */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                bottom: '38%',
                background: `linear-gradient(160deg, ${opt.mid} 0%, ${opt.surface} 100%)`,
              }}
            />
            {/* Lower 40% — accent band */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                top: '62%',
                background: opt.accent,
                opacity: 0.92,
              }}
            />
            {/* Active checkmark dot */}
            {isActive && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                  zIndex: 2,
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
