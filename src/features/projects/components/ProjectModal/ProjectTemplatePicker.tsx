// =============================================================================
// ProjectTemplatePicker.tsx — Wybór szablonu przy tworzeniu projektu
// =============================================================================

import { Building2, Droplets, FilePlus2, Layers, Paintbrush, Utensils } from 'lucide-react'
import type { Project } from '@/entities/project/model'

export interface ProjectTemplateValues {
  name: string
  notes: string
  status: Project['status']
  address: string
}

interface Template {
  id: string
  icon: React.ElementType
  label: string
  description: string
  data: ProjectTemplateValues
}

const TEMPLATES: Template[] = [
  {
    id: 'blank',
    icon: FilePlus2,
    label: 'Pusty projekt',
    description: 'Zacznij od zera',
    data: { name: '', notes: '', status: 'offer', address: '' },
  },
  {
    id: 'kitchen',
    icon: Utensils,
    label: 'Remont kuchni',
    description: 'Glazura, biały montaż, meble na wymiar',
    data: {
      name: 'Remont kuchni',
      notes: 'Zakres: demontaż starych okładzin, hydroizolacja, glazura, biały montaż, meble kuchenne na wymiar.',
      status: 'offer',
      address: '',
    },
  },
  {
    id: 'bathroom',
    icon: Droplets,
    label: 'Remont łazienki',
    description: 'Hydroizolacja, glazura, biały montaż',
    data: {
      name: 'Remont łazienki',
      notes: 'Zakres: hydroizolacja, glazura i terakota, biały montaż (wanna / prysznic), akcesoria łazienkowe.',
      status: 'offer',
      address: '',
    },
  },
  {
    id: 'general',
    icon: Layers,
    label: 'Remont generalny',
    description: 'Pełny zakres prac remontowych',
    data: {
      name: 'Remont generalny mieszkania',
      notes: 'Pełny zakres: posadzki, ściany, sufity, instalacje elektryczne i hydrauliczne, wykończenie.',
      status: 'offer',
      address: '',
    },
  },
  {
    id: 'painting',
    icon: Paintbrush,
    label: 'Malowanie',
    description: 'Gruntowanie, gipsowanie, malowanie',
    data: {
      name: 'Malowanie mieszkania',
      notes: 'Zakres: gruntowanie, szpachlowanie ubytków, gipsowanie, malowanie ścian i sufitów (2 warstwy).',
      status: 'offer',
      address: '',
    },
  },
  {
    id: 'developer',
    icon: Building2,
    label: 'Stan deweloperski',
    description: 'Kompleksowe wykończenie od zera',
    data: {
      name: 'Wykończenie stanu deweloperskiego',
      notes: 'Kompleksowe wykończenie mieszkania deweloperskiego: podłogi, płytki, malowanie, instalacje, meble.',
      status: 'offer',
      address: '',
    },
  },
]

interface Props {
  onSelect: (data: ProjectTemplateValues) => void
}

export function ProjectTemplatePicker({ onSelect }: Props) {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Wybierz szablon — pre-uzupełni nazwę i zakres. Możesz edytować wszystkie pola.
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
        gap: 10,
      }}>
        {TEMPLATES.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.data)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: '14px 12px',
                background: 'var(--color-surface-soft)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 8px)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-brand)'
                e.currentTarget.style.background = 'var(--color-brand-2, rgba(26,92,50,0.06))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.background = 'var(--color-surface-soft)'
              }}
            >
              <Icon size={20} color="var(--color-brand)" strokeWidth={1.75} />
              <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                {t.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                {t.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
