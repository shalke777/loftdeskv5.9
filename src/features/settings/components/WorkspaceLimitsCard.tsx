
import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { demoDb } from '@/shared/lib/demoDb'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function WorkspaceLimitsCard() {
  const { user } = useAuth()
  if (!user) return null

  const company = demoDb.companies().find((item) => item.company_id === user.companyId)
  const plan = PLAN_DEFS[user.plan]

  return (
    <Card>
      <h3>Limity i usage</h3>
      <p className="muted">Szybki podgląd, czy workspace jest już gotowy do pełnego przejścia na staging.</p>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        <div className="list-row">
          <div>
            <strong>Plan</strong>
            <div className="muted">{plan.name}</div>
          </div>
          <Badge variant={user.plan === 'free' ? 'warning' : 'success'}>{plan.price === 0 ? '0 zł' : `${plan.price} zł`}</Badge>
        </div>
        <div className="list-row"><span>Klienci</span><strong>{company?.clients ?? 0}</strong></div>
        <div className="list-row"><span>Kosztorysy</span><strong>{company?.estimates ?? 0}</strong></div>
        <div className="list-row"><span>Faktury</span><strong>{company?.invoices ?? 0}</strong></div>
        <div className="list-row"><span>Projekty</span><strong>{company?.projects ?? 0}</strong></div>
      </div>
      <ul style={{ marginTop: 12 }}>
        {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
    </Card>
  )
}
