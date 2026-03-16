import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { ProjectTimeline } from '@/features/projects/components/ProjectTimeline'
import { ProjectNotes } from '@/features/projects/components/ProjectNotes'
import { ProjectDocuments } from '@/features/projects/components/ProjectDocuments'
import { ProjectCompleteness } from '@/features/projects/components/ProjectCompleteness'
import { ProjectPortalCTA } from '@/features/projects/components/ProjectPortalCTA'
import { ProjectThreadsTab }   from '@/features/projects/components/ProjectThreadsTab'
import { ProjectExpensesTab }  from '@/features/expenses/components/ProjectExpensesTab'
import { ProjectApprovalsTab } from '@/features/expenses/components/ProjectApprovalsTab'
import { ProjectTimelineTab }  from '@/features/projects/components/ProjectTimelineTab'

const ACCORDION_SECTIONS = [
  { key: 'threads',   label: '💬 Wątki' },
  { key: 'expenses',  label: '💰 Koszty' },
  { key: 'approvals', label: '✅ Akceptacje' },
  { key: 'timeline',  label: '🕒 Oś czasu' },
] as const

type SectionKey = typeof ACCORDION_SECTIONS[number]['key']

export function ProjectDetail({ project, onEdit, onCreateInvoice, onDelete }: { project: Project | null; onEdit?: (project: Project) => void; onCreateInvoice?: (id: string) => void; onDelete?: (id: string) => void }) {
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set())
  const [confirmArchive, setConfirmArchive] = useState(false)
  if (!project) return null

  function toggleSection(key: SectionKey) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="grid-3" style={{ alignItems: 'start' }}>
      <Card className="grid-span-2">
        {/* Nagłówek projektu */}
        <div className="toolbar">
          <div><h3>{project.number}</h3><p>{project.name}</p></div>
          <Badge variant={project.status === 'done' ? 'success' : project.status === 'cancelled' ? 'danger' : project.status === 'active' ? 'warning' : 'default'}>{project.status}</Badge>
        </div>
        <p>Adres: {project.address || 'brak'}</p>
        <p>Start: {project.start_date || 'nie ustawiono'} · Koniec: {project.end_date || 'nie ustawiono'}</p>
        <div style={{ margin: '12px 0' }}>
          <p style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>Kompletność dokumentacji</p>
          <ProjectCompleteness
            score={project.completeness_score ?? 0}
            flags={project.completeness_flags as any}
          />
        </div>
        <div className="actions-row">
          {onEdit ? <Button variant="secondary" onClick={() => onEdit(project)}>Edytuj projekt</Button> : null}
          {onCreateInvoice ? <Button onClick={() => onCreateInvoice(project.id)}>Generuj fakturę</Button> : null}
          {onDelete ? (
            <Button
              variant="danger"
              icon={<Trash2 size={14} />}
              title={confirmArchive ? 'Kliknij ponownie, aby potwierdzić' : 'Archiwizuj projekt'}
              onBlur={() => setConfirmArchive(false)}
              onClick={() => {
                if (!confirmArchive) { setConfirmArchive(true); return }
                setConfirmArchive(false)
                onDelete(project.id)
              }}
            >
              {confirmArchive ? 'Potwierdź archiwizację' : 'Archiwizuj projekt'}
            </Button>
          ) : null}
        </div>

        {/* Przegląd — zawsze widoczny */}
        <div style={{ marginTop: 20 }}>
          <ProjectTimeline project={project} />
        </div>

        {/* Sekcje rozwijane */}
        {ACCORDION_SECTIONS.map(({ key, label }) => {
          const isOpen = openSections.has(key)
          return (
            <div key={key} style={{ marginTop: 12 }}>
              <button
                onClick={() => toggleSection(key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px',
                  background: isOpen ? 'var(--color-surface-hover, #f4ede4)' : 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  color: 'var(--color-text)', textAlign: 'left',
                }}
              >
                <span>{label}</span>
                <span style={{ fontSize: 11, opacity: 0.4, display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
              </button>
              {isOpen && (
                <div style={{ marginTop: 8 }}>
                  {key === 'threads'   && <ProjectThreadsTab  projectId={project.id} />}
                  {key === 'expenses'  && <ProjectExpensesTab projectId={project.id} />}
                  {key === 'approvals' && <ProjectApprovalsTab projectId={project.id} />}
                  {key === 'timeline'  && <ProjectTimelineTab  projectId={project.id} />}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      <div style={{ display: 'grid', gap: 16 }}>
        <ProjectPortalCTA projectId={project.id} projectName={project.name} />
        <ProjectNotes project={project} />
        <ProjectDocuments project={project} />
      </div>
    </div>
  )
}
