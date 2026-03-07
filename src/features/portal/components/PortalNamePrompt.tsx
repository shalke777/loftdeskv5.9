import { useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'

export function PortalNamePrompt({
  initialValue,
  onSave,
  loading = false,
}: {
  initialValue: string
  onSave: (value: string) => void
  loading?: boolean
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <Card>
      <h3>Podpis rozmowy</h3>
      <p>Możesz podać imię i nazwisko lub nazwę firmy, która odpowiada w portalu klienta.</p>
      <div className="actions-row">
        <div style={{ flex: 1 }}>
          <Input label="Imię / nazwa klienta" value={value} onChange={(e) => setValue(e.target.value)} placeholder="np. Jan Kowalski" />
        </div>
        <Button loading={loading} onClick={() => onSave(value)}>Zapisz</Button>
      </div>
    </Card>
  )
}
