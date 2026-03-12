import { useMemo, useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Modal } from '@/shared/ui/Modal/Modal'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCreateInvoiceFromProject, useCreateProject, useDeleteProject, useProjects, useUpdateProject, useUpdateProjectStatus } from '@/features/projects/hooks/useProjects'
import { ProjectCard } from '@/features/projects/components/ProjectCard'
import { ProjectForm } from '@/features/projects/components/ProjectModal/ProjectForm'
import { KanbanBoard } from '@/features/projects/components/KanbanBoard'
import type { Project } from '@/entities/project/model'
import { ProjectDetail } from '@/features/projects/components/ProjectDetail'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { ProjectInvoiceModal } from '@/features/projects/components/ProjectInvoiceModal'
import type { InvoiceFromProjectConfig } from '@/features/projects/components/ProjectInvoiceModal'

export function ProjectsPage() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Project | null>(null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [invoiceProjectId, setInvoiceProjectId] = useState<string | null>(null)
  const companyId = useCompanyId()
  const { data, isLoading } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const updateStatus = useUpdateProjectStatus()
  const createInvoice = useCreateInvoiceFromProject()
  const deleteProject = useDeleteProject()
  const summary = useMemo(() => ({ active: data?.filter((item) => item.status === 'active').length ?? 0, offer: data?.filter((item) => item.status === 'offer').length ?? 0, done: data?.filter((item) => item.status === 'done').length ?? 0 }), [data])
  const canCreate = useCan('projects.create')
  const canDelete = useCan('projects.delete')
  const canUpdateStatus = useCan('projects.updateStatus')

  async function submit(input: any) {
    if (editing) await updateProject.mutateAsync({ id: editing.id, input })
    else await createProject.mutateAsync(input)
    setEditing(null); setOpen(false)
  }

  function handleCreateInvoice(id: string) { setInvoiceProjectId(id) }
  function submitInvoiceConfig(config: InvoiceFromProjectConfig) { createInvoice.mutate(config); setInvoiceProjectId(null) }

  return (
    <div>
      <div className="toolbar"><PageHeader title="Projekty" subtitle="Harmonogram realizacji, budżet, koszty, statusy i fakturowanie projektów." /><div className="toolbar__actions">{canCreate ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Nowy projekt</Button> : null}</div></div>
      <div className="grid-4" style={{ marginBottom: 16 }}><div className="card"><h3>Aktywne</h3><p>{summary.active}</p></div><div className="card"><h3>W ofercie</h3><p>{summary.offer}</p></div><div className="card"><h3>Zakończone</h3><p>{summary.done}</p></div></div>
      {selected ? <ProjectDetail project={selected} onEdit={(item) => { setEditing(item); setOpen(true) }} onCreateInvoice={handleCreateInvoice} /> : null}
      {isLoading ? <Spinner /> : null}
      {!isLoading && !data?.length ? (
        <EmptyState
          title="Brak projektów"
          description="Projekt łączy klienta, koszty, dokumenty i portal klienta w jednym miejscu. Utwórz pierwszy projekt, aby zacząć realizację."
          icon={FolderKanban}
          action={canCreate ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Utwórz projekt</Button> : undefined}
        />
      ) : null}
      {data?.length ? <KanbanBoard projects={data} /> : null}
      <div className="grid-2" style={{ marginTop: 16 }}>{data?.map((project) => <ProjectCard key={project.id} project={project} onOpen={setSelected} onEdit={(item) => { setEditing(item); setOpen(true) }} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} onCreateInvoice={handleCreateInvoice} onDelete={(id) => deleteProject.mutate(id)} canAdvance={canUpdateStatus} canDelete={canDelete} />)}</div>
      {canCreate ? <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edytuj projekt' : 'Nowy projekt'}><ProjectForm companyId={companyId} initialProject={editing} onSubmit={submit} /></Modal> : null}
      <ProjectInvoiceModal open={!!invoiceProjectId} projectId={invoiceProjectId} onClose={() => setInvoiceProjectId(null)} onSubmit={submitInvoiceConfig} isLoading={createInvoice.isPending} />
    </div>
  )
}
