import { RouterProvider, createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router'
import { RootDocument, RootErrorFallback } from '@/app/routes/__root'
import { AuthLayout } from '@/app/routes/_auth'
import { PublicLayout } from '@/app/routes/_public'
import { AuthScreen } from '@/features/auth/components/AuthScreen'


const rootRoute = createRootRoute({ component: RootDocument, errorComponent: RootErrorFallback })

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: 'login', component: AuthScreen })
const authLayoutRoute = createRoute({ getParentRoute: () => rootRoute, id: '_auth', component: AuthLayout })
const publicLayoutRoute = createRoute({ getParentRoute: () => rootRoute, id: '_public', component: PublicLayout })

const landingRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: '/', component: lazyRouteComponent(() => import('@/app/routes/index'), 'LandingRoutePage') })
const portalRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'portal/$token', component: lazyRouteComponent(() => import('@/app/routes/portal/$token'), 'PortalTokenRoutePage') })
const joinRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'join/$token', component: lazyRouteComponent(() => import('@/app/routes/join.$token'), 'JoinInvitationRoutePage') })
const colorDemoRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'color-demo', component: lazyRouteComponent(() => import('@/app/routes/color-demo'), 'ColorDemoRoutePage') })
const authCallbackRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'auth/callback', component: lazyRouteComponent(() => import('@/app/routes/auth-callback'), 'AuthCallbackRoutePage') })
const legalIndexRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'legal', component: lazyRouteComponent(() => import('@/app/routes/legal'), 'LegalIndexRoutePage') })
const legalDocRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: 'legal/$doc', component: lazyRouteComponent(() => import('@/app/routes/legal'), 'LegalDocRoutePage') })

const dashboardRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'dashboard', component: lazyRouteComponent(() => import('@/app/routes/dashboard'), 'DashboardRoutePage') })
const clientsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'clients', component: lazyRouteComponent(() => import('@/app/routes/clients'), 'ClientsRoutePage') })
const estimatesRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'estimates',
  component: lazyRouteComponent(() => import('@/app/routes/estimates'), 'EstimatesRoutePage'),
  validateSearch: (search: Record<string, unknown>) => ({
    create: search.create === '1' || search.create === 'true' ? true : undefined,
  }),
})
const invoicesRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'invoices', component: lazyRouteComponent(() => import('@/app/routes/invoices'), 'InvoicesRoutePage') })
const contractsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'contracts', component: lazyRouteComponent(() => import('@/app/routes/contracts'), 'ContractsRoutePage') })
const projectsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'projects', component: lazyRouteComponent(() => import('@/app/routes/projects'), 'ProjectsRoutePage') })
const reportsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'reports', component: lazyRouteComponent(() => import('@/app/routes/reports'), 'ReportsRoutePage') })
const documentsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'documents', component: lazyRouteComponent(() => import('@/app/routes/documents'), 'DocumentsRoutePage') })
const ksefRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'ksef', component: lazyRouteComponent(() => import('@/app/routes/ksef'), 'KsefRoutePage') })
const settingsRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'settings', component: lazyRouteComponent(() => import('@/app/routes/settings'), 'SettingsRoutePage') })
const expensesRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'expenses',
  component: lazyRouteComponent(() => import('@/app/routes/expenses'), 'ExpensesRoutePage'),
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
  }),
})
const roomAnalysisRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'room-analysis',
  component: lazyRouteComponent(() => import('@/app/routes/room-analysis'), 'RoomAnalysisRoutePage'),
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
  }),
})
const projectAnalysisRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'project-analysis',
  component: lazyRouteComponent(() => import('@/app/routes/project-analysis'), 'ProjectAnalysisRoutePage'),
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
  }),
})
const aiRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'ai', component: lazyRouteComponent(() => import('@/app/routes/ai'), 'AiRoutePage') })
const chatRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: 'chat',
  component: lazyRouteComponent(() => import('@/app/routes/chat'), 'ChatRoutePage'),
  validateSearch: (search: Record<string, unknown>) => ({
    threadId: typeof search.threadId === 'string' ? search.threadId : undefined,
  }),
})
const billingRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'billing', component: lazyRouteComponent(() => import('@/app/routes/billing'), 'BillingRoutePage') })
const teamRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'team', component: lazyRouteComponent(() => import('@/app/routes/team'), 'TeamRoutePage') })
const onboardingRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'onboarding', component: lazyRouteComponent(() => import('@/app/routes/onboarding'), 'OnboardingRoutePage') })
const documentationRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'documentation', component: lazyRouteComponent(() => import('@/app/routes/documentation'), 'DocumentationRoutePage') })
const portalInboxRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'portal-inbox', component: lazyRouteComponent(() => import('@/app/routes/portal-inbox'), 'PortalInboxRoutePage') })
const notesRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'notes', component: lazyRouteComponent(() => import('@/app/routes/notes'), 'NotesRoutePage') })
const pdfDesignRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: 'pdf-design', component: lazyRouteComponent(() => import('@/app/routes/pdf-design'), 'PdfDesignRoute') })

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
    documentsRoute,
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
    roomAnalysisRoute,
    projectAnalysisRoute,
    aiRoute,
    notesRoute,
    pdfDesignRoute,
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
