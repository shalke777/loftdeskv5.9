import type { Project } from '@/entities/project/model'
import { Card } from '@/shared/ui/Card/Card'

export function ProjectNotes({ project }: { project: Project }) {
  return (
    <Card>
      <h4>Notatki realizacyjne</h4>
      <p>{project.notes || 'Brak notatek dla projektu.'}</p>
    </Card>
  )
}
