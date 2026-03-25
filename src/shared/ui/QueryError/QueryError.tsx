import { AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'

interface QueryErrorProps {
  message?: string
  onRetry?: () => void
}

export function QueryError({
  message = 'Nie udało się załadować danych.',
  onRetry,
}: QueryErrorProps) {
  return (
    <div className="empty-state" style={{ padding: '48px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <AlertTriangle size={36} strokeWidth={1.25} color="var(--color-danger, #e53e3e)" />
      </div>
      <h3>{message}</h3>
      <p>Sprawdź połączenie z internetem lub spróbuj ponownie.</p>
      {onRetry && (
        <div style={{ marginTop: 14 }}>
          <Button variant="secondary" onClick={onRetry}>Spróbuj ponownie</Button>
        </div>
      )}
    </div>
  )
}
