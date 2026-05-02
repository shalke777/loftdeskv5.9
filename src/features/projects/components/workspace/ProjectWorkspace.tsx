// =============================================================================
// ProjectWorkspace — workspace-based project view (replaces tab-based ProjectDetail)
//
// Layout: 3-panel canvas
//   Left  (260px): WorkspaceContextPanel  — client, budget, completeness, docs
//   Center (flex): segment pills + content sections (reuse existing tab components)
//   Right (280px): WorkspaceActivityStream — messages, approvals, timeline feed
//
// All existing modals (estimate/contract/invoice/QR/handover) are preserved.
// The segment pills replace the 8 old horizontal tabs with a clean inline bar.
// =============================================================================

import { useState } from 'react'
// ─── Event Intelligence Layer feature flag ────────────────────────────────────
// true  → useProjectEventStreamV2 (global event layer, Commit 3+)
// false → original useProjectEventStream (safe rollback)
// Set to false and redeploy to instantly revert to the previous event layer.
const USE_GLOBAL_EVENTS = true
// ─────────────────────────────────────────────────────────────────────────────
import { WorkspaceSkeleton } from './WorkspaceSkeleton'

import {
  CalendarCheck, FileDown, QrCode, ClipboardCheck, Loader2,
  ClipboardList, ArrowLeft, MoreHorizontal,
} from 'lucide-react'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'
import { ProjectThreadsTab }   from '@/features/projects/components/ProjectThreadsTab'
import { ProjectExpensesTab }  from '@/features/expenses/components/ProjectExpensesTab'
import { ProjectApprovalsTab } from '@/features/expenses/components/ProjectApprovalsTab'
import { ProjectTimelineTab }  from '@/features/projects/components/ProjectTimelineTab'
import { ProjectPhotosSection } from '@/features/projects/components/ProjectPhotosSection'
import { BudgetComparisonTab } from '@/features/projects/components/BudgetComparisonTab'
import { ProjectMemoryPanel }  from '@/features/projects/components/ProjectMemoryPanel'
import { ProjectQRCodeModal }  from '@/features/projects/components/ProjectQRCodeModal'
import { HandoverProtocolModal } from '@/features/projects/components/HandoverProtocolModal'
import { WorkspaceContextPanel } from './WorkspaceContextPanel'
import { WorkspaceActivityStream } from './WorkspaceActivityStream'
import { useClients } from '@/features/clients/hooks/useClients'
import { useCreateEstimate, useEstimates } from '@/features/estimates/hooks/useEstimates'
import { EstimateForm, clearDraft as clearEstimateDraft } from '@/features/estimates/components/EstimateModal/EstimateForm'
import { useCreateContract, useContracts } from '@/features/contracts/hooks/useContracts'
import { ContractForm } from '@/features/contracts/components/ContractModal/ContractForm'
import { useCreateInvoice, useInvoices } from '@/features/invoices/hooks/useInvoices'
import { InvoiceForm } from '@/features/invoices/components/InvoiceModal/InvoiceForm'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { supabase } from '@/shared/lib/supabase'
import { useProjectEventStream } from '@/features/projects/hooks/useProjectEventStream'
import { useProjectEventStreamV2 } from '@/features/events/core/useProjectEventStreamV2'
import type { GlobalEvent } from '@/features/events/core/types'

// ─── Type / constants ────────────────────────────────────────────────────────

type Segment = 'overview' | 'expenses' | 'budget' | 'photos' | 'approvals' | 'timeline' | 'memory'

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'overview',   label: 'Przegląd'       },
  { key: 'expenses',   label: 'Koszty'         },
  { key: 'budget',     label: 'Plan vs wykon.' },
  { key: 'photos',     label: 'Zdjęcia'        },
  { key: 'approvals',  label: 'Akceptacje'     },
  { key: 'timeline',   label: 'Oś czasu'       },
  { key: 'memory',     label: 'Pamięć'         },
]

const STATUS_LABEL: Record<Project['status'], string> = {
  offer:     'Oferta',
  active:    'W realizacji',
  done:      'Zakończony',
  cancelled: 'Anulowany',
}

// ─── Inline segment pill bar ─────────────────────────────────────────────────

function ActionBar({ segment, setSegment, contextualButton }: {
  segment: Segment
  setSegment: (s: Segment) => void
  contextualButton: React.ReactNode
}) {
  return (
    <div className="ws-action-bar">
      <div className="seg-pills" style={{ overflowX: 'auto', flex: 1, paddingRight: 8 }}>
        {SEGMENTS.map(s => (
          <button
            key={s.key}
            className={`seg-pill ${segment === s.key ? 'seg-pill--active' : 'seg-pill--inactive'}`}
            onClick={() => setSegment(s.key)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {contextualButton}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  project: Project | null
  onEdit?: (project: Project) => void
  onClose?: () => void
}

export function ProjectWorkspace({ project, onEdit, onClose }: Props) {
  const [segment, setSegment] = useState<Segment>('overview')
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [reportStatus, setReportStatus] = useState<'idle' | 'confirm' | 'sending' | 'done' | 'error'>('idle')
  const [htmlReportLoading, setHtmlReportLoading] = useState(false)
  const [projectReportLoading, setProjectReportLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showHandover, setShowHandover] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const { data: clients, isLoading: clientsLoading } = useClients()
  const linkedClient = clients?.find(c => c.id === project?.client_id) ?? null
  const companyId = useCompanyId()
  const companyMeta = useCompanyMeta()
  const createEstimate = useCreateEstimate()
  const createContract = useCreateContract()
  const createInvoice  = useCreateInvoice()
  const { data: estimates = [], isLoading: estimatesLoading } = useEstimates()
  const { data: contracts = [], isLoading: contractsLoading } = useContracts()
  const { data: allInvoices = [], isLoading: invoicesLoading } = useInvoices()

  // ─── Event stream (feature-flagged) ─────────────────────────────────────
  // USE_GLOBAL_EVENTS=true  → Event Intelligence Layer (useProjectEventStreamV2)
  // USE_GLOBAL_EVENTS=false → original per-hook stream (safe rollback)
  // Both hooks respect null projectId by disabling their queries — safe before early return.
  const streamV1 = useProjectEventStream(USE_GLOBAL_EVENTS ? null : (project?.id ?? null))
  const streamV2 = useProjectEventStreamV2(USE_GLOBAL_EVENTS ? (project?.id ?? null) : null)
  const activityEvents: GlobalEvent[] = USE_GLOBAL_EVENTS
    ? streamV2.events
    : (streamV1.events as unknown as GlobalEvent[])

  if (!project) return null
  const isHydrating = clientsLoading || estimatesLoading || contractsLoading || invoicesLoading
  if (isHydrating && !clients && !estimates.length && !contracts.length && !allInvoices.length) {
    return <WorkspaceSkeleton />
  }

  const flags = (project.completeness_flags ?? {}) as Record<string, boolean>
  const projectEstimates = estimates.filter(e => e.project_id === project.id)
  const projectContracts = contracts.filter(c => c.project_id === project.id)
  const projectInvoices  = allInvoices.filter(i => i.project_id === project.id)
  const hasEstimate = flags.has_estimate || projectEstimates.length > 0
  const hasContract = flags.has_contract || projectContracts.length > 0
  const latestEstimate = projectEstimates[projectEstimates.length - 1] ?? null
  const latestContract = projectContracts[projectContracts.length - 1] ?? null

  // ─── Report helpers (unchanged from ProjectDetail) ──────────────────────

  async function openDailyReport() {
    if (!supabase || !project) return
    setHtmlReportLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/.netlify/functions/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: project.id }),
      })
      if (!res.ok) throw new Error('Błąd generowania raportu')
      const { html } = await res.json()
      const blob = new Blob([html], { type: 'text/html' })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch {
      alert('Nie udało się wygenerować raportu dziennego.')
    } finally {
      setHtmlReportLoading(false)
    }
  }

  async function sendDailyReport() {
    if (!supabase || !linkedClient?.email || !project) return
    setReportStatus('sending')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const today = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })
      const lines = [
        `Data: ${today}`, `Projekt: ${project.number} — ${project.name}`,
        project.address ? `Adres budowy: ${project.address}` : null,
        `Status: ${STATUS_LABEL[project.status]}`, '',
        'Prace są kontynuowane. Zapraszamy do sprawdzenia aktualnego stanu projektu w portalu klienta.',
      ]
      const res = await fetch('/.netlify/functions/send-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to_email: linkedClient.email,
          document_type: 'package',
          document_name: `Raport dzienny — ${project.name} — ${today}`,
          message: lines.filter(Boolean).join('\n'),
          document_url: `${window.location.origin}/client/project/${project.id}`,
        }),
      })
      setReportStatus(res.ok ? 'done' : 'error')
      setTimeout(() => setReportStatus('idle'), res.ok ? 4000 : 3000)
    } catch {
      setReportStatus('error')
      setTimeout(() => setReportStatus('idle'), 3000)
    }
  }

  async function exportProjectReport() {
    if (!project) return
    setProjectReportLoading(true)
    try {
      const { buildProjectReportPreview } = await import('@/services/pdf/documentPreview')
      const { generatePdfBlob } = await import('@/services/pdf/pdfGenerator')
      const { downloadBlob } = await import('@/shared/lib/downloads')
      const html = buildProjectReportPreview(
        { project, estimates: projectEstimates, contracts: projectContracts, invoices: projectInvoices, client: linkedClient },
        { name: companyMeta.name, nip: companyMeta.nip, address: companyMeta.address,
          postalCity: companyMeta.postalCity, email: companyMeta.email, phone: companyMeta.phone, logoUrl: companyMeta.logoUrl },
      )
      const blob = await generatePdfBlob(html)
      const filename = `Raport_${(project.number ?? project.id).replace(/[/\\:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      downloadBlob(filename, blob)
    } catch {
      alert('Nie udało się wygenerować raportu PDF.')
    } finally {
      setProjectReportLoading(false)
    }
  }

  // ─── Contextual primary CTA ──────────────────────────────────────────────

  const contextualButton = !hasEstimate ? (
    <Button size="sm" onClick={() => setShowEstimateModal(true)}>Nowa wycena</Button>
  ) : !hasContract ? (
    <Button size="sm" onClick={() => setShowContractModal(true)}>Utwórz umowę</Button>
  ) : (
    <Button size="sm" onClick={() => setShowInvoiceModal(true)}>Faktura</Button>
  )

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="ws-root">
      {/* ── Header ── */}
      <div className="ws-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--color-text-muted)', borderRadius: 6, display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{project.number}</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </h2>
          <Badge variant={project.status === 'done' ? 'success' : project.status === 'cancelled' ? 'danger' : project.status === 'active' ? 'warning' : 'default'}>
            {STATUS_LABEL[project.status]}
          </Badge>
        </div>

        {/* Header right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {onEdit && (
            <Button size="sm" variant="secondary" onClick={() => onEdit(project)}>Edytuj</Button>
          )}
          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="ws-icon-btn"
              onClick={() => setShowMoreMenu(v => !v)}
              title="Więcej opcji"
            >
              <MoreHorizontal size={16} />
            </button>
            {showMoreMenu && (
              <div className="ws-more-menu" onMouseLeave={() => setShowMoreMenu(false)}>
                <button className="ws-more-item" onClick={() => { setShowQR(true); setShowMoreMenu(false) }}>
                  <QrCode size={13} />Kod QR
                </button>
                <button className="ws-more-item" onClick={() => { setShowHandover(true); setShowMoreMenu(false) }}>
                  <ClipboardCheck size={13} />Protokół odbioru
                </button>
                <button className="ws-more-item" onClick={() => { openDailyReport(); setShowMoreMenu(false) }} disabled={htmlReportLoading}>
                  <ClipboardList size={13} />{htmlReportLoading ? 'Generowanie...' : 'Raport dzienny'}
                </button>
                <button className="ws-more-item" onClick={() => { exportProjectReport(); setShowMoreMenu(false) }} disabled={projectReportLoading}>
                  <FileDown size={13} />{projectReportLoading ? 'Generowanie...' : 'Eksportuj PDF'}
                </button>
                {linkedClient?.email && (
                  <button className="ws-more-item" onClick={() => { setReportStatus('confirm'); setShowMoreMenu(false) }}>
                    <CalendarCheck size={13} />Wyślij raport do klienta
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send confirmation bar */}
      {reportStatus === 'confirm' && (
        <div className="ws-send-bar">
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Wyślij raport dzienny → {linkedClient?.email}</span>
          <Button size="sm" onClick={sendDailyReport}>Wyślij</Button>
          <Button size="sm" variant="secondary" onClick={() => setReportStatus('idle')}>Anuluj</Button>
        </div>
      )}
      {reportStatus === 'sending' && (
        <div className="ws-send-bar"><Loader2 size={13} className="spin" />Wysyłanie...</div>
      )}
      {reportStatus === 'done' && (
        <div className="ws-send-bar" style={{ color: 'var(--color-success)' }}>
          <CalendarCheck size={13} />Raport wysłany
        </div>
      )}
      {reportStatus === 'error' && (
        <div className="ws-send-bar" style={{ color: 'var(--color-error)' }}>Błąd wysyłki — spróbuj ponownie</div>
      )}

      {/* ── 3-panel canvas ── */}
      <div className="ws-canvas">
        {/* Left: context panel */}
        <WorkspaceContextPanel
          project={project}
          client={linkedClient}
          estimates={projectEstimates}
          contracts={projectContracts}
          invoices={projectInvoices}
          onCreateEstimate={() => setShowEstimateModal(true)}
          onCreateContract={() => setShowContractModal(true)}
          onCreateInvoice={() => setShowInvoiceModal(true)}
        />

        {/* Center: segment pills + content */}
        <div className="ws-center">
          <ActionBar segment={segment} setSegment={setSegment} contextualButton={contextualButton} />
          <div className="ws-content">
            {segment === 'overview'  && <ProjectTimelineTab  projectId={project.id} onRequestInvoice={() => setShowInvoiceModal(true)} />}
            {segment === 'expenses'  && <ProjectExpensesTab  projectId={project.id} />}
            {segment === 'budget'    && <BudgetComparisonTab projectId={project.id} projectName={project.name} projectNumber={project.number} />}
            {segment === 'photos'    && <ProjectPhotosSection project={project} />}
            {segment === 'approvals' && <ProjectApprovalsTab projectId={project.id} />}
            {segment === 'timeline'  && <ProjectTimelineTab  projectId={project.id} onRequestInvoice={() => setShowInvoiceModal(true)} />}
            {segment === 'memory'    && <ProjectMemoryPanel  projectId={project.id} />}
          </div>
        </div>

        {/* Right: activity stream */}
        <WorkspaceActivityStream
          events={activityEvents}
          onOpenThreads={() => {
            // Chat is removed from segment pills — open as modal-style or navigate
            // For now, we open the threads tab approach via the "Wątki" stream button
            setSegment('overview')
          }}
          onOpenApprovals={() => setSegment('approvals')}
          onOpenTimeline={() => setSegment('timeline')}
        />
      </div>

      {/* ── Modals (unchanged business logic) ── */}
      <Modal open={showEstimateModal} onClose={() => { clearEstimateDraft(); setShowEstimateModal(false) }} title="Nowa wycena">
        <EstimateForm
          companyId={companyId}
          initialEstimate={null}
          initialProjectId={project.id}
          initialClientId={project.client_id ?? null}
          onSubmit={async (input) => {
            await createEstimate.mutateAsync({ ...input, status: input.status ?? 'draft', valid_until: input.valid_until ?? null })
            clearEstimateDraft()
            setShowEstimateModal(false)
          }}
        />
      </Modal>

      <Modal open={showContractModal} onClose={() => setShowContractModal(false)} title="Nowa umowa">
        <ContractForm
          companyId={companyId}
          initialContract={null}
          initialProjectId={project.id}
          initialEstimateId={latestEstimate?.id ?? null}
          onSubmit={async (input) => {
            await createContract.mutateAsync(input)
            setShowContractModal(false)
          }}
        />
      </Modal>

      <Modal open={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Nowa faktura">
        <InvoiceForm
          companyId={companyId}
          initialInvoice={null}
          initialProjectId={project.id}
          initialClientId={project.client_id ?? null}
          initialContractId={latestContract?.id ?? null}
          onSubmit={async (input) => {
            await createInvoice.mutateAsync(input)
            setShowInvoiceModal(false)
          }}
          onSaveDraft={async (input) => {
            await createInvoice.mutateAsync(input)
            setShowInvoiceModal(false)
          }}
        />
      </Modal>

      <ProjectQRCodeModal open={showQR} onClose={() => setShowQR(false)} projectId={project.id} projectName={project.name} projectNumber={project.number} />
      <HandoverProtocolModal open={showHandover} onClose={() => setShowHandover(false)} projectId={project.id} projectName={project.name} companyId={companyId ?? ''} />
    </div>
  )
}
