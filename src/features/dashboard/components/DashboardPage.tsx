import { useState } from 'react'
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronRight,
  FileText, FolderKanban, MessageSquare, Receipt, UserCheck,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Modal } from '@/shared/ui/Modal/Modal'
import { formatCurrency } from '@/shared/lib/formatters'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { QueryError } from '@/shared/ui/QueryError/QueryError'
import { useCompanyId, useAuth } from '@/features/auth/hooks/useAuth'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { ProjectAiTab } from '@/features/ai-review/components/ProjectAiTab'

const AI_ENABLED = import.meta.env.VITE_AI_ENGINE_ENABLED === 'true'

const FLOW_STEPS = [
  { icon: FolderKanban, label: 'Projekt',    sub: 'Otwórz realizację' },
  { icon: FileText,     label: 'Dokument',   sub: 'Wycena lub umowa'  },
  { icon: UserCheck,    label: 'Akceptacja', sub: 'Klient zatwierdza' },
  { icon: MessageSquare,label: 'Chat',       sub: 'Bieżąca komunikacja' },
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
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
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
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiProjectId, setAiProjectId] = useState<string>('')
  const { data: projects = [] } = useProjects()
  const showAi = AI_ENABLED && (user?.plan === 'pro' || user?.plan === 'business' || user?.plan === 'admin')

  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => refetch()} />

  const pipelineProjects: { id: string; name: string; number: string; status: string; clientName: string; contractValue: number; estimateValue: number; invoicedTotal: number; paidTotal: number; completeness_score?: number | null }[] = (data as any).pipelineProjects ?? []
  const attentionProjects: { id: string; name: string; number: string; status: string; issues: string[] }[] = (data as any).attentionProjects ?? []

  const activeProjects = pipelineProjects.filter(p => p.status === 'active')
  const isEmpty = pipelineProjects.length === 0

  function goToProject(id: string) {
    navigate({ to: '/projects' as any, search: { open: id } as any })
  }

  // ── Smart next-step nudge ──────────────────────────────────────────────
  function NextStepNudge() {
    if (isEmpty) return null
    const flags = activeProjects.flatMap(p => {
      const pp = pipelineProjects.find(x => x.id === p.id)
      return pp ? [pp] : []
    })
    const needsEstimate  = flags.some(p => (p.estimateValue ?? 0) === 0 && (p.contractValue ?? 0) === 0)
    const needsInvoice   = flags.some(p => p.contractValue > 0 && p.invoicedTotal === 0)
    const hasOverdue     = data!.overdueCount > 0

    if (hasOverdue) return (
      <button type="button" className="nudge-card nudge-card--warning"
        onClick={() => navigate({ to: '/documents' as any })}>
        <AlertTriangle size={16} />
        <span>{data!.overdueCount} {data!.overdueCount === 1 ? 'zaległa faktura' : 'zaległe faktury'} — sprawdź</span>
        <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
      </button>
    )
    if (needsEstimate) return (
      <button type="button" className="nudge-card nudge-card--brand"
        onClick={() => navigate({ to: '/documents' as any })}>
        <FileText size={16} />
        <span>Projekt bez wyceny — stwórz pierwszą ofertę dla klienta</span>
        <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
      </button>
    )
    if (needsInvoice) return (
      <button type="button" className="nudge-card nudge-card--brand"
        onClick={() => navigate({ to: '/documents' as any })}>
        <Receipt size={16} />
        <span>Umowa gotowa — wystaw fakturę do rozliczenia</span>
        <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
      </button>
    )
    return null
  }

  return (
    <div className="dashboard">

      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div className="dashboard__greeting">
        <p className="dashboard__greeting-label">Dzień dobry</p>
        <h1 className="dashboard__greeting-name">{data.companyName || 'Twój LoftDesk'}</h1>
      </div>

      {/* ══ EMPTY STATE — first time user ════════════════════════════ */}
      {isEmpty ? (
        <div className="dashboard__empty">
          <div className="dashboard__empty-hero">
            <h2>Zacznij od projektu</h2>
            <p>Dodaj pierwszy projekt, przypisz klienta, wyślij wycenę — i czekaj na akceptację.<br />Cały flow w jednym miejscu.</p>
            <button
              type="button"
              className="dashboard__cta-primary"
              onClick={() => navigate({ to: '/projects' as any })}
            >
              <FolderKanban size={18} />
              Stwórz pierwszy projekt
            </button>
          </div>

          {/* Flow steps */}
          <div className="dashboard__flow-steps">
            {FLOW_STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.label} className="flow-step">
                  <div className="flow-step__icon">
                    <Icon size={20} />
                  </div>
                  <div className="flow-step__text">
                    <span className="flow-step__num">Krok {i + 1}</span>
                    <span className="flow-step__label">{step.label}</span>
                    <span className="flow-step__sub">{step.sub}</span>
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <ArrowRight size={14} className="flow-step__arrow" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Quick start links */}
          <div className="dashboard__quick-links">
            <button type="button" className="dashboard__quick-link"
              onClick={() => navigate({ to: '/projects' as any })}>
              <FolderKanban size={16} />Projekty
            </button>
            <button type="button" className="dashboard__quick-link"
              onClick={() => navigate({ to: '/documents' as any })}>
              <FileText size={16} />Dokumenty
            </button>
            <button type="button" className="dashboard__quick-link"
              onClick={() => navigate({ to: '/chat' as any })}>
              <MessageSquare size={16} />Chat
            </button>
          </div>
        </div>
      ) : (
        /* ══ RETURNING USER ════════════════════════════════════════════ */
        <>
          {/* Stats strip */}
          <div className="dashboard__stats">
            <div className="stat-pill">
              <span className="stat-pill__val">{data.activeProjects}</span>
              <span className="stat-pill__lbl">aktywnych</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill__val">{data.estimatesCount}</span>
              <span className="stat-pill__lbl">wycen</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill__val">{data.invoicesCount}</span>
              <span className="stat-pill__lbl">faktur</span>
            </div>
            {data.overdueCount > 0 && (
              <div className="stat-pill stat-pill--warning">
                <span className="stat-pill__val">{data.overdueCount}</span>
                <span className="stat-pill__lbl">zaległe</span>
              </div>
            )}
          </div>

          {/* Next step nudge */}
          <NextStepNudge />

          {/* Attention projects */}
          {attentionProjects.length > 0 && (
            <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-warning, #f59e0b)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={15} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                <span className="section-label">Wymaga uwagi ({attentionProjects.length})</span>
              </div>
              {attentionProjects.map(p => (
                <button key={p.id} type="button" className="attention-row"
                  onClick={() => goToProject(p.id)}>
                  <div style={{ minWidth: 0 }}>
                    <span className="attention-row__name">{p.name}</span>
                    <span className="attention-row__issues">{p.issues.join(' · ')}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                </button>
              ))}
            </Card>
          )}

          {/* Active projects */}
          {activeProjects.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="section-header">
                <span className="section-label">Aktywne projekty ({activeProjects.length})</span>
                <button type="button" className="section-link"
                  onClick={() => navigate({ to: '/projects' as any })}>
                  Wszystkie <ChevronRight size={12} />
                </button>
              </div>
              <div className="active-projects-list">
                {activeProjects.map(proj => {
                  const value = proj.contractValue || proj.estimateValue
                  const sc    = proj.completeness_score
                  const scColor = sc == null ? 'var(--color-text-muted)' : sc >= 80 ? 'var(--color-success)' : sc >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
                  return (
                    <button key={proj.id} type="button" className="proj-summary-row"
                      onClick={() => goToProject(proj.id)}>
                      <div className="proj-summary-row__left">
                        <span className="proj-summary-row__name">{proj.name}</span>
                        <span className="proj-summary-row__meta">
                          {proj.clientName || proj.number}
                          {value > 0 && <> · <strong>{formatCurrency(value)}</strong></>}
                        </span>
                        <BudgetBar invoiced={proj.invoicedTotal} total={value} />
                      </div>
                      <div className="proj-summary-row__right">
                        {sc != null && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: scColor }}>{sc}%</span>
                        )}
                        {proj.paidTotal > 0 && (
                          <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                        )}
                        <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pipeline value summary */}
          {data.pipeline > 0 && (
            <div className="pipeline-summary-strip">
              <span className="pipeline-summary-strip__label">Wartość pipeline</span>
              <span className="pipeline-summary-strip__val">{formatCurrency(data.pipeline)}</span>
            </div>
          )}
        </>
      )}

      {/* AI modal */}
      {showAi && (
        <Modal
          open={showAiModal}
          onClose={() => { setShowAiModal(false); setAiProjectId('') }}
          title="AI Asystent" size="xl"
        >
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Wybierz projekt do analizy
              </label>
              <select
                value={aiProjectId}
                onChange={e => setAiProjectId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 8 }}
              >
                <option value="">— wybierz projekt —</option>
                {projects.filter((p: any) => p.status !== 'cancelled').map((p: any) => (
                  <option key={p.id} value={p.id}>{p.number} — {p.name}</option>
                ))}
              </select>
            </div>
            {aiProjectId
              ? <ProjectAiTab projectId={aiProjectId} companyId={companyId} />
              : <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>Wybierz projekt, aby uruchomić asystenta AI.</p>
            }
          </div>
        </Modal>
      )}
    </div>
  )
}

