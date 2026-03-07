import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'

export function AccessNotice({
  title = 'Brak dostępu',
  description = 'Twoja rola lub plan nie pozwalają wejść do tego modułu.',
  actionLabel,
  onAction,
}: {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <Card>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <div className="actions-row" style={{ marginTop: 12 }}>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </Card>
  )
}
