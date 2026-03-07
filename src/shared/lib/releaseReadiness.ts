import type { BillingSummary } from '@/features/billing/api/billing.api'

export interface WorkspaceReadinessInput {
  companyName: string
  plan: 'free' | 'pro' | 'business' | 'admin'
  ksefReady: boolean
  membersCount: number
  pendingInvitations: number
  portalLinks: number
  estimatesCount: number
  invoicesCount: number
  projectsCount: number
}

export interface ReadinessCheck {
  id: string
  label: string
  status: 'done' | 'warning' | 'blocked'
  hint: string
}

export function buildWorkspaceReadiness(input: WorkspaceReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [
    {
      id: 'plan',
      label: 'Plan gotowy do operacyjnej pracy',
      status: input.plan === 'free' ? 'warning' : 'done',
      hint: input.plan === 'free' ? 'Plan Free działa, ale blokuje część automatyzacji i portal.' : `Plan ${input.plan.toUpperCase()} odblokowuje funkcje operacyjne.`,
    },
    {
      id: 'ksef',
      label: 'Konfiguracja KSeF',
      status: input.ksefReady ? 'done' : input.plan === 'free' ? 'blocked' : 'warning',
      hint: input.ksefReady ? 'Token i środowisko są ustawione.' : 'Uzupełnij NIP i token KSeF w ustawieniach firmy.',
    },
    {
      id: 'team',
      label: 'Zespół / role',
      status: input.membersCount > 1 ? 'done' : ['business', 'admin'].includes(input.plan) ? 'warning' : 'blocked',
      hint: input.membersCount > 1 ? 'Masz więcej niż jednego członka workspace.' : 'Dodaj członków lub wyślij zaproszenia, jeśli chcesz pracować zespołowo.',
    },
    {
      id: 'portal',
      label: 'Portal klienta',
      status: input.portalLinks > 0 ? 'done' : input.plan === 'free' ? 'blocked' : 'warning',
      hint: input.portalLinks > 0 ? 'Wygenerowano już aktywne linki portalu.' : 'Wygeneruj portal z zaakceptowanego lub wysłanego kosztorysu.',
    },
    {
      id: 'flow',
      label: 'Ciągłość dokumentów',
      status: input.estimatesCount > 0 && input.invoicesCount > 0 ? 'done' : 'warning',
      hint: input.estimatesCount > 0 && input.invoicesCount > 0 ? 'Masz już realny przepływ kosztorys → faktura.' : 'Zamień pierwszy kosztorys na fakturę lub umowę, aby sprawdzić flow.',
    },
    {
      id: 'projects',
      label: 'Obsługa realizacji',
      status: input.projectsCount > 0 ? 'done' : 'warning',
      hint: input.projectsCount > 0 ? 'Projekty są już prowadzone w workspace.' : 'Utwórz projekt, żeby zweryfikować harmonogram i budżet.',
    },
  ]
  return checks
}

export function buildBillingReadiness(summary: BillingSummary, options: { membersCount: number; pendingInvitations: number; portalLinks: number }) {
  return buildWorkspaceReadiness({
    companyName: summary.companyName,
    plan: summary.currentPlan,
    ksefReady: summary.ksefReady,
    membersCount: options.membersCount,
    pendingInvitations: options.pendingInvitations,
    portalLinks: options.portalLinks,
    estimatesCount: summary.usage.estimates,
    invoicesCount: summary.usage.invoices,
    projectsCount: summary.usage.projects,
  })
}
