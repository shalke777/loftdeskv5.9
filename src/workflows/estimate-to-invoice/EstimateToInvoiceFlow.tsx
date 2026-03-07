import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import type { Estimate } from '@/entities/estimate/model'
import { useEstimateToInvoice } from '@/workflows/estimate-to-invoice/useEstimateToInvoice'

export function EstimateToInvoiceFlow({ estimate }: { estimate: Estimate }) {
  const mutation = useEstimateToInvoice()

  return (
    <Card>
      <h3>Workflow kosztorys → faktura</h3>
      <p>Po akceptacji kosztorysu możesz od razu zbudować roboczą fakturę z tymi samymi pozycjami.</p>
      <div className="actions-row">
        <Button disabled={estimate.status !== 'accepted'} loading={mutation.isPending} onClick={() => mutation.mutate(estimate.id)}>
          Generuj fakturę z kosztorysu
        </Button>
      </div>
    </Card>
  )
}
