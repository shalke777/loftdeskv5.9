import { RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { RootDocument } from '@/app/routes/__root'
import { AuthLayout } from '@/app/routes/_auth'
import { PublicLayout } from '@/app/routes/_public'
import { AuthScreen } from '@/features/auth/components/AuthScreen'
import { LandingRoutePage } from '@/app/routes/index'
import { DashboardRoutePage } from '@/app/routes/dashboard'
import { ClientsRoutePage } from '@/app/routes/clients'
import { EstimatesRoutePage } from '@/app/routes/estimates'
import { InvoicesRoutePage } from '@/app/routes/invoices'
import { ContractsRoutePage } from '@/app/routes/contracts'
import { ProjectsRoutePage } from '@/app/routes/projects'
import { ReportsRoutePage } from '@/app/routes/reports'
import { KsefRoutePage } from '@/app/routes/ksef'
import { SettingsRoutePage } from '@/app/routes/settings'
import { TeamRoutePage } from '@/app/routes/team'
import { BillingRoutePage } from '@/app/routes/billing'
import { OnboardingRoutePage } from '@/app/routes/onboarding'
import { PortalTokenRoutePage } from '@/app/routes/portal/$token'
import { JoinInvitationRoutePage } from '@/app/routes/join.$token'
import { DocumentationRoutePage } from '@/app/routes/documentation'

const rootRoute = createRootRoute({ component: RootDocument })

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: 'login', component: AuthScreen })
const authLayoutRoute = createRoute({ getParentRoute: () => rootRoute, id: '_auth', component: AuthLayout })
const publicLayoutRoute = createRoute({ getParentRoute: () => rootRoute, id: '_public', component: PublicLayout })

const landingRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: '/', component: LandingRoutePage })
const portalRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'portal/$token', component: PortalTokenRoutePage })
const joinRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'join/$token', component: JoinInvitationRoutePage })

const dashboardRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'dashboard', component: DashboardRoutePage })
const clientsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'clients', component: ClientsRoutePage })
const estimatesRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'estimates', component: EstimatesRoutePage })
const invoicesRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'invoices', component: InvoicesRoutePage })
const contractsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'contracts', component: ContractsRoutePage })
const projectsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'projects', component: ProjectsRoutePage })
const reportsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'reports', component: ReportsRoutePage })
const ksefRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'ksef', component: KsefRoutePage })
const settingsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'settings', component: SettingsRoutePage })
const billingRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'billing', component: BillingRoutePage })
const teamRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'team', component: TeamRoutePage })
const onboardingRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'onboarding', component: OnboardingRoutePage })
const documentationRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'documentation', component: DocumentationRoutePage })

const routeTree = rootRoute.addChildren([
  loginRoute,
  publicLayoutRoute.addChildren([landingRoute, portalRoute, joinRoute]),
  authLayoutRoute.addChildren([
    dashboardRoute,
    clientsRoute,
    estimatesRoute,
    invoicesRoute,
    contractsRoute,
    projectsRoute,
    reportsRoute,
    ksefRoute,
    billingRoute,
    teamRoute,
    onboardingRoute,
    settingsRoute,
    documentationRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />
}
