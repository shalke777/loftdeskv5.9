import { useState } from 'react'
import { Camera, ChevronRight, FileText, FolderKanban, Receipt, TrendingUp, Users, Wallet, DollarSign } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { formatCurrency } from '@/shared/lib/formatters'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { QueryError } from '@/shared/ui/QueryError/QueryError'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'

const quickActions = [
  { icon: Users,        title: 'Nowy kontrahent',    sub: 'Dodaj klienta',  color: 'var(--color-brand)',   href: '/clients'   },
  { icon: FileText,     title: 'Nowa wycena',        sub: 'Wygeneruj ofertę', color: 'var(--color-accent)',  href: '/estimates' },
  { icon: Receipt,      title: 'Nowa faktura',       sub: 'Wystaw dokument', color: 'var(--color-info)',    href: '/invoices'  },
  { icon: FolderKanban, title: 'Nowy projekt',       sub: 'Stwórz realizację', color: 'var(--color-brand)',   href: '/projects'  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const canUsePortal = useFeatureAccess('portal')
  const { data, isLoading, isError, refetch } = useDashboardStats()

  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => refetch()} />

  const pipelineProjects: { id: string; name: string; number: string; status: string; clientName: string; contractValue: number; estimateValue: number; invoicedTotal: number; paidTotal: number; completeness_score?: number | null }[] = (data as any).pipelineProjects ?? []

  return (
    <div>
      {/* ── Header — greeting ──────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <p className="field__label" style={{ marginBottom: 2 }}>Dzień dobry</p>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          {data.companyName || 'Twój LoftDesk'}
        </h1>
      </div>

      {/* ── Hero money card ──────────────────────────────────────── */}
      <div className="hero-card" style={{
        background: 'linear-gradient(135deg, #0E2A1A 0%, #163C24 60%, #0A1E12 100%)',
        borderRadius: 'var(--radius-xl, 14px)',
        padding: '20px 24px',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(62,168,90,0.2)',
      }}>
        <div style={{
          position: 'absolute', right: -32, top: -32, width: 160, height: 160,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(62,168,90,0.15) 0%, transparent 70%)',
        }} />
        <p style={{ color: 'rgba(237,232,221,0.55)', fontSize: '0.78rem', marginBottom: 2 }}>Pipeline</p>
        <p style={{ color: '#EDE8DD', fontWeight: 800, fontSize: '2.1rem', lineHeight: 1, letterSpacing: '-0.02em', margin: 0 }}>
          {formatCurrency(data.pipeline)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {data.activeProjects > 0 && (
            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(62,168,90,0.2)', color: '#4DB871' }}>
              {data.activeProjects} {data.activeProjects === 1 ? 'aktywny' : 'aktywne'}
            </span>
          )}
          {data.overdueCount > 0 && (
            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(192,64,46,0.25)', color: '#E05A4A' }}>
              {data.overdueCount} {data.overdueCount === 1 ? 'przeterminowana' : 'przeterminowane'}
            </span>
          )}
          {data.invoicesCount > 0 && (
            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(237,232,221,0.1)', color: 'rgba(237,232,221,0.6)' }}>
              {data.invoicesCount} {data.invoicesCount === 1 ? 'faktura' : 'faktur'}
            </span>
          )}
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'rgba(237,232,221,0.4)' }} />
        </div>
      </div>

      {/* ── Quick actions — 2-column compact grid ────────────────── */}
      <div className="quick-actions-grid" style={{ marginBottom: 16 }}>
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.title}
              className="quick-action"
              onClick={() => navigate({ to: action.href as any })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md, 8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: `color-mix(in srgb, ${action.color} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${action.color} 20%, transparent)`,
                }}>
                  <Icon size={16} style={{ color: action.color }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{action.title}</div>
                  <div className="field__label" style={{ fontSize: '0.72rem', marginTop: 1 }}>{action.sub}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Stats row — 3 columns ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { icon: FolderKanban, label: 'Projekty', value: String(data.activeProjects) },
          { icon: Users,        label: 'Klienci',  value: String(data.clientsCount) },
          { icon: DollarSign,   label: 'Przychód', value: formatCurrency(data.paidRevenue) },
        ].map((s) => {
          const SIcon = s.icon
          return (
            <Card key={s.label} style={{ padding: '14px 12px', textAlign: 'center' }}>
              <SIcon size={16} style={{ color: 'var(--color-text-muted)', margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>{s.value}</div>
              <div className="field__label" style={{ fontSize: '0.68rem', marginTop: 4 }}>{s.label}</div>
            </Card>
          )
        })}
      </div>

      {/* ── Pipeline ─────────────────────────────────────────────── */}
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
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: proj.status === 'active' ? 'var(--color-success-soft)' : proj.status === 'done' ? 'var(--color-muted)' : proj.status === 'offer' ? 'var(--color-warning-soft)' : 'var(--color-error-soft)', color: proj.status === 'active' ? 'var(--color-success)' : proj.status === 'done' ? 'var(--color-text-secondary)' : proj.status === 'offer' ? 'var(--color-warning)' : 'var(--color-error)' }}>
                        {proj.status === 'active' ? 'W realizacji' : proj.status === 'done' ? 'Zakończony' : proj.status === 'offer' ? 'Oferta' : proj.status === 'cancelled' ? 'Anulowany' : proj.status}
                      </span>
                      {proj.completeness_score != null && (() => {
                        const sc = proj.completeness_score
                        const clr = sc >= 80 ? 'var(--color-success)' : sc >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <div style={{ width: 44, height: 4, background: 'var(--color-muted)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${sc}%`, height: '100%', background: clr, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: clr }}>{sc}%</span>
                          </div>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(proj.contractValue || proj.estimateValue)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(proj.invoicedTotal)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: proj.paidTotal > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{formatCurrency(proj.paidTotal)}</td>
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
                  <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: proj.status === 'active' ? 'var(--color-success-soft)' : proj.status === 'done' ? 'var(--color-muted)' : proj.status === 'offer' ? 'var(--color-warning-soft)' : 'var(--color-error-soft)', color: proj.status === 'active' ? 'var(--color-success)' : proj.status === 'done' ? 'var(--color-text-secondary)' : proj.status === 'offer' ? 'var(--color-warning)' : 'var(--color-error)' }}>
                    {proj.status === 'active' ? 'Realizacja' : proj.status === 'done' ? 'Zakończony' : proj.status === 'offer' ? 'Oferta' : proj.status === 'cancelled' ? 'Anulowany' : proj.status}
                  </span>
                </div>
                {proj.completeness_score != null && (() => {
                  const sc = proj.completeness_score
                  const clr = sc >= 80 ? 'var(--color-success)' : sc >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <div style={{ flex: 1, maxWidth: 80, height: 4, background: 'var(--color-muted)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${sc}%`, height: '100%', background: clr, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: clr }}>{sc}%</span>
                    </div>
                  )
                })()}
                <div className="pipeline-card__values">
                  <div><span className="field__label">Wartość</span><strong>{formatCurrency(proj.contractValue || proj.estimateValue)}</strong></div>
                  <div><span className="field__label">Zafakturowano</span><span>{formatCurrency(proj.invoicedTotal)}</span></div>
                  <div><span className="field__label">Opłacono</span><span style={{ color: proj.paidTotal > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{formatCurrency(proj.paidTotal)}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="pipeline-summary">
            <span>Suma pipeline: {formatCurrency(data.pipeline)}</span>
          </div>
        </Card>
      )}

      {/* ── Desktop content — activity & portal ──────────────────── */}
      <div className="dashboard-desktop-content">
        <div className="grid-3" style={{ marginTop: 16 }}>
          <Card>
            <h3>Wskaźniki</h3>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              <div className="list-row"><span>Kosztorysy</span><strong>{data.estimatesCount}</strong></div>
              <div className="list-row"><span>Umowy</span><strong>{data.contractsCount}</strong></div>
              <div className="list-row"><span>KSeF</span><strong style={{ color: data.ksefReady ? undefined : 'var(--color-warning)' }}>{data.ksefReady ? 'Skonfigurowany' : 'Wymaga konfiguracji'}</strong></div>
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
