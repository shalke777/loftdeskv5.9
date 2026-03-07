import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { formatCurrency } from '@/shared/lib/formatters'
import { demoDb } from '@/shared/lib/demoDb'
import { useCompanyId } from '@/features/auth/hooks/useAuth'

export function ReportsPage() {
  const { data } = useDashboardStats()
  const companyId = useCompanyId()
  if (!data) return null
  const estimates = demoDb.estimates.list(companyId)
  const invoices = demoDb.invoices.list(companyId)
  const projects = demoDb.projects.list(companyId)
  const acceptedValue = estimates.filter((item) => item.status === 'accepted').reduce((sum, item) => sum + item.total_gross, 0)
  const unpaidValue = invoices.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.total_gross, 0)
  const completionRate = projects.length ? Math.round((projects.filter((item) => item.status === 'done').length / projects.length) * 100) : 0

  return (
    <div>
      <PageHeader title="Raporty" subtitle="Szybki obraz sprzedaży, kosztów, marży, pipeline i realizacji." />
      <div className="grid-4">
        <Card><h3>Pipeline</h3><p>{formatCurrency(data.pipeline)}</p></Card>
        <Card><h3>Przychód opłacony</h3><p>{formatCurrency(data.paidRevenue)}</p></Card>
        <Card><h3>Zaakceptowane oferty</h3><p>{formatCurrency(acceptedValue)}</p></Card>
        <Card><h3>Do odzyskania</h3><p>{formatCurrency(unpaidValue)}</p></Card>
      </div>
      <div className="grid-4" style={{ marginTop: 16 }}>
        <Card><h3>Skuteczność realizacji</h3><p>{completionRate}% projektów zamkniętych</p></Card>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <Card><h3>Źródła przychodu</h3><ul>{invoices.map((invoice) => <li key={invoice.id}>{invoice.number} · {invoice.status} · {formatCurrency(invoice.total_gross)}</li>)}</ul></Card>
        <Card><h3>Projekty</h3><ul>{projects.map((project) => <li key={project.id}>{project.number} · {project.name} · {project.status}</li>)}</ul></Card>
      </div>
    </div>
  )
}
