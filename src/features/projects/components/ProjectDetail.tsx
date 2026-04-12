import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarCheck, FileDown, QrCode, ClipboardCheck, Loader2, ClipboardList, User } from 'lucide-react'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'
import { ProjectTimeline } from '@/features/projects/components/ProjectTimeline'
import { ProjectNotes } from '@/features/projects/components/ProjectNotes'
import { ProjectDocuments } from '@/features/projects/components/ProjectDocuments'
import { ProjectCompleteness } from '@/features/projects/components/ProjectCompleteness'
import { ProjectPortalCTA } from '@/features/projects/components/ProjectPortalCTA'
import { ProjectThreadsTab }   from '@/features/projects/components/ProjectThreadsTab'
import { ProjectExpensesTab }  from '@/features/expenses/components/ProjectExpensesTab'
import { ProjectApprovalsTab } from '@/features/expenses/components/ProjectApprovalsTab'
import { ProjectTimelineTab }  from '@/features/projects/components/ProjectTimelineTab'
import { ProjectPhotosSection } from '@/features/projects/components/ProjectPhotosSection'
import { BudgetComparisonTab } from '@/features/projects/components/BudgetComparisonTab'
import { ProjectMemoryPanel } from '@/features/projects/components/ProjectMemoryPanel'
import { ProjectQRCodeModal } from '@/features/projects/components/ProjectQRCodeModal'
import { HandoverProtocolModal } from '@/features/projects/components/HandoverProtocolModal'
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

const STATUS_LABEL: Record<Project['status'], string> = {
  offer:     'Oferta',
  active:    'W realizacji',
  done:      'Zakończony',
  cancelled: 'Anulowany',
}

type MainTab = 'overview' | 'threads' | 'expenses' | 'budget' | 'approvals' | 'photos' | 'timeline' | 'memory'

export function ProjectDetail({ project, onEdit, onCreateInvoice }: { project: Project | null; onEdit?: (project: Project) => void; onCreateInvoice?: (id: string) => void }) {
  const [tab, setTab] = useState<MainTab>('overview')
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [reportStatus, setReportStatus] = useState<'idle' | 'confirm' | 'sending' | 'done' | 'error'>('idle')
  const [htmlReportLoading, setHtmlReportLoading] = useState(false)
  const [projectReportLoading, setProjectReportLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showHandover, setShowHandover] = useState(false)
  const { data: clients } = useClients()
  const linkedClient = clients?.find(c => c.id === project?.client_id)
  const companyId = useCompanyId()
  const companyMeta = useCompanyMeta()
  const createEstimate = useCreateEstimate()
  const createContract = useCreateContract()
  const createInvoice = useCreateInvoice()
  const { data: estimates = [] } = useEstimates()
  const { data: contracts = [] } = useContracts()
  const { data: allInvoices = [] } = useInvoices()

  if (!project) return null

  const flags = (project.completeness_flags ?? {}) as Record<string, boolean>
  const projectEstimates = estimates.filter(e => e.project_id === project.id)
  const projectContracts = contracts.filter(c => c.project_id === project.id)
  const projectInvoices  = allInvoices.filter(i => i.project_id === project.id)
  const hasEstimate = flags.has_estimate || projectEstimates.length > 0
  const hasContract = flags.has_contract || projectContracts.length > 0
  const latestEstimate = projectEstimates[projectEstimates.length - 1] ?? null
  const latestContract = projectContracts[projectContracts.length - 1] ?? null

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
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
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
        `Data: ${today}`,
        `Projekt: ${project.number} — ${project.name}`,
        project.address ? `Adres budowy: ${project.address}` : null,
        `Status: ${STATUS_LABEL[project.status]}`,
        '',
        'Prace są kontynuowane. Zapraszamy do sprawdzenia aktualnego stanu projektu i dokumentów w portalu klienta.',
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
        { project, estimates: projectEstimates, contracts: projectContracts, invoices: projectInvoices, client: linkedClient ?? null },
        { name: companyMeta.name, nip: companyMeta.nip, address: companyMeta.address,
          postalCity: companyMeta.postalCity, email: companyMeta.email, phone: companyMeta.phone, logoUrl: companyMeta.logoUrl },
      )
      const blob = await generatePdfBlob(html)
      const filename = `Raport_${(project.number ?? project.id).replace(/[/\\:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      downloadBlob(filename, blob)
    } catch (e) {
      console.error('[ProjectReport] export error', e)
      alert('Nie udało się wygenerować raportu PDF.')
    } finally {
      setProjectReportLoading(false)
    }
  }

  return (
    <div className="grid-3" style={{ alignItems: 'start' }}>
      <Card className="grid-span-2">
        {/* Nagłówek projektu */}
        <div className="toolbar">
          <div><h3>{project.number}</h3><p>{project.name}</p></div>
          <Badge variant={project.status === 'done' ? 'success' : project.status === 'cancelled' ? 'danger' : project.status === 'active' ? 'warning' : 'default'}>{STATUS_LABEL[project.status]}</Badge>
        </div>
        <p>Adres: {project.address || 'brak'}</p>
        {linkedClient && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Klient:</span>
            <Link to={`/clients/${linkedClient.id}` as any} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none' }}>
              {linkedClient.name}
            </Link>
          </p>
        )}
        <p>Start: {project.start_date || 'nie ustawiono'} · Koniec: {project.end_date || 'nie ustawiono'}</p>
        <div style={{ margin: '12px 0' }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Kompletność dokumentacji</p>
          <ProjectCompleteness
            score={project.completeness_score ?? 0}
            flags={project.completeness_flags as any}
          />
        </div>
        <div className="actions-row">
          {onEdit ? <Button variant="secondary" onClick={() => onEdit(project)}>Edytuj projekt</Button> : null}
          <Button variant={!hasEstimate ? undefined : 'secondary'} onClick={() => setShowEstimateModal(true)}>Nowa wycena</Button>
          {hasEstimate && (
            <Button variant={!hasContract ? undefined : 'secondary'} onClick={() => setShowContractModal(true)}>Nowa umowa</Button>
          )}
          {hasContract && (
            <Button onClick={() => setShowInvoiceModal(true)}>Generuj fakturę</Button>
          )}
          {/* Raport dzienny HTML — podgląd + druk */}
          <Button variant="secondary" onClick={openDailyReport} disabled={htmlReportLoading}>
            {htmlReportLoading
              ? <><Loader2 size={14} style={{ marginRight: 4 }} />Generowanie...</>
              : <><ClipboardList size={14} style={{ marginRight: 4 }} />Raport dzienny</>}
          </Button>
          {/* Raport zbiorczy projektu — PDF */}
          <Button variant="secondary" onClick={exportProjectReport} disabled={projectReportLoading}>
            <FileDown size={14} style={{ marginRight: 4 }} />
            {projectReportLoading ? 'Generowanie...' : 'Eksportuj PDF'}
          </Button>
          {/* QR kod projektu */}
          <Button variant="secondary" onClick={() => setShowQR(true)}>
            <QrCode size={14} style={{ marginRight: 4 }} />
            Kod QR
          </Button>
          {/* Protokół odbioru */}
          <Button variant="secondary" onClick={() => setShowHandover(true)}>
            <ClipboardCheck size={14} style={{ marginRight: 4 }} />
            Protokół odbioru
          </Button>
          {/* Raport dzienny — widoczny gdy projekt ma klienta z e-mailem */}
          {linkedClient?.email && reportStatus === 'idle' && (
            <Button variant="secondary" onClick={() => setReportStatus('confirm')}>
              <CalendarCheck size={14} style={{ marginRight: 4 }} />
              Raport dzienny
            </Button>
          )}
          {linkedClient?.email && reportStatus === 'confirm' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>→ {linkedClient.email}</span>
              <Button size="sm" onClick={sendDailyReport}>Wyślij</Button>
              <Button size="sm" variant="secondary" onClick={() => setReportStatus('idle')}>Anuluj</Button>
            </span>
          )}
          {linkedClient?.email && reportStatus === 'sending' && (
            <Button variant="secondary" loading disabled>Wysyłanie...</Button>
          )}
          {linkedClient?.email && reportStatus === 'done' && (
            <span style={{ fontSize: 12, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CalendarCheck size={13} /> Raport wysłany
            </span>
          )}
          {linkedClient?.email && reportStatus === 'error' && (
            <span style={{ fontSize: 12, color: 'var(--color-error)' }}>Błąd wysyłki — spróbuj ponownie</span>
          )}
        </div>

        {/* Zakładki główne */}
        <div className="proj-detail-tabs" style={{ display: 'flex', gap: 4, marginTop: 20, marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 0, overflowX: 'auto' }}>
          {(['overview', 'threads', 'expenses', 'budget', 'approvals', 'photos', 'timeline', 'memory'] as MainTab[]).map(t => (
            <button
              key={t}
              className="proj-detail-tab"
              onClick={() => setTab(t)}
              style={{
                fontWeight:   tab === t ? 700 : 400,
                color:        tab === t ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                borderBottom: tab === t ? '2px solid var(--color-brand)' : '2px solid transparent',
              }}
            >
              {t === 'overview'  ? 'Przegląd'
               : t === 'threads'   ? 'Wątki'
               : t === 'expenses'  ? 'Koszty'
               : t === 'budget'    ? 'Plan vs wykon.'
               : t === 'approvals' ? 'Akceptacje'
               : t === 'photos'    ? 'Zdjęcia'
               : t === 'memory'    ? 'Pamięć'
               : 'Oś czasu'}
            </button>
          ))}
        </div>

        {/* Zawartość zakładki */}
        {tab === 'overview'   && <ProjectTimeline project={project} />}
        {tab === 'threads'    && <ProjectThreadsTab  projectId={project.id} />}
        {tab === 'expenses'   && <ProjectExpensesTab projectId={project.id} />}
        {tab === 'budget'     && <BudgetComparisonTab projectId={project.id} projectName={project.name} projectNumber={project.number} />}
        {tab === 'approvals'  && <ProjectApprovalsTab projectId={project.id} />}
        {tab === 'photos'     && <ProjectPhotosSection project={project} />}
        {tab === 'timeline'   && <ProjectTimelineTab  projectId={project.id} onRequestInvoice={() => setShowInvoiceModal(true)} />}
        {tab === 'memory'     && <ProjectMemoryPanel  projectId={project.id} />}

      </Card>

      <div style={{ display: 'grid', gap: 16 }}>
        <ProjectPortalCTA
            projectId={project.id}
            projectName={project.name}
            clientId={project.client_id}
            clientEmail={linkedClient?.email ?? null}
            clientName={linkedClient?.name ?? null}
          />
        <ProjectNotes project={project} />
        <ProjectDocuments
          project={project}
          onCreateEstimate={() => setShowEstimateModal(true)}
          onCreateContract={() => setShowContractModal(true)}
          onCreateInvoice={() => setShowInvoiceModal(true)}
        />
      </div>

      {/* Nowa wycena — pre-seeded z projektu */}
      <Modal
        open={showEstimateModal}
        onClose={() => { clearEstimateDraft(); setShowEstimateModal(false) }}
        title="Nowa wycena"
      >
        <EstimateForm
          companyId={companyId}
          initialEstimate={null}
          initialProjectId={project.id}
          initialClientId={project.client_id ?? null}
          onSubmit={async (input) => {
            await createEstimate.mutateAsync({
              ...input,
              status: input.status ?? 'draft',
              valid_until: input.valid_until ?? null,
            })
            clearEstimateDraft()
            setShowEstimateModal(false)
          }}
        />
      </Modal>

      {/* Nowa umowa — pre-seeded z projektu */}
      <Modal
        open={showContractModal}
        onClose={() => setShowContractModal(false)}
        title="Nowa umowa"
      >
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

      {/* Nowa faktura — pre-seeded z projektu i klienta */}
      <Modal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="Nowa faktura"
      >
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

      {/* QR kod projektu */}
      <ProjectQRCodeModal
        open={showQR}
        onClose={() => setShowQR(false)}
        projectId={project.id}
        projectName={project.name}
        projectNumber={project.number}
      />
      <HandoverProtocolModal
        open={showHandover}
        onClose={() => setShowHandover(false)}
        projectId={project.id}
        projectName={project.name}
        companyId={companyId ?? ''}
      />
    </div>
  )
}
