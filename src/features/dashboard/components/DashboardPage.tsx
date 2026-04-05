import { useState } from 'react'
import { AlertTriangle, BookText, Camera, FileText, FolderKanban, MessageSquareText, Receipt, TrendingUp, Users, Wallet } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { formatCurrency } from '@/shared/lib/formatters'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { QueryError } from '@/shared/ui/QueryError/QueryError'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'

const MOBILE_TILES = [
  { label: 'Kontrahenci', sub: 'Klienci i kontrahenci',          icon: Users,            href: '/clients'          },
  { label: 'Wyceny',      sub: 'Oferty i kosztorysy',            icon: FileText,         href: '/estimates'        },
  { label: 'Umowy',       sub: 'Podpisane zlecenia',             icon: BookText,         href: '/contracts'        },
  { label: 'Faktury',     sub: 'Rozliczenia i KSeF',             icon: Receipt,          href: '/invoices'         },
  { label: 'Projekty',    sub: 'Realizacje i dokumenty',         icon: FolderKanban,     href: '/projects'         },
  { label: 'Chat',        sub: 'Wiadomości i portal klienta',    icon: MessageSquareText, href: '/chat'             },
  { label: 'Koszty',      sub: 'Wydatki i faktury kosztowe',     icon: Wallet,           href: '/expenses'         },
  { label: 'AI Analiza',  sub: 'Wybierz typ analizy',            icon: Camera,           href: '/ai'               },
  { label: 'AI Projekt',  sub: 'PDF → zakres i wycena',          icon: FileText,         href: '/project-analysis' },
] as const

const quickActions = [
  { icon: FolderKanban, title: 'Nowy projekt',      text: 'Rozpocznij nową realizację.',                          href: '/projects'          },
  { icon: FileText,     title: 'Nowa wycena',       text: 'Przygotuj ofertę dla klienta.',                        href: '/estimates'         },
  { icon: Wallet,       title: 'Dodaj koszt',       text: 'Zarejestruj wydatek lub fakturę kosztową.',             href: '/expenses'          },
  { icon: Camera,       title: 'AI analiza',        text: 'Skanuj fakturę, analizuj pomieszczenie lub projekt.',   href: '/ai'                },
  { icon: FileText,     title: 'AI analiza projektu', text: 'Wgraj PDF → AI wyciągnie zakres i wycenę.',          href: '/project-analysis'  },
]

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:    { bg: 'rgba(119,186,138,0.15)', color: '#77BA8A', label: 'W realizacji' },
  done:      { bg: 'rgba(160,170,180,0.12)', color: '#A7ABB3', label: 'Zakończony'   },
  offer:     { bg: 'rgba(212,150,10,0.15)',  color: '#D4960A', label: 'Oferta'        },
  cancelled: { bg: 'rgba(239,68,68,0.15)',   color: '#EF6B6B', label: 'Anulowany'     },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: 'rgba(160,170,180,0.12)', color: '#A7ABB3', label: status }
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const canUsePortal = useFeatureAccess('portal')
  const { data, isLoading, isError, refetch } = useDashboardStats()
  const [pipelineOpen, setPipelineOpen] = useState(false)

  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => refetch()} />

  const pipelineProjects: { id: string; name: string; number: string; status: string; clientName: string; contractValue: number; estimateValue: number; invoicedTotal: number; paidTotal: number; completeness_score?: number | null }[] = (data as any).pipelineProjects ?? []
  const attentionProjects: { id: string; name: string; number: string; status: string; issues: string[] }[] = (data as any).attentionProjects ?? []

  return (
    <div>
      <PageHeader title={data.companyName} />

      {/* ── Quick Actions — hero position, always visible ──────────────── */}
      <div className="quick-actions-grid" style={{ marginBottom: 20 }}>
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.title}
              className="quick-action"
              onClick={() => navigate({ to: action.href as any })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div className="quick-action__icon"><Icon size={22} /></div>
                <strong>{action.title}</strong>
              </div>
              <div className="field__label">{action.text}</div>
            </button>
          )
        })}
      </div>

      {/* ── Mobile tiles — module navigation (mobile only) ─────────────── */}
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

      {/* ── Wymaga uwagi ──────────────────────────────────────────────── */}
      {attentionProjects.length > 0 && (
        <Card className="attention-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={18} color="#D4960A" />
            <h3 style={{ margin: 0 }}>Wymaga uwagi</h3>
            <span className="attention-badge">{attentionProjects.length}</span>
          </div>
          <div className="attention-list">
            {attentionProjects.map((proj) => (
              <Link key={proj.id} to="/projects" className="attention-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="attention-row__left">
                  <span className="attention-row__name">{proj.name}</span>
                  <span className="attention-row__number">{proj.number}</span>
                </div>
                <div className="attention-row__pills">
                  {proj.issues.map((issue) => (
                    <span key={issue} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'rgba(212,150,10,0.15)', color: '#D4960A' }}>{issue}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* ── Pipeline — collapsible ────────────────────────────────────── */}
      {pipelineProjects.length > 0 && (
        <Card className="pipeline-section" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="pipeline-toggle"
            onClick={() => setPipelineOpen((v) => !v)}
            aria-expanded={pipelineOpen}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={18} />
              <h3 style={{ margin: 0 }}>Pipeline</h3>
              <span className="field__label">{pipelineProjects.length} {pipelineProjects.length === 1 ? 'pozycja' : 'pozycji'} · {formatCurrency(data.pipeline)}</span>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{pipelineOpen ? '▲' : '▼'}</span>
          </button>

          {pipelineOpen && (
            <>
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
                        <td style={{ padding: '10px 12px' }}><StatusBadge status={proj.status} /></td>
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
                      <StatusBadge status={proj.status} />
                    </div>
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
            </>
          )}
        </Card>
      )}

      {/* ── Secondary info — desktop only ─────────────────────────────── */}
      <div className="dashboard-desktop-content">
        <div className="grid-3" style={{ marginTop: 4 }}>
          <Card>
            <h3>Wskaźniki</h3>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              <div className="list-row"><span>Aktywne projekty</span><strong>{data.activeProjects}</strong></div>
              <div className="list-row"><span>Klienci</span><strong>{data.clientsCount}</strong></div>
              <div className="list-row"><span>Kosztorysy</span><strong>{data.estimatesCount}</strong></div>
              <div className="list-row"><span>Umowy</span><strong>{data.contractsCount}</strong></div>
              <div className="list-row"><span>Faktury</span><strong>{data.invoicesCount}</strong></div>
              <div className="list-row"><span>Przychód opłacony</span><strong>{formatCurrency(data.paidRevenue)}</strong></div>
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
      </div>
    </div>
  )
}
