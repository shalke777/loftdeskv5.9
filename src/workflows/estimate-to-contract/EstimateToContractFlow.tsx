import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import type { Estimate } from '@/entities/estimate/model'
import { useEstimateToContract } from '@/workflows/estimate-to-contract/useEstimateToContract'

export function EstimateToContractFlow({ estimate }: { estimate: Estimate }) {
  const mutation = useEstimateToContract()

  return (
    <Card>
      <h3>Workflow kosztorys → umowa</h3>
      <p>Po akceptacji kosztorysu możesz wygenerować szkic umowy w nowym module contracts.</p>
      <div className="actions-row">
        <Button
          disabled={estimate.status !== 'accepted'}
          loading={mutation.isPending}
          onClick={() => mutation.mutate(estimate.id)}
        >
          Generuj umowę z kosztorysu
        </Button>
      </div>
    </Card>
  )
}
