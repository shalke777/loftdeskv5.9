import { Component, ReactNode } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { translateError } from '@/shared/lib/errorMessages'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorMessage?: string
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: translateError(error, 'Nieoczekiwany błąd aplikacji.') }
  }

  componentDidCatch(error: Error) {
    console.error('LoftDesk boundary captured error', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-shell">
          <Card className="auth-card">
            <h1 style={{ fontSize: 28, marginBottom: 8 }}>Coś poszło nie tak</h1>
            <p style={{ marginBottom: 16 }}>Aplikacja złapała błąd i zatrzymała ekran zanim rozsypał się cały workspace.</p>
            {this.state.errorMessage ? <p className="field__label">{this.state.errorMessage}</p> : null}
            <div className="actions-row">
              <Button onClick={() => window.location.assign('/dashboard')}>Wróć do dashboardu</Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>Odśwież aplikację</Button>
            </div>
          </Card>
        </main>
      )
    }

    return this.props.children
  }
}
