import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary/AppErrorBoundary'

export function App() {
  return (
    <AppProviders>
      <AppErrorBoundary>
        <AppRouter />
      </AppErrorBoundary>
    </AppProviders>
  )
}
