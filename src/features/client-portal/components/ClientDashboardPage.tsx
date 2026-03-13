// =============================================================================
// ClientDashboardPage — lista projektów zalogowanego klienta (v6.0)
// =============================================================================

import { Link } from '@tanstack/react-router'
import { useClientProjects } from '@/features/client-portal/hooks/useClientPortal'
import { Badge } from '@/shared/ui/Badge/Badge'
import type { ClientProject } from '@/features/client-portal/api/client-portal.api'

const STATUS_LABEL: Record<string, string> = {
  offer:     'Wycena',
  active:    'W realizacji',
  done:      'Zakończony',
  cancelled: 'Anulowany',
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  offer:     'default',
  active:    'warning',
  done:      'success',
  cancelled: 'danger',
}

function ProjectCard({ project }: { project: ClientProject }) {
  return (
    <Link
      to="/client/project/$id"
      params={{ id: project.id }}
      className="client-project-card"
    >
      <div className="client-project-card__header">
        <span className="client-project-card__number">{project.number}</span>
        <Badge variant={STATUS_VARIANT[project.status] ?? 'default'}>
          {STATUS_LABEL[project.status] ?? project.status}
        </Badge>
      </div>
      <h3 className="client-project-card__name">{project.name}</h3>
      {(project.address || project.investment_address) && (
        <p className="client-project-card__address">
          📍 {project.investment_address || project.address}
        </p>
      )}
      <div className="client-project-card__dates">
        {project.start_date && (
          <span>Od: {project.start_date}</span>
        )}
        {project.end_date && (
          <span>Do: {project.end_date}</span>
        )}
      </div>
    </Link>
  )
}

export function ClientDashboardPage() {
  const { data: projects, isLoading, isError } = useClientProjects()

  if (isLoading) {
    return (
      <div className="client-page-loading">
        <span>Ładowanie projektów...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="client-page-error">
        <p>Nie udało się załadować projektów. Spróbuj odświeżyć stronę.</p>
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="client-page-empty">
        <div className="client-page-empty__icon">📁</div>
        <h2>Brak projektów</h2>
        <p>Nie masz jeszcze dostępu do żadnych projektów.<br />Skontaktuj się ze swoim wykonawcą.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="client-section-title">Twoje projekty</h2>
      <div className="client-project-list">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
