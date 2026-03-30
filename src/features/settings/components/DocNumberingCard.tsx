import { useEffect, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { useDocNumberConfig, useUpdateDocNumberConfig } from '@/features/settings/hooks/useSettings'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { DOC_NUMBER_DEFAULTS, type DocNumberConfig, type DocNumberTypeConfig } from '@/features/settings/api/settings.api'

const DOC_TYPES = [
  { key: 'estimate' as const, label: 'Kosztorysy' },
  { key: 'contract' as const, label: 'Umowy' },
  { key: 'invoice' as const, label: 'Faktury' },
]

function buildPreview(cfg: DocNumberTypeConfig): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = (cfg.prefix || '??').toUpperCase().trim()
  const seq = cfg.start_seq ?? 1
  return `${prefix}/${year}/${month}/${seq}`
}

export function DocNumberingCard() {
  const { data: saved, isLoading } = useDocNumberConfig()
  const update = useUpdateDocNumberConfig()
  const canEdit = useCan('settings.updateCompany')

  const [config, setConfig] = useState<DocNumberConfig>(DOC_NUMBER_DEFAULTS)

  useEffect(() => {
    if (saved) {
      setConfig({
        estimate: { ...DOC_NUMBER_DEFAULTS.estimate, ...saved.estimate },
        contract:  { ...DOC_NUMBER_DEFAULTS.contract,  ...saved.contract  },
        invoice:   { ...DOC_NUMBER_DEFAULTS.invoice,   ...saved.invoice   },
      })
    } else if (!isLoading) {
      setConfig(DOC_NUMBER_DEFAULTS)
    }
  }, [saved, isLoading])

  function setField(type: keyof DocNumberConfig, field: keyof DocNumberTypeConfig, raw: string) {
    setConfig(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: field === 'start_seq' ? Math.max(1, parseInt(raw, 10) || 1) : raw.slice(0, 8).toUpperCase(),
      },
    }))
  }

  function handleSave() {
    update.mutate(config)
  }

  return (
    <Card>
      <h3>Numeracja dokumentów</h3>
      <p style={{ fontSize: 13, color: '#A7ABB3', marginBottom: 16, marginTop: 4 }}>
        Ustaw własny przedrostek i numer startowy dla każdego typu dokumentu. Zmiany dotyczą nowych serii (nowy miesiąc lub nowa firma) — aktualnie trwająca seria nie jest przerywana.
      </p>

      <div style={{ display: 'grid', gap: 16 }}>
        {DOC_TYPES.map(({ key, label }) => (
          <div key={key}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#E0E2E8' }}>{label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <div className="field__label" style={{ marginBottom: 4 }}>Przedrostek</div>
                <Input
                  value={config[key].prefix}
                  onChange={e => setField(key, 'prefix', e.target.value)}
                  placeholder="np. WY"
                  disabled={!canEdit}
                  maxLength={8}
                />
              </div>
              <div>
                <div className="field__label" style={{ marginBottom: 4 }}>Numer startowy nowej serii</div>
                <Input
                  type="number"
                  min={1}
                  value={config[key].start_seq}
                  onChange={e => setField(key, 'start_seq', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div style={{ paddingBottom: 1 }}>
                <div className="field__label" style={{ marginBottom: 4 }}>Podgląd</div>
                <div style={{ fontSize: 13, fontFamily: 'monospace', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, color: '#A7ABB3', whiteSpace: 'nowrap' }}>
                  {buildPreview(config[key])}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="actions-row" style={{ marginTop: 20 }}>
          <Button onClick={handleSave} loading={update.isPending}>Zapisz numerację</Button>
        </div>
      )}
    </Card>
  )
}
