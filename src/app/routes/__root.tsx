import { Outlet, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { captureError } from '@/shared/lib/monitoring'

export function RootDocument() {
  return <Outlet />
}

export function RootErrorFallback({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : 'Nieoczekiwany błąd nawigacji.'
  captureError(error, { area: 'ui', extra: { source: 'RootErrorFallback', route: window.location.pathname } })

  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Coś poszło nie tak</h1>
        <p style={{ marginBottom: 16 }}>Błąd podczas ładowania strony. Spróbuj wrócić lub odświeżyć.</p>
        <p className="field__label">{message}</p>
        <div className="actions-row">
          <Button onClick={() => reset()}>Spróbuj ponownie</Button>
          <Button variant="secondary" onClick={() => router.navigate({ to: '/dashboard' })}>Wróć do dashboardu</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>Odśwież aplikację</Button>
        </div>
      </Card>
    </main>
  )
}
