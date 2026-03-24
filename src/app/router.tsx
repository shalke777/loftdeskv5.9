import { RouterProvider, createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router'
import { RootDocument, RootErrorFallback } from '@/app/routes/__root'
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
import { KsefRoutePage } from '@/app/routes/ksef'
import { SettingsRoutePage } from '@/app/routes/settings'
import { PortalTokenRoutePage } from '@/app/routes/portal/$token'
import { JoinInvitationRoutePage } from '@/app/routes/join.$token'
import { ChatRoutePage } from '@/app/routes/chat'
import { ExpensesRoutePage } from '@/app/routes/expenses'
import { ClientDashboardRoutePage } from '@/app/routes/client/dashboard'
import { ClientProjectRoutePage } from '@/app/routes/client/project.$id'
import { ClientProfileRoutePage } from '@/app/routes/client/profile'

const rootRoute = createRootRoute({ component: RootDocument, errorComponent: RootErrorFallback })

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: 'login', component: AuthScreen })
const authLayoutRoute = createRoute({ getParentRoute: () => rootRoute, id: '_auth', component: AuthLayout })
const publicLayoutRoute = createRoute({ getParentRoute: () => rootRoute, id: '_public', component: PublicLayout })

const landingRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: '/', component: LandingRoutePage })
const portalRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'portal/$token', component: lazyRouteComponent(() => import('@/app/routes/portal/$token'), 'PortalTokenRoutePage') })
const joinRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'join/$token', component: lazyRouteComponent(() => import('@/app/routes/join.$token'), 'JoinInvitationRoutePage') })
const colorDemoRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'color-demo', component: lazyRouteComponent(() => import('@/app/routes/color-demo'), 'ColorDemoRoutePage') })
const authCallbackRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'auth/callback', component: lazyRouteComponent(() => import('@/app/routes/auth-callback'), 'AuthCallbackRoutePage') })
const legalIndexRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'legal', component: lazyRouteComponent(() => import('@/app/routes/legal'), 'LegalIndexRoutePage') })
const legalDocRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'legal/$doc', component: lazyRouteComponent(() => import('@/app/routes/legal'), 'LegalDocRoutePage') })

const dashboardRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'dashboard', component: DashboardRoutePage })
const clientsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'clients', component: ClientsRoutePage })
const estimatesRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'estimates', component: EstimatesRoutePage })
const invoicesRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'invoices', component: InvoicesRoutePage })
const contractsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'contracts', component: ContractsRoutePage })
const projectsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'projects', component: ProjectsRoutePage })
const reportsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'reports', component: lazyRouteComponent(() => import('@/app/routes/reports'), 'ReportsRoutePage') })
const ksefRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'ksef', component: KsefRoutePage })
const settingsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'settings', component: SettingsRoutePage })
const billingRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'billing', component: lazyRouteComponent(() => import('@/app/routes/billing'), 'BillingRoutePage') })
const teamRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'team', component: lazyRouteComponent(() => import('@/app/routes/team'), 'TeamRoutePage') })
const onboardingRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'onboarding', component: lazyRouteComponent(() => import('@/app/routes/onboarding'), 'OnboardingRoutePage') })
const documentationRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'documentation', component: lazyRouteComponent(() => import('@/app/routes/documentation'), 'DocumentationRoutePage') })
const portalInboxRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'portal-inbox', component: lazyRouteComponent(() => import('@/app/routes/portal-inbox'), 'PortalInboxRoutePage') })
const chatRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'chat',
  component: ChatRoutePage,
  validateSearch: (search: Record<string, unknown>) => ({
    threadId: typeof search.threadId === 'string' ? search.threadId : undefined,
  }),
})
const expensesRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'expenses', component: ExpensesRoutePage })

const clientDashboardRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'client/dashboard', component: lazyRouteComponent(() => import('@/app/routes/client/dashboard'), 'ClientDashboardRoutePage') })
const clientProjectRoute   = createRoute({ getParentRoute: () => authLayoutRoute, path: 'client/project/$id', component: lazyRouteComponent(() => import('@/app/routes/client/project.$id'), 'ClientProjectRoutePage') })
const clientProfileRoute   = createRoute({ getParentRoute: () => authLayoutRoute, path: 'client/profile', component: lazyRouteComponent(() => import('@/app/routes/client/profile'), 'ClientProfileRoutePage') })

const routeTree = rootRoute.addChildren([
  loginRoute,
  publicLayoutRoute.addChildren([landingRoute, portalRoute, joinRoute, colorDemoRoute, authCallbackRoute, legalIndexRoute, legalDocRoute]),
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
    portalInboxRoute,
    chatRoute,
    expensesRoute,
    clientDashboardRoute,
    clientProjectRoute,
    clientProfileRoute,
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
