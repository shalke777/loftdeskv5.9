import type { Project } from '@/entities/project/model'
import { Card } from '@/shared/ui/Card/Card'

const columns: Project['status'][] = ['offer', 'active', 'done', 'cancelled']

export function KanbanBoard({ projects }: { projects: Project[] }) {
  return (
    <div className="grid-4">
      {columns.map((status) => (
        <Card key={status}>
          <h3 style={{ textTransform: 'capitalize' }}>{status}</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {projects.filter((project) => project.status === status).map((project) => (
              <div key={project.id} className="portal-message">
                <strong>{project.number}</strong>
                <div>{project.name}</div>
              </div>
            ))}
            {!projects.some((project) => project.status === status) ? <div className="field__label">Brak projektów</div> : null}
          </div>
        </Card>
      ))}
    </div>
  )
}
