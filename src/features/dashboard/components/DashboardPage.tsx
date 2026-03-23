import { BookText, FileText, FolderKanban, MessageSquareText, Receipt, TrendingUp, Users } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { formatCurrency } from '@/shared/lib/formatters'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'

const MOBILE_TILES = [
  { label: 'Kontrahenci',    sub: 'Klienci i kontrahenci',      icon: Users,               href: '/clients'   },
  { label: 'Wyceny',         sub: 'Oferty i kosztorysy',      icon: FileText,            href: '/estimates' },
  { label: 'Umowy',          sub: 'Podpisane zlecenia',        icon: BookText,            href: '/contracts' },
  { label: 'Faktury',        sub: 'Rozliczenia i KSeF',        icon: Receipt,             href: '/invoices'  },
  { label: 'Projekty',       sub: 'Realizacje i dokumenty',   icon: FolderKanban,        href: '/projects'  },
  { label: 'Portal klienta', sub: 'Widok i komunikacja klienta', icon: MessageSquareText,   href: '/chat'      },
] as const

const quickActions = [
  { icon: Users,        title: 'Dodaj kontrahenta', text: 'Dodaj klientów, inwestorów i podwykonawców.',       href: '/clients'   },
  { icon: FileText,     title: 'Nowa wycena',        text: 'Przygotuj ofertę w układzie gotowym do PDF.', href: '/estimates' },
  { icon: Receipt,      title: 'Nowa faktura',       text: 'Wystaw fakturę i wyślij ją do KSeF jednym kliknięciem.', href: '/invoices'  },
  { icon: FolderKanban, title: 'Otwórz projekty',    text: 'Przenieś wygraną ofertę do realizacji.',     href: '/projects'  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const canUsePortal = useFeatureAccess('portal')
  const { data, isLoading } = useDashboardStats()

  if (isLoading || !data) return <Spinner />

  const pipelineProjects: { id: string; name: string; number: string; status: string; clientName: string; contractValue: number; estimateValue: number; invoicedTotal: number; paidTotal: number; completeness_score?: number | null }[] = (data as any).pipelineProjects ?? []

  const stats = [
    { label: 'Pipeline projektów', value: formatCurrency(data.pipeline) },
    { label: 'Aktywne projekty', value: String(data.activeProjects) },
    { label: 'Faktury', value: String(data.invoicesCount) },
    { label: 'Przeterminowane', value: String(data.overdueCount), alert: data.overdueCount > 0 },
  ]

  return (
    <div>
      <PageHeader title={data.companyName} />

      {/* ── KPI — widoczne wszędzie, priorytet dnia ────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 18 }}>
        {stats.map((stat) => (
          <Card key={stat.label} className={`kpi-card${stat.alert ? ' kpi-card--alert' : ''}`}>
            <div className="field__label">{stat.label}</div>
            <div className="stat-card__value">{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* ── Mobile home — 6 kafli (tylko mobile) ─────────────────────────── */}
      <nav className="mobile-home-grid" aria-label="Główne moduły">
        {MOBILE_TILES.map(({ label, sub, icon: Icon, href }, i) => (
          <Link key={href} to={href as any} className={`mobile-tile mobile-tile--${i + 1}`}>
            <div className="mobile-tile__icon"><Icon size={20} /></div>
            <div>
              <div className="mobile-tile__label">{label}</div>
              <div className="mobile-tile__sub">{sub}</div>
            </div>
          </Link>
        ))}
      </nav>

      {/* ── Pipeline — widoczny na mobile i desktop ──────────────────── */}
      {pipelineProjects.length > 0 && (
        <Card className="pipeline-section" style={{ marginBottom: 16 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={20} />
              <h3 style={{ margin: 0 }}>Pipeline</h3>
            </div>
            <span className="field__label">{pipelineProjects.length} {pipelineProjects.length === 1 ? 'pozycja' : 'pozycji'}</span>
          </div>

          {/* Desktop: table */}
          <div className="pipeline-table-wrap">
            <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Nazwa</th>
                  <th style={{ padding: '8px 12px' }}>Klient</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Wartość</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Zafakturowano</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Opłacono</th>
                </tr>
              </thead>
              <tbody>
                {pipelineProjects.map((proj) => (
                  <tr key={proj.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '10px 12px' }}><strong>{proj.name}</strong><div className="field__label">{proj.number}</div></td>
                    <td style={{ padding: '10px 12px' }}>{proj.clientName || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: proj.status === 'active' ? 'rgba(119,186,138,0.15)' : proj.status === 'done' ? 'rgba(160,170,180,0.12)' : proj.status === 'offer' ? 'rgba(212,150,10,0.15)' : 'rgba(239,68,68,0.15)', color: proj.status === 'active' ? '#77BA8A' : proj.status === 'done' ? '#A7ABB3' : proj.status === 'offer' ? '#D4960A' : '#EF6B6B' }}>
                        {proj.status === 'active' ? 'W realizacji' : proj.status === 'done' ? 'Zakończony' : proj.status === 'offer' ? 'Oferta' : proj.status === 'cancelled' ? 'Anulowany' : proj.status}
                      </span>
                      {proj.completeness_score != null && (() => {
                        const sc = proj.completeness_score
                        const clr = sc >= 80 ? '#77BA8A' : sc >= 50 ? '#D4960A' : '#EF6B6B'
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <div style={{ width: 44, height: 4, background: '#3A3D42', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${sc}%`, height: '100%', background: clr, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: clr }}>{sc}%</span>
                          </div>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(proj.contractValue || proj.estimateValue)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(proj.invoicedTotal)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: proj.paidTotal > 0 ? '#77BA8A' : '#8A8F98' }}>{formatCurrency(proj.paidTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile: cards */}
          <div className="pipeline-cards">
            {pipelineProjects.map((proj) => (
              <div key={proj.id} className="pipeline-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 14, display: 'block', lineHeight: 1.3 }}>{proj.name}</strong>
                    <span className="field__label" style={{ fontSize: 12 }}>{proj.number}{proj.clientName ? ` · ${proj.clientName}` : ''}</span>
                  </div>
                  <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: proj.status === 'active' ? 'rgba(119,186,138,0.15)' : proj.status === 'done' ? 'rgba(160,170,180,0.12)' : proj.status === 'offer' ? 'rgba(212,150,10,0.15)' : 'rgba(239,68,68,0.15)', color: proj.status === 'active' ? '#77BA8A' : proj.status === 'done' ? '#A7ABB3' : proj.status === 'offer' ? '#D4960A' : '#EF6B6B' }}>
                    {proj.status === 'active' ? 'Realizacja' : proj.status === 'done' ? 'Zakończony' : proj.status === 'offer' ? 'Oferta' : proj.status === 'cancelled' ? 'Anulowany' : proj.status}
                  </span>
                </div>
                {proj.completeness_score != null && (() => {
                  const sc = proj.completeness_score
                  const clr = sc >= 80 ? '#77BA8A' : sc >= 50 ? '#D4960A' : '#EF6B6B'
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <div style={{ flex: 1, maxWidth: 80, height: 4, background: '#3A3D42', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${sc}%`, height: '100%', background: clr, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: clr }}>{sc}%</span>
                    </div>
                  )
                })()}
                <div className="pipeline-card__values">
                  <div><span className="field__label">Wartość</span><strong>{formatCurrency(proj.contractValue || proj.estimateValue)}</strong></div>
                  <div><span className="field__label">Zafakturowano</span><span>{formatCurrency(proj.invoicedTotal)}</span></div>
                  <div><span className="field__label">Opłacono</span><span style={{ color: proj.paidTotal > 0 ? '#77BA8A' : '#8A8F98' }}>{formatCurrency(proj.paidTotal)}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="pipeline-summary">
            <span>Suma pipeline: {formatCurrency(data.pipeline)}</span>
          </div>
        </Card>
      )}

      {/* ── Reszta dashboardu — ukryta na mobile ─────────────────────── */}
      <div className="dashboard-desktop-content">

      <Card className="subtle-panel" style={{ marginBottom: 18 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div>
              <h3>Szybkie akcje</h3>
              <p className="field__label">Najczęściej używane akcje.</p>
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

      <div className="grid-3" style={{ marginTop: 16 }}>
        <Card>
          <h3>Wskaźniki</h3>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            <div className="list-row"><span>Klienci</span><strong>{data.clientsCount}</strong></div>
            <div className="list-row"><span>Kosztorysy</span><strong>{data.estimatesCount}</strong></div>
            <div className="list-row"><span>Umowy</span><strong>{data.contractsCount}</strong></div>
            <div className="list-row"><span>Przychód opłacony</span><strong>{formatCurrency(data.paidRevenue)}</strong></div>
            <div className="list-row"><span>KSeF</span><strong style={{ color: data.ksefReady ? undefined : '#D4960A' }}>{data.ksefReady ? 'Skonfigurowany' : 'Wymaga konfiguracji'}</strong></div>
          </div>
        </Card>
        <Card>
          <h3>Ostatnia aktywność</h3>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {data.recentActivity.length === 0
              ? <p className="muted">Brak aktywności.</p>
              : data.recentActivity.map((item) => (
                  <div key={item} className="list-row"><span>{item}</span></div>
                ))}
          </div>
        </Card>
        <Card>
          <h3>Portal klienta</h3>
          <p>Klient dostaje dostęp do projektu — może przeglądać wyceny, faktury i komunikować się z firmą w jednym miejscu.</p>
          <div className="actions-row">
            <Button variant="secondary" onClick={() => navigate({ to: '/projects' })}>Przejdź do projektów</Button>
          </div>
        </Card>
      </div>

      </div>{/* end dashboard-desktop-content */}
    </div>
  )
}
