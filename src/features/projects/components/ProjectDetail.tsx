import { useState } from 'react'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { ProjectTimeline } from '@/features/projects/components/ProjectTimeline'
import { ProjectNotes } from '@/features/projects/components/ProjectNotes'
import { ProjectDocuments } from '@/features/projects/components/ProjectDocuments'
import { ProjectCompleteness } from '@/features/projects/components/ProjectCompleteness'
import { ProjectPortalCTA } from '@/features/projects/components/ProjectPortalCTA'
import { ProjectThreadsTab } from '@/features/projects/components/ProjectThreadsTab'

type MainTab = 'overview' | 'threads'

export function ProjectDetail({ project, onEdit, onCreateInvoice }: { project: Project | null; onEdit?: (project: Project) => void; onCreateInvoice?: (id: string) => void }) {
  const [tab, setTab] = useState<MainTab>('overview')
  if (!project) return null

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
        </div>

        {/* Zakładki główne */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20, marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
          {(['overview', 'threads'] as MainTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding:      '8px 16px',
                border:       'none',
                background:   'transparent',
                fontWeight:   tab === t ? 700 : 400,
                fontSize:     13,
                color:        tab === t ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                borderBottom: tab === t ? '2px solid var(--color-brand)' : '2px solid transparent',
                cursor:       'pointer',
                marginBottom: -1,
              }}
            >
              {t === 'overview' ? 'Przegląd' : '💬 Wątki'}
            </button>
          ))}
        </div>

        {/* Zawartość zakładki */}
        {tab === 'overview' && <ProjectTimeline project={project} />}
        {tab === 'threads'  && <ProjectThreadsTab projectId={project.id} />}
      </Card>

      <div style={{ display: 'grid', gap: 16 }}>
        <ProjectPortalCTA projectId={project.id} projectName={project.name} />
        <ProjectNotes project={project} />
        <ProjectDocuments project={project} />
      </div>
    </div>
  )
}
