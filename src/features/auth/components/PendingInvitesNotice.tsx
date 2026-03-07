import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { usePendingInvitationsByEmail, useAcceptInvitation } from '@/features/settings/hooks/useSettings'
import { setPendingInviteToken } from '@/shared/lib/inviteIntent'

export function PendingInvitesNotice({ email }: { email: string }) {
  const { data = [] } = usePendingInvitationsByEmail(email)
  const acceptInvitation = useAcceptInvitation()

  if (!email || data.length === 0) return null

  return (
    <Card style={{ marginTop: 16 }}>
      <h3>Masz oczekujące zaproszenia</h3>
      <p>Jeśli ten adres był już zaproszony do firmy, możesz od razu przyjąć rolę lub wejść przez dedykowany link dołączenia.</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {data.map((item: any) => (
          <div key={item.id} className="list-row">
            <div>
              <strong>{item.companies?.name || item.company_name || item.company_id}</strong>
              <div className="muted">rola: {item.role} · token: {item.token}</div>
            </div>
            <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="secondary" loading={acceptInvitation.isPending} onClick={() => acceptInvitation.mutate({ token: item.token, email })}>
                Przyjmij teraz
              </Button>
              <Button variant="ghost" onClick={() => { setPendingInviteToken(item.token); window.location.assign(`/join/${item.token}`) }}>
                Otwórz link
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
