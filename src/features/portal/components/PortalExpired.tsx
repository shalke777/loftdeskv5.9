import { Card } from '@/shared/ui/Card/Card'

export function PortalExpired() {
  return (
    <div className="portal-page">
      <Card>
        <h3>Link portalu wygasł</h3>
        <p>Skontaktuj się z wykonawcą, aby wygenerował nowy link do kosztorysu lub ponownie udostępnił portal klienta.</p>
      </Card>
    </div>
  )
}
