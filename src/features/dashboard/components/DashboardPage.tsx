import { useState } from 'react'
import { Bot, ChevronRight, DollarSign, FileText, FolderKanban, Mic, Receipt, Sparkles, TrendingUp, Users, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Modal } from '@/shared/ui/Modal/Modal'
import { formatCurrency } from '@/shared/lib/formatters'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { QueryError } from '@/shared/ui/QueryError/QueryError'
import { useCompanyId, useAuth } from '@/features/auth/hooks/useAuth'
import { WelcomeBanner } from '@/features/onboarding/components/WelcomeBanner'
import { OnboardingChecklist } from '@/features/onboarding/components/OnboardingChecklist'
import { useOnboardingProgress } from '@/features/onboarding/hooks/useOnboardingProgress'
import { useLocalStorage } from '@/shared/hooks/useLocalStorage'
import { ProjectAiTab } from '@/features/ai-review/components/ProjectAiTab'
import { useProjects } from '@/features/projects/hooks/useProjects'

const AI_ENABLED = import.meta.env.VITE_AI_ENGINE_ENABLED === 'true'

const quickActions = [
  { icon: FolderKanban, title: 'Nowy projekt',       sub: 'Stwórz realizację', href: '/projects'  },
  { icon: FileText,     title: 'Nowa wycena',        sub: 'Wygeneruj ofertę',  href: '/estimates' },
  { icon: Receipt,      title: 'Nowa faktura',       sub: 'Wystaw dokument',   href: '/invoices'  },
  { icon: Mic,          title: 'Notatki głosowe',    sub: 'Transkrypcje i AI', href: '/notes'     },
  { icon: Sparkles,     title: 'AI / Import',        sub: 'OCR, analiza, koszty', href: '/ai'     },
  { icon: Bot,          title: 'AI Asystent',        sub: 'Asystent projektu',    href: '__ai_assistant__' },
]

const STATUS_LABEL: Record<string, string> = {
  active: 'W realizacji', done: 'Zakończony', offer: 'Oferta', cancelled: 'Anulowany',
}
const STATUS_BG: Record<string, string> = {
  active: 'var(--color-success-soft)', done: 'var(--color-muted)',
  offer:  'var(--color-warning-soft)', cancelled: 'var(--color-error-soft)',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--color-success)', done: 'var(--color-text-secondary)',
  offer:  'var(--color-warning)', cancelled: 'var(--color-error)',
}

function BudgetBar({ invoiced, total }: { invoiced: number; total: number }) {
  if (total <= 0) return null
  const pct  = Math.min(100, Math.round((invoiced / total) * 100))
  const over = invoiced > total
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
        <span>Fakturacja</span>
        <span style={{ fontWeight: 600, color: over ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${Math.min(100, pct)}%`,
          background: over ? 'var(--color-error)' : pct >= 75 ? 'var(--color-success)' : 'var(--color-brand)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useDashboardStats()
  const { data: onboarding } = useOnboardingProgress()
  const [bannerDismissed, setBannerDismissed] = useLocalStorage('loftdesk-welcome-dismissed', false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiProjectId, setAiProjectId] = useState<string>('')
  const { data: projects = [] } = useProjects()
  const showAi = AI_ENABLED && (user?.plan === 'pro' || user?.plan === 'business' || user?.plan === 'admin')

  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => refetch()} />

  const showWelcome = !bannerDismissed && onboarding && (onboarding.isEmpty || !onboarding.isComplete)
  const showChecklist = onboarding && !onboarding.isEmpty && !onboarding.isComplete

  const pipelineProjects: { id: string; name: string; number: string; status: string; clientName: string; contractValue: number; estimateValue: number; invoicedTotal: number; paidTotal: number; completeness_score?: number | null }[] = (data as any).pipelineProjects ?? []
  const attentionProjects: { id: string; name: string; number: string; status: string; issues: string[] }[] = (data as any).attentionProjects ?? []

  const activeProjects  = pipelineProjects.filter(p => p.status === 'active')
  const otherProjects   = pipelineProjects.filter(p => p.status !== 'active')

  function goToProject(id: string) {
    navigate({ to: '/projects' as any, search: { open: id } as any })
  }

  return (
    <div>
      {/* ── Header — greeting ──────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <p className="field__label" style={{ marginBottom: 2 }}>Dzień dobry</p>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          {data.companyName || 'Twój LoftDesk'}
        </h1>
      </div>

      {/* ── Onboarding: welcome banner + checklist ──────────────── */}
      {showWelcome && (
        <WelcomeBanner
          companyName={data.companyName}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {showChecklist && <OnboardingChecklist />}

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
              className="quick-action quick-action--highlight"
              onClick={() => {
                if (action.href === '__ai_assistant__') {
                  setShowAiModal(true)
                } else {
                  navigate({ to: action.href as any })
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="quick-action__icon">
                  <Icon size={16} />
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

      {/* ── Wymaga uwagi ─────────────────────────────────────────── */}
      {attentionProjects.length > 0 && (
        <Card style={{ marginBottom: 16, borderLeft: '3px solid var(--color-warning, #f59e0b)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-warning, #f59e0b)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              Wymaga uwagi ({attentionProjects.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attentionProjects.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => goToProject(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 8, border: 'none',
                  background: 'var(--color-surface-soft, rgba(0,0,0,0.03))',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-warning-soft, rgba(245,158,11,0.08))')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface-soft, rgba(0,0,0,0.03))')}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, display: 'block', lineHeight: 1.3 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {p.issues.join(' · ')}
                  </span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Aktywne projekty (karty z budżetem) ──────────────────── */}
      {activeProjects.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              Aktywne projekty ({activeProjects.length})
            </span>
            <button
              type="button"
              onClick={() => navigate({ to: '/projects' as any })}
              style={{ fontSize: 12, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Wszystkie →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {activeProjects.map(proj => {
              const value   = proj.contractValue || proj.estimateValue
              const sc      = proj.completeness_score
              const scColor = sc == null ? 'var(--color-text-muted)' : sc >= 80 ? 'var(--color-success)' : sc >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => goToProject(proj.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 0,
                    padding: '14px 16px', borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-elevated)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  {/* Top row: name + status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 1 }}>{proj.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        {proj.number}{proj.clientName ? ` · ${proj.clientName}` : ''}
                      </div>
                    </div>
                    <span style={{
                      flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: STATUS_BG[proj.status] ?? 'var(--color-muted)',
                      color: STATUS_COLOR[proj.status] ?? 'var(--color-text-secondary)',
                    }}>
                      {STATUS_LABEL[proj.status] ?? proj.status}
                    </span>
                  </div>

                  {/* Values */}
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 4 }}>
                    <div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>Wartość</div>
                      <div style={{ fontWeight: 700 }}>{value > 0 ? formatCurrency(value) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>Opłacono</div>
                      <div style={{ fontWeight: 700, color: proj.paidTotal > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                        {proj.paidTotal > 0 ? formatCurrency(proj.paidTotal) : '—'}
                      </div>
                    </div>
                    {sc != null && (
                      <div style={{ marginLeft: 'auto' }}>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>Kompletność</div>
                        <div style={{ fontWeight: 700, color: scColor }}>{sc}%</div>
                      </div>
                    )}
                  </div>

                  {/* Budget bar */}
                  <BudgetBar invoiced={proj.invoicedTotal} total={value} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Pipeline (pozostałe — oferty, zakończone) ────────────── */}
      {otherProjects.length > 0 && (
        <Card className="pipeline-section" style={{ marginBottom: 16 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={20} />
              <h3 style={{ margin: 0 }}>Pipeline</h3>
            </div>
            <span className="field__label">{otherProjects.length} {otherProjects.length === 1 ? 'pozycja' : 'pozycji'}</span>
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
                {otherProjects.map((proj) => (
                  <tr
                    key={proj.id}
                    style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onClick={() => goToProject(proj.id)}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-surface-soft, rgba(0,0,0,0.03))')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px' }}><strong>{proj.name}</strong><div className="field__label">{proj.number}</div></td>
                    <td style={{ padding: '10px 12px' }}>{proj.clientName || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: STATUS_BG[proj.status] ?? 'var(--color-muted)', color: STATUS_COLOR[proj.status] ?? 'var(--color-text-secondary)' }}>
                        {STATUS_LABEL[proj.status] ?? proj.status}
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
            {otherProjects.map((proj) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => goToProject(proj.id)}
                className="pipeline-card"
                style={{ cursor: 'pointer', border: 'none', background: 'none', textAlign: 'left', width: '100%', padding: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 14, display: 'block', lineHeight: 1.3 }}>{proj.name}</strong>
                    <span className="field__label" style={{ fontSize: 12 }}>{proj.number}{proj.clientName ? ` · ${proj.clientName}` : ''}</span>
                  </div>
                  <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: STATUS_BG[proj.status] ?? 'var(--color-muted)', color: STATUS_COLOR[proj.status] ?? 'var(--color-text-secondary)' }}>
                    {STATUS_LABEL[proj.status] ?? proj.status}
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
              </button>
            ))}
          </div>

          <div className="pipeline-summary">
            <span>Suma pipeline: {formatCurrency(data.pipeline)}</span>
          </div>
        </Card>
      )}

      {/* ── AI Asystent modal ────────────────────────────────────── */}
      <Modal
        open={showAiModal}
        onClose={() => { setShowAiModal(false); setAiProjectId('') }}
        title="AI Asystent"
        size="xl"
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Wybierz projekt do analizy
            </label>
            <select
              value={aiProjectId}
              onChange={e => setAiProjectId(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                background: 'var(--color-bg-input)', color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)', borderRadius: 8,
              }}
            >
              <option value="">— wybierz projekt —</option>
              {projects
                .filter((p: any) => p.status !== 'cancelled')
                .map((p: any) => (
                  <option key={p.id} value={p.id}>{p.number} — {p.name}</option>
                ))
              }
            </select>
          </div>

          {aiProjectId && showAi ? (
            <ProjectAiTab projectId={aiProjectId} companyId={companyId} />
          ) : aiProjectId && !showAi ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
              AI Asystent jest dostępny w planach Pro i Business.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
              Wybierz projekt, aby uruchomić asystenta AI.
            </p>
          )}
        </div>
      </Modal>

    </div>
  )
}
