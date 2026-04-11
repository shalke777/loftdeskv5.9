import { useState } from 'react'
import { Calculator, FileText, Receipt, Shield } from 'lucide-react'
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

  return (
    <div>
      {/* Tab bar — scrollable on mobile, no wrap */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 16px 0',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
        flexShrink: 0,
      }}>
        {visibleTabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                fontSize: 13, fontWeight: active ? 700 : 500,
                flexShrink: 0, whiteSpace: 'nowrap',
                color: active ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                marginBottom: -1, borderRadius: '4px 4px 0 0',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
        {!canUseKsef && (
          <button
            type="button"
            onClick={() => navigate({ to: '/billing' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', fontSize: 13, fontWeight: 500,
              flexShrink: 0, whiteSpace: 'nowrap',
              color: 'var(--color-text-muted)', background: 'none', border: 'none',
              cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -1,
            }}
          >
            <Shield size={15} />
            KSeF <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--color-sidebar-active)', color: 'var(--color-brand)', marginLeft: 2 }}>Pro</span>
          </button>
        )}
      </div>

      {/* Tab content — hide inner PageHeaders (they duplicate the tab label) */}
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
