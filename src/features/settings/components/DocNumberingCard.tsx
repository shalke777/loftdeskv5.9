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

function buildPrefixPreview(cfg: DocNumberTypeConfig): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = (cfg.prefix || '??').toUpperCase().trim()
  // Shows what the prefix will look like on the NEXT document — counter unknown intentionally
  return `${prefix}/${year}/${month}/…`
}

function buildNewSeriesPreview(cfg: DocNumberTypeConfig): string {
  // Next calendar month — the earliest a new start_seq can take effect for an existing company
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonth.getFullYear()
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0')
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
      <div style={{ fontSize: 13, color: '#6E6A60', marginBottom: 16, marginTop: 4, display: 'grid', gap: 4 }}>
        <div><strong style={{ color: '#C9CCD4' }}>Przedrostek</strong> — stosowany natychmiastowo dla wszystkich nowych dokumentów.</div>
        <div><strong style={{ color: '#C9CCD4' }}>Numer startowy</strong> — obowiązuje dopiero w nowej serii (pierwszy dokument nowego miesiąca lub nowej firmy). Nie zmienia trwającej serii.</div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {DOC_TYPES.map(({ key, label }) => (
          <div key={key}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#E0E2E8' }}>{label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'flex-start' }}>
              <div>
                <div className="field__label" style={{ marginBottom: 4 }}>Przedrostek</div>
                <Input
                  value={config[key].prefix}
                  onChange={e => setField(key, 'prefix', e.target.value)}
                  placeholder="np. WY"
                  disabled={!canEdit}
                  maxLength={8}
                />
                <div style={{ fontSize: 11, color: '#6A6F7A', marginTop: 4 }}>
                  Następny dokument: <span style={{ fontFamily: 'monospace', color: '#6E6A60' }}>{buildPrefixPreview(config[key])}</span>
                </div>
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
                <div style={{ fontSize: 11, color: '#6A6F7A', marginTop: 4 }}>
                  Nowa seria: <span style={{ fontFamily: 'monospace', color: '#6E6A60' }}>{buildNewSeriesPreview(config[key])}</span>
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
