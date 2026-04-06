import { useMemo, useState } from 'react'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Modal } from '@/shared/ui/Modal/Modal'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { QueryError } from '@/shared/ui/QueryError/QueryError'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import {
  useCreateInvoiceFromProject,
  useCreateProject,
  useHardDeleteProject,
  useProjects,
  useUpdateProject,
  useUpdateProjectStatus,
} from '@/features/projects/hooks/useProjects'
import { ProjectRow } from '@/features/projects/components/ProjectRow'
import { AssignmentQueueBanner } from '@/features/projects/components/AssignmentQueueBanner'
import { ProjectForm } from '@/features/projects/components/ProjectModal/ProjectForm'
import { ProjectTemplatePicker } from '@/features/projects/components/ProjectModal/ProjectTemplatePicker'
import type { ProjectTemplateValues } from '@/features/projects/components/ProjectModal/ProjectTemplatePicker'
import type { Project } from '@/entities/project/model'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { PlanLimitGuard } from '@/features/billing/components/PlanLimitGuard'
import { ProjectInvoiceModal } from '@/features/projects/components/ProjectInvoiceModal'
import type { InvoiceFromProjectConfig } from '@/features/projects/components/ProjectInvoiceModal'
import { useClients } from '@/features/clients/hooks/useClients'

type FilterStatus = 'all' | Project['status']

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all',       label: 'Wszystkie' },
  { value: 'active',    label: 'Aktywne' },
  { value: 'offer',     label: 'Oferta' },
  { value: 'done',      label: 'Zakończone' },
  { value: 'cancelled', label: 'Anulowane' },
]

export function ProjectsPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  // null = show template picker, non-null = skip picker and go straight to form
  const [templateValues, setTemplateValues] = useState<ProjectTemplateValues | null>(null)
  const [invoiceProjectId, setInvoiceProjectId] = useState<string | null>(null)

  const companyId   = useCompanyId()
  const { data, isLoading, isError, refetch } = useProjects()
  const { data: clients = [] } = useClients()
  const createProject  = useCreateProject()
  const updateProject  = useUpdateProject()
  const updateStatus   = useUpdateProjectStatus()
  const createInvoice  = useCreateInvoiceFromProject()
  const deleteProject  = useHardDeleteProject()
  const canCreate      = useCan('projects.create')
  const canDelete      = useCan('projects.delete')
  const canUpdateStatus = useCan('projects.updateStatus')

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients],
  )

  const counts = useMemo(() => ({
    all:       data?.length ?? 0,
    active:    data?.filter((p) => p.status === 'active').length    ?? 0,
    offer:     data?.filter((p) => p.status === 'offer').length     ?? 0,
    done:      data?.filter((p) => p.status === 'done').length      ?? 0,
    cancelled: data?.filter((p) => p.status === 'cancelled').length ?? 0,
  }), [data])

  const visible = useMemo(
    () => filterStatus === 'all' ? (data ?? []) : (data ?? []).filter((p) => p.status === filterStatus),
    [data, filterStatus],
  )

  async function submit(input: any) {
    try {
      if (editing) await updateProject.mutateAsync({ id: editing.id, input })
      else await createProject.mutateAsync(input)
      setEditing(null)
      setTemplateValues(null)
      setOpen(false)
    } catch { /* error handled by hook's onError */ }
  }

  function handleEdit(project: Project) { setEditing(project); setTemplateValues(null); setOpen(true) }
  function handleCreateInvoice(id: string) { setInvoiceProjectId(id) }
  function handleDuplicate(project: Project) {
    setEditing(null)
    setTemplateValues({
      name: `Kopia — ${project.name}`,
      notes: project.notes || '',
      status: 'offer',
      address: project.address || '',
    })
    setOpen(true)
  }
  function submitInvoiceConfig(config: InvoiceFromProjectConfig) { createInvoice.mutate(config); setInvoiceProjectId(null) }

  return (
    <div className="page">
      {/* Header */}
      <div className="toolbar">
        <PageHeader title="Projekty" subtitle="Lista wszystkich realizacji i ofert." />
        <div className="toolbar__actions">
          {canCreate && (
            <PlanLimitGuard resource="projects">
              <Button onClick={() => { setEditing(null); setOpen(true) }}>
                <Plus size={16} style={{ marginRight: 4 }} />
                Nowy projekt
              </Button>
            </PlanLimitGuard>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <AssignmentQueueBanner />
      <div className="proj-filters">
        {FILTER_LABELS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`proj-filter-pill${filterStatus === value ? ' proj-filter-pill--active' : ''}`}
            onClick={() => setFilterStatus(value)}
          >
            {label}
            <span className="proj-filter-pill__count">{counts[value]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filterStatus === 'all' ? 'Brak projektów' : 'Brak projektów w tej kategorii'}
          description={
            filterStatus === 'all'
              ? 'Projekt łączy klienta, koszty, dokumenty i portal klienta. Utwórz pierwszy projekt.'
              : 'Zmień filtr lub utwórz nowy projekt.'
          }
          icon={FolderKanban}
          action={
            canCreate && filterStatus === 'all'
              ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Utwórz projekt</Button>
              : undefined
          }
        />
      ) : (
        <div className="proj-list">
          {visible.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              clientName={project.client_id ? (clientMap[project.client_id] ?? null) : null}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
              onCreateInvoice={handleCreateInvoice}
              onDelete={(id) => deleteProject.mutate(id)}
              canAdvance={canUpdateStatus}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      {canCreate && (
        <Modal
          open={open}
          onClose={() => { setOpen(false); setEditing(null); setTemplateValues(null) }}
          title={editing ? 'Edytuj projekt' : templateValues ? 'Nowy projekt' : 'Nowy projekt — wybierz szablon'}
        >
          {!editing && !templateValues ? (
            <ProjectTemplatePicker onSelect={(data) => setTemplateValues(data)} />
          ) : (
            <ProjectForm
              companyId={companyId}
              initialProject={editing}
              initialValues={templateValues ?? undefined}
              onSubmit={submit}
            />
          )}
        </Modal>
      )}

      <ProjectInvoiceModal
        open={!!invoiceProjectId}
        projectId={invoiceProjectId}
        onClose={() => setInvoiceProjectId(null)}
        onSubmit={submitInvoiceConfig}
        isLoading={createInvoice.isPending}
      />
    </div>
  )
}
