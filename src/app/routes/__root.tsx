import { Outlet, useRouter } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'

export function RootDocument() {
  return <Outlet />
}

export function RootErrorFallback({ error }: { error: unknown }) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : 'Nieoczekiwany błąd nawigacji.'
  console.error('[router] route error caught:', error)

  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Coś poszło nie tak</h1>
        <p style={{ marginBottom: 16 }}>Błąd podczas ładowania strony. Spróbuj wrócić lub odświeżyć.</p>
        <p className="field__label">{message}</p>
        <div className="actions-row">
          <Button onClick={() => router.navigate({ to: '/dashboard' })}>Wróć do dashboardu</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>Odśwież aplikację</Button>
        </div>
      </Card>
    </main>
  )
}
