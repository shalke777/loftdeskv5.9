import { useState } from 'react'
import { Calculator, FileText, Receipt, Shield, Lock } from 'lucide-react'
import { EstimatesPage } from '@/features/estimates/components/EstimatesPage'
import { ContractsPage } from '@/features/contracts/components/ContractsPage'
import { InvoicesPage } from '@/features/invoices/components/InvoicesPage'
import { KsefPage } from '@/features/ksef/components/KsefPage'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { useNavigate } from '@tanstack/react-router'

type DocTab = 'estimates' | 'contracts' | 'invoices' | 'ksef'

const TABS: { id: DocTab; label: string; icon: typeof Calculator }[] = [
  { id: 'estimates', label: 'Wyceny',  icon: Calculator },
  { id: 'contracts', label: 'Umowy',   icon: FileText },
  { id: 'invoices',  label: 'Faktury', icon: Receipt },
  { id: 'ksef',      label: 'KSeF',    icon: Shield },
]

export function DocumentsRoutePage() {
  const canUseKsef = useFeatureAccess('ksef')
  const navigate = useNavigate()
  const [tab, setTab] = useState<DocTab>('estimates')

  const visibleTabs = TABS.filter(t => t.id !== 'ksef' || canUseKsef)
  const allTabs = canUseKsef ? TABS : [...TABS.filter(t => t.id !== 'ksef'), { id: 'ksef' as DocTab, label: 'KSeF', icon: Shield }]

  return (
    <div className="docs-hub">
      {/* Segment control tab bar */}
      <div className="docs-hub__tabs">
        {allTabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          const locked = t.id === 'ksef' && !canUseKsef
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => locked ? navigate({ to: '/billing' }) : setTab(t.id)}
              className={`docs-hub__tab${active ? ' docs-hub__tab--active' : ''}${locked ? ' docs-hub__tab--locked' : ''}`}
              title={locked ? 'Dostępne w planie Pro' : t.label}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {locked && <Lock size={10} className="docs-hub__tab-lock" />}
            </button>
          )
        })}
      </div>

      {/* Tab content — inner PageHeaders hidden via CSS (.docs-hub-content) */}
      <div className="docs-hub-content">
        {tab === 'estimates' && <EstimatesPage />}
        {tab === 'contracts' && <ContractsPage />}
        {tab === 'invoices'  && <InvoicesPage />}
        {tab === 'ksef'      && (canUseKsef
          ? <KsefPage />
          : <AccessNotice title="KSeF w planie Pro/Business" description="Integracja KSeF jest dostępna od planu Pro." actionLabel="Przejdź do billing" onAction={() => navigate({ to: '/billing' })} />
        )}
      </div>
    </div>
  )
}
