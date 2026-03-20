import { useState } from 'react'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Select } from '@/shared/ui/Select/Select'

function variant(status: Project['status']) { if (status === 'done') return 'success'; if (status === 'cancelled') return 'danger'; if (status === 'active') return 'warning'; return 'default' }

export function ProjectCard({ project, onStatusChange, onDelete, onOpen, onEdit, onCreateInvoice, canAdvance = true, canDelete = true }: { project: Project; onStatusChange: (id: string, status: Project['status']) => void; onDelete: (id: string) => void; onOpen: (project: Project) => void; onEdit?: (project: Project) => void; onCreateInvoice?: (id: string) => void; canAdvance?: boolean; canDelete?: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDelete(project.id)
    setConfirmDelete(false)
  }

  return (
    <Card>
      <div className="toolbar"><div><strong>{project.number}</strong><div>{project.name}</div></div><Badge variant={variant(project.status)}>{project.status}</Badge></div>
      <p>Adres: {project.address || 'brak'}</p>
      {canAdvance ? <Select label="Status projektu" value={project.status} onChange={(e) => { onStatusChange(project.id, e.target.value as Project['status']); setConfirmDelete(false) }} options={[{ value: 'offer', label: 'W ofercie' }, { value: 'active', label: 'Aktywny' }, { value: 'done', label: 'Zakończony' }, { value: 'cancelled', label: 'Anulowany' }]} /> : null}
      <div className="actions-row">
        <Button variant="ghost" onClick={() => onOpen(project)}>Szczegóły</Button>
        {onEdit ? <Button variant="secondary" onClick={() => onEdit(project)}>Edytuj</Button> : null}
        {onCreateInvoice ? <Button variant="secondary" onClick={() => onCreateInvoice(project.id)}>Generuj FV</Button> : null}
        {canDelete ? (
          <Button
            variant="danger"
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? 'Kliknij ponownie, aby potwierdzić' : 'Usuń'}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
