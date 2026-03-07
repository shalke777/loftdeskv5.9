import { Link } from '@tanstack/react-router'
import { CheckCircle2, Circle, Rocket, ShieldCheck, Users, Wallet } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { demoDb } from '@/shared/lib/demoDb'
import { PLAN_DEFS } from '@/shared/lib/constants'

const stepLabels = {
  companyProfile: 'Uzupełnij profil firmy',
  nip: 'Dodaj NIP / dane do KSeF',
  team: 'Dodaj pierwszy zespół',
  firstClient: 'Dodaj pierwszego klienta',
  firstEstimate: 'Stwórz pierwszy kosztorys',
  firstInvoice: 'Wystaw pierwszą fakturę',
  projects: 'Załóż pierwszy projekt',
  contracts: 'Przygotuj pierwszą umowę',
  portal: 'Udostępnij portal klienta',
  ksef: 'Skonfiguruj token KSeF',
} as const

const quickLinks = [
  { to: '/settings', label: 'Profil firmy i KSeF', icon: ShieldCheck },
  { to: '/clients', label: 'Dodaj klienta', icon: Users },
  { to: '/estimates', label: 'Pierwszy kosztorys', icon: Rocket },
  { to: '/billing', label: 'Plan i limity', icon: Wallet },
] as const

export function OnboardingPage() {
  const { user } = useAuth()
  const summary = user ? demoDb.onboardingSummary(user.companyId) : null

  if (!summary) {
    return (
      <div>
        <PageHeader title="Onboarding" subtitle="Brak aktywnej firmy do skonfigurowania." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Onboarding firmy"
        subtitle="Domknięcie company-first setup: profil, role, billing, KSeF, portal i pierwsze workflow operacyjne."
      />
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div>
              <h3>{summary.companyName}</h3>
              <p>Postęp uruchomienia workspace’u</p>
            </div>
            <Badge variant={summary.progress >= 70 ? 'success' : summary.progress >= 40 ? 'warning' : 'default'}>{summary.progress}%</Badge>
          </div>
          <div style={{ background: 'var(--color-border-light)', borderRadius: 999, height: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${summary.progress}%`, height: '100%', background: 'var(--color-brand)' }} />
          </div>
          <p>Wykonano {summary.done} z {summary.total} kroków.</p>
          <p>Plan: {PLAN_DEFS[summary.plan].name}</p>
          <p>Rola właściciela: {summary.role}</p>
        </Card>
        <Card>
          <h3>Co dalej teraz</h3>
          <div className="actions-row" style={{ flexWrap: 'wrap' }}>
            {quickLinks.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.to} to={item.to}>
                  <Button variant="secondary" icon={<Icon size={16} />}>{item.label}</Button>
                </Link>
              )
            })}
          </div>
          <div className="actions-row" style={{ marginTop: 12 }}>
            <Link to="/portal/$token" params={{ token: 'demo-token' }}><Button>Otwórz portal demo</Button></Link>
            <Link to="/dashboard"><Button variant="ghost">Wróć do dashboardu</Button></Link>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <h3>Checklist produkcyjny</h3>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {Object.entries(stepLabels).map(([key, label]) => {
              const done = summary.checks[key as keyof typeof summary.checks]
              const Icon = done ? CheckCircle2 : Circle
              return (
                <div key={key} className="toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={18} color={done ? 'var(--color-success)' : 'var(--color-text-tertiary)'} />
                    <span>{label}</span>
                  </div>
                  <Badge variant={done ? 'success' : 'default'}>{done ? 'gotowe' : 'do zrobienia'}</Badge>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <h3>Stan danych startowych</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>Członkowie zespołu: {summary.counts.team}</li>
            <li>Klienci: {summary.counts.clients}</li>
            <li>Kosztorysy: {summary.counts.estimates}</li>
            <li>Faktury: {summary.counts.invoices}</li>
            <li>Projekty: {summary.counts.projects}</li>
            <li>Umowy: {summary.counts.contracts}</li>
          </ul>
          <p style={{ marginTop: 12 }}>Ta strona jest punktem wejścia do migracji v3 → v4.7: pokazuje, czy workspace jest gotowy na routing, role, billing, KSeF i publiczny portal.</p>
        </Card>
      </div>
    </div>
  )
}
