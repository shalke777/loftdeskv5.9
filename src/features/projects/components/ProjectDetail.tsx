import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
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
import { useClients } from '@/features/clients/hooks/useClients'
import { useCreateEstimate, useEstimates } from '@/features/estimates/hooks/useEstimates'
import { EstimateForm, clearDraft as clearEstimateDraft } from '@/features/estimates/components/EstimateModal/EstimateForm'
import { useCreateContract, useContracts } from '@/features/contracts/hooks/useContracts'
import { ContractForm } from '@/features/contracts/components/ContractModal/ContractForm'
import { useCreateInvoice } from '@/features/invoices/hooks/useInvoices'
import { InvoiceForm } from '@/features/invoices/components/InvoiceModal/InvoiceForm'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'

const STATUS_LABEL: Record<Project['status'], string> = {
  offer:     'Oferta',
  active:    'W realizacji',
  done:      'Zakończony',
  cancelled: 'Anulowany',
}

type MainTab = 'overview' | 'threads' | 'expenses' | 'budget' | 'approvals' | 'photos' | 'timeline'

export function ProjectDetail({ project, onEdit, onCreateInvoice }: { project: Project | null; onEdit?: (project: Project) => void; onCreateInvoice?: (id: string) => void }) {
  const [tab, setTab] = useState<MainTab>('overview')
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [reportStatus, setReportStatus] = useState<'idle' | 'confirm' | 'sending' | 'done' | 'error'>('idle')
  const { data: clients } = useClients()
  const linkedClient = clients?.find(c => c.id === project?.client_id)
  const companyId = useCompanyId()
  const createEstimate = useCreateEstimate()
  const createContract = useCreateContract()
  const createInvoice = useCreateInvoice()
  const { data: estimates = [] } = useEstimates()
  const { data: contracts = [] } = useContracts()

  if (!project) return null

  const flags = (project.completeness_flags ?? {}) as Record<string, boolean>
  const projectEstimates = estimates.filter(e => e.project_id === project.id)
  const projectContracts = contracts.filter(c => c.project_id === project.id)
  const hasEstimate = flags.has_estimate || projectEstimates.length > 0
  const hasContract = flags.has_contract || projectContracts.length > 0
  const latestEstimate = projectEstimates[projectEstimates.length - 1] ?? null
  const latestContract = projectContracts[projectContracts.length - 1] ?? null

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

  return (
    <div className="grid-3" style={{ alignItems: 'start' }}>
      <Card className="grid-span-2">
        {/* Nagłówek projektu */}
        <div className="toolbar">
          <div><h3>{project.number}</h3><p>{project.name}</p></div>
          <Badge variant={project.status === 'done' ? 'success' : project.status === 'cancelled' ? 'danger' : project.status === 'active' ? 'warning' : 'default'}>{STATUS_LABEL[project.status]}</Badge>
        </div>
        <p>Adres: {project.address || 'brak'}</p>
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
          {(['overview', 'threads', 'expenses', 'budget', 'approvals', 'photos', 'timeline'] as MainTab[]).map(t => (
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
               : 'Oś czasu'}
            </button>
          ))}
        </div>

        {/* Zawartość zakładki */}
        {tab === 'overview'   && <ProjectTimeline project={project} />}
        {tab === 'threads'    && <ProjectThreadsTab  projectId={project.id} />}
        {tab === 'expenses'   && <ProjectExpensesTab projectId={project.id} />}
        {tab === 'budget'     && <BudgetComparisonTab projectId={project.id} />}
        {tab === 'approvals'  && <ProjectApprovalsTab projectId={project.id} />}
        {tab === 'photos'     && <ProjectPhotosSection project={project} />}
        {tab === 'timeline'   && <ProjectTimelineTab  projectId={project.id} />}

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
    </div>
  )
}
