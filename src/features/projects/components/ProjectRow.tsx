import { memo, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Edit2, FileText, Trash2 } from 'lucide-react'
import type { Project } from '@/entities/project/model'
import { ProjectWorkspace } from '@/features/projects/components/workspace/ProjectWorkspace'
import { ProjectCompleteness } from '@/features/projects/components/ProjectCompleteness'
import { QuickPhotoButton } from '@/features/projects/components/QuickPhotoButton'

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Project['status'], string> = {
  offer:     'Oferta',
  active:    'W realizacji',
  done:      'Zakończony',
  cancelled: 'Anulowany',
}

const STATUS_CLASS: Record<Project['status'], string> = {
  offer:     'proj-status proj-status--offer',
  active:    'proj-status proj-status--active',
  done:      'proj-status proj-status--done',
  cancelled: 'proj-status proj-status--cancelled',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  project:          Project
  clientName:       string | null
  onEdit:           (project: Project) => void
  onDuplicate:      (project: Project) => void
  onStatusChange:   (id: string, status: Project['status']) => void
  onCreateInvoice:  (id: string) => void
  onDelete:         (id: string) => void
  canAdvance?:      boolean
  canDelete?:       boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectRowImpl({
  project,
  clientName,
  onEdit,
  onDuplicate,
  onStatusChange,
  onCreateInvoice,
  onDelete,
  canAdvance = true,
  canDelete  = true,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const score        = project.completeness_score ?? null
  const flags        = project.completeness_flags ?? null
  const noClient     = !project.client_id && (project.status === 'offer' || project.status === 'active')
  const noEstimate   = (project.status === 'offer' || project.status === 'active') && flags != null && !flags.has_estimate
  const noContract   = project.status === 'active' && flags != null && !flags.has_contract
  const noInvoice    = project.status === 'done' && flags != null && !flags.has_invoice
  const showSignals  = score != null || noClient || noEstimate || noContract || noInvoice

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDelete(project.id)
    setConfirmDelete(false)
  }

  return (
    <div className={`proj-row${expanded ? ' proj-row--open' : ''}`}>
      {/* ── Summary row ─────────────────────────────────────────────────── */}
      <div
        className="proj-row__header"
        role="button"
        tabIndex={0}
        onClick={() => { setExpanded((v) => !v); setConfirmDelete(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v) }}
      >
        {/* Chevron */}
        <span className="proj-row__chevron" aria-hidden>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        {/* Left: name + client */}
        <div className="proj-row__info">
          <span className="proj-row__name">{project.name}</span>
          <span className="proj-row__meta">
            {project.number && <span className="proj-row__number">{project.number}</span>}
            {clientName && <span className="proj-row__client">{clientName}</span>}
            {!clientName && project.address && (
              <span className="proj-row__client">{project.address}</span>
            )}
          </span>
          {showSignals && (
            <div className="proj-row__signals">
              {score != null && <ProjectCompleteness score={score} compact />}
              {noEstimate  && <span className="proj-signal proj-signal--warn">Brak wyceny</span>}
              {noClient    && <span className="proj-signal proj-signal--warn">Brak klienta</span>}
              {noContract  && <span className="proj-signal proj-signal--warn">Brak umowy</span>}
              {noInvoice   && <span className="proj-signal proj-signal--danger">⚠ Brak faktury</span>}
            </div>
          )}
        </div>

        {/* Right: status + actions */}
        <div className="proj-row__right" onClick={(e) => e.stopPropagation()}>
          <span className={STATUS_CLASS[project.status]}>{STATUS_LABEL[project.status]}</span>

          <div className="proj-row__actions">
            <QuickPhotoButton projectId={project.id} />
            <button
              type="button"
              className="proj-action-btn"
              title="Edytuj"
              onClick={() => onEdit(project)}
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              className="proj-action-btn"
              title="Duplikuj jako nowy projekt"
              onClick={() => onDuplicate(project)}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              className="proj-action-btn"
              title="Generuj fakturę"
              onClick={() => onCreateInvoice(project.id)}
            >
              <FileText size={14} />
            </button>
            {canDelete && (
              <button
                type="button"
                className={`proj-action-btn proj-action-btn--danger${confirmDelete ? ' proj-action-btn--confirm' : ''}`}
                title={confirmDelete ? 'Kliknij ponownie, aby potwierdzić' : 'Usuń projekt'}
                onClick={handleDelete}
                onBlur={() => setConfirmDelete(false)}
              >
                <Trash2 size={14} />
                {confirmDelete && <span className="proj-action-btn__label">Potwierdź</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded workspace ───────────────────────────────────────────── */}
      {expanded && (
        <div className="proj-row__detail">
          <ProjectWorkspace
            project={project}
            onEdit={onEdit}
            onClose={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  )
}

export const ProjectRow = memo(ProjectRowImpl)

