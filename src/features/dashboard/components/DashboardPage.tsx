import { ArrowRight, FileText, FolderKanban, MessageSquareText, Receipt, Settings, TrendingUp, Users } from 'lucide-react'
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
  { icon: Users,        title: 'Dodaj kontrahenta', text: 'Uzupełnij bazę inwestorów i wykonawców.',    href: '/clients'   },
  { icon: FileText,     title: 'Nowa wycena',        text: 'Przygotuj ofertę w układzie gotowym do PDF.', href: '/estimates' },
  { icon: Receipt,      title: 'Nowa faktura',       text: 'Wystaw dokument i przygotuj XML do KSeF.',   href: '/invoices'  },
  { icon: FolderKanban, title: 'Otwórz projekty',    text: 'Przenieś wygraną ofertę do realizacji.',     href: '/projects'  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const canUsePortal = useFeatureAccess('portal')
  const { data: portalTokens } = usePortalTokens(companyId ?? '')
  const firstPortalUrl = canUsePortal ? (portalTokens ?? []).find((t) => t.active)?.url ?? null : null
  const { data, isLoading } = useDashboardStats()
  if (isLoading || !data) return <Spinner />

  const pipelineProjects: { id: string; name: string; number: string; status: string; clientName: string; contractValue: number; estimateValue: number; invoicedTotal: number; paidTotal: number }[] = (data as any).pipelineProjects ?? []

  const stats = [
    { label: 'Pipeline projektów', value: formatCurrency(data.pipeline) },
    { label: 'Aktywne projekty', value: String(data.activeProjects) },
    { label: 'Faktury', value: String(data.invoicesCount) },
    { label: 'Przeterminowane', value: String(data.overdueCount) },
  ]

  return (
    <div>
      <PageHeader title={data.companyName} subtitle={`Plan: ${PLAN_DEFS[data.plan].name}`} />

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
                  onClick={() => navigate({ to: action.href as any })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div className="quick-action__icon"><Icon size={18} /></div>
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

      {pipelineProjects.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={20} />
              <h3 style={{ margin: 0 }}>Pipeline projektów</h3>
            </div>
            <span className="field__label">{pipelineProjects.length} {pipelineProjects.length === 1 ? 'projekt' : 'projektów'}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Projekt</th>
                <th style={{ padding: '8px 12px' }}>Klient</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Wartość umowy</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Zafakturowano</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Opłacono</th>
              </tr>
            </thead>
            <tbody>
              {pipelineProjects.map((proj) => (
                <tr key={proj.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px' }}><strong>{proj.name}</strong><div className="field__label">{proj.number}</div></td>
                  <td style={{ padding: '10px 12px' }}>{proj.clientName || '—'}</td>
                  <td style={{ padding: '10px 12px' }}><span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: proj.status === 'active' ? '#dcfce7' : proj.status === 'done' ? '#f3f4f6' : proj.status === 'offer' ? '#fef3c7' : '#fee2e2', color: proj.status === 'active' ? '#166534' : proj.status === 'done' ? '#374151' : proj.status === 'offer' ? '#92400e' : '#991b1b' }}>{proj.status === 'active' ? 'W toku' : proj.status === 'done' ? 'Zakończony' : proj.status === 'offer' ? 'Oferta' : 'Anulowany'}</span></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(proj.contractValue || proj.estimateValue)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(proj.invoicedTotal)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: proj.paidTotal > 0 ? '#166534' : '#9ca3af' }}>{formatCurrency(proj.paidTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 12px 0', gap: 24, fontSize: 14, fontWeight: 700 }}>
            <span>Suma pipeline: {formatCurrency(data.pipeline)}</span>
          </div>
        </Card>
      )}

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
