import { ArrowRight, FileText, FolderKanban, MessageSquareText, Receipt, Settings, Users } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { formatCurrency } from '@/shared/lib/formatters'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { usePortalTokens } from '@/features/portal/hooks/usePortalData'

const quickActions = [
  { icon: Users,        title: 'Dodaj kontrahenta', text: 'Uzupełnij bazę inwestorów i wykonawców.',    href: '/clients',   bg: 'var(--color-info-soft)',    border: '#93c5fd', iconBg: '#dbeafe', iconColor: 'var(--color-info)' },
  { icon: FileText,     title: 'Nowa wycena',        text: 'Przygotuj ofertę w układzie gotowym do PDF.', href: '/estimates', bg: 'var(--color-warning-soft)', border: '#fcd34d', iconBg: '#fef3c7', iconColor: 'var(--color-warning)' },
  { icon: Receipt,      title: 'Nowa faktura',       text: 'Wystaw dokument i przygotuj XML do KSeF.',   href: '/invoices',  bg: 'var(--color-success-soft)', border: '#86efac', iconBg: '#dcfce7', iconColor: 'var(--color-success)' },
  { icon: FolderKanban, title: 'Otwórz projekty',    text: 'Przenieś wygraną ofertę do realizacji.',     href: '/projects',  bg: 'var(--color-brand-light)',  border: 'var(--color-brand-border)', iconBg: '#fee2e2', iconColor: 'var(--color-brand)' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const canUsePortal = useFeatureAccess('portal')
  const { data: portalTokens } = usePortalTokens(companyId ?? '')
  const firstPortalUrl = canUsePortal ? (portalTokens ?? []).find((t) => t.active)?.url ?? null : null
  const { data, isLoading } = useDashboardStats()
  if (isLoading || !data) return <Spinner />

  const stats = [
    { label: 'Pipeline ofert', value: formatCurrency(data.pipeline) },
    { label: 'Aktywne projekty', value: String(data.activeProjects) },
    { label: 'Faktury', value: String(data.invoicesCount) },
    { label: 'Przeterminowane', value: String(data.overdueCount) },
  ]

  return (
    <div>
      <PageHeader title="Tablica" subtitle={`Pulpit operacyjny ${data.companyName} · plan ${PLAN_DEFS[data.plan].name}`} />

      <section className="dashboard-hero">
        <Card className="highlight-card">
          <span className="hero__eyebrow" style={{ background: 'rgba(255,255,255,.14)', color: 'white' }}>LoftDesk</span>
          <h2 style={{ fontSize: 34, marginBottom: 10, color: '#e3ded7' }}>System do dokumentów i realizacji dla firm budowlanych oraz wykończeniowych.</h2>
          <p>Łączy wycenę, umowę, fakturę, portal klienta, projekty i KSeF w jednym miejscu — bez ciężaru ERP.</p>
          <div className="hero__actions">
            <Button onClick={() => navigate({ to: '/estimates' })} icon={<ArrowRight size={16} />}>Przejdź do kosztorysów</Button>
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })} icon={<Settings size={16} />}>Ustawienia firmy</Button>
          </div>
        </Card>

        <Card className="subtle-panel">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div>
              <h3>Szybkie akcje</h3>
              <p className="field__label">Najczęstsze ruchy z pulpitu.</p>
            </div>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.title}
                  className="quick-action"
                  style={{ background: action.bg, borderColor: action.border }}
                  onClick={() => navigate({ to: action.href as any })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div className="quick-action__icon" style={{ background: action.iconBg, color: action.iconColor }}><Icon size={18} /></div>
                    <strong>{action.title}</strong>
                  </div>
                  <div className="field__label">{action.text}</div>
                </button>
              )
            })}
          </div>
        </Card>
      </section>

      <div className="stats-grid">
        {stats.map((stat) => (
          <Card key={stat.label} className="kpi-card">
            <div className="field__label">{stat.label}</div>
            <div className="stat-card__value">{stat.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <Card>
          <h3>Wskaźniki</h3>
          <ul>
            <li>Klienci: {data.clientsCount}</li>
            <li>Kosztorysy: {data.estimatesCount}</li>
            <li>Umowy: {data.contractsCount}</li>
            <li>Przychód opłacony: {formatCurrency(data.paidRevenue)}</li>
            <li>KSeF ready: {data.ksefReady ? 'tak' : 'nie'}</li>
          </ul>
        </Card>
        <Card>
          <h3>Ostatnia aktywność</h3>
          <ul>
            {data.recentActivity.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Card>
        <Card>
          <h3>Portal klienta</h3>
          <p>Klient dostaje link do konkretnego kosztorysu, może go zaakceptować i zostawić komentarz w jednym miejscu.</p>
          <div className="actions-row">
            <Button variant="secondary" onClick={() => navigate({ to: '/estimates' })}>Generuj link portalu</Button>
            {firstPortalUrl ? <a href={firstPortalUrl} target="_blank" rel="noreferrer"><Button variant="ghost" icon={<MessageSquareText size={16} />}>Otwórz portal demo</Button></a> : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
