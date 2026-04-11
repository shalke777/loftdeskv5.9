import { useEffect, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { useDocNumberConfig, useUpdateDocNumberConfig, useResetDocCounter } from '@/features/settings/hooks/useSettings'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { DOC_NUMBER_DEFAULTS, type DocNumberConfig, type DocNumberTypeConfig } from '@/features/settings/api/settings.api'

const DOC_TYPES = [
  { key: 'estimate' as const, label: 'Kosztorysy' },
  { key: 'contract' as const, label: 'Umowy' },
  { key: 'invoice' as const, label: 'Faktury' },
]

const RESET_DOC_TYPE_OPTIONS = [
  { value: 'invoice',  label: 'Faktura (FV)' },
  { value: 'estimate', label: 'Kosztorys (WY)' },
  { value: 'contract', label: 'Umowa (UM)' },
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

function todayYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function DocNumberingCard() {
  const { data: saved, isLoading } = useDocNumberConfig()
  const update = useUpdateDocNumberConfig()
  const resetCounter = useResetDocCounter()
  const canEdit = useCan('settings.updateCompany')

  const [config, setConfig] = useState<DocNumberConfig>(DOC_NUMBER_DEFAULTS)

  // Reset section state
  const { year: currentYear, month: currentMonth } = todayYearMonth()
  const [resetDocType, setResetDocType] = useState('invoice')
  const [resetYear, setResetYear] = useState(currentYear)
  const [resetMonth, setResetMonth] = useState(currentMonth)
  const [resetValue, setResetValue] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)

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

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return }
    resetCounter.mutate({ docType: resetDocType, year: resetYear, month: resetMonth, value: resetValue })
    setConfirmReset(false)
  }

  const resetPreview = (() => {
    const prefix = RESET_DOC_TYPE_OPTIONS.find(o => o.value === resetDocType)?.label.match(/\((\w+)\)/)?.[1] ?? resetDocType.toUpperCase()
    const nextNum = resetValue + 1
    return `${prefix}/${resetYear}/${String(resetMonth).padStart(2, '0')}/${nextNum}`
  })()

  return (
    <Card>
      <h3>Numeracja dokumentów</h3>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, marginTop: 4, display: 'grid', gap: 4 }}>
        <div><strong style={{ color: 'var(--color-border)' }}>Przedrostek</strong> — stosowany natychmiastowo dla wszystkich nowych dokumentów.</div>
        <div><strong style={{ color: 'var(--color-border)' }}>Numer startowy</strong> — obowiązuje dopiero w nowej serii (pierwszy dokument nowego miesiąca lub nowej firmy). Nie zmienia trwającej serii.</div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {DOC_TYPES.map(({ key, label }) => (
          <div key={key}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-border)' }}>{label}</div>
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
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Następny dokument: <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{buildPrefixPreview(config[key])}</span>
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
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Nowa seria: <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{buildNewSeriesPreview(config[key])}</span>
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

      {/* ── Counter reset section ─────────────────────────────────────────── */}
      {canEdit && (
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Resetuj licznik miesiąca</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Użyj po usunięciu faktur testowych lub gdy licznik przeskoczył przez błąd.
            Następny numer będzie wynosił <strong>ustawiona wartość + 1</strong>.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <div className="field__label" style={{ marginBottom: 4 }}>Typ dokumentu</div>
              <select
                className="input"
                value={resetDocType}
                onChange={e => { setResetDocType(e.target.value); setConfirmReset(false) }}
              >
                {RESET_DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div className="field__label" style={{ marginBottom: 4 }}>Rok</div>
              <Input
                type="number"
                min={2020}
                max={2099}
                value={resetYear}
                onChange={e => { setResetYear(parseInt(e.target.value, 10) || currentYear); setConfirmReset(false) }}
              />
            </div>
            <div>
              <div className="field__label" style={{ marginBottom: 4 }}>Miesiąc</div>
              <Input
                type="number"
                min={1}
                max={12}
                value={resetMonth}
                onChange={e => { setResetMonth(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1))); setConfirmReset(false) }}
              />
            </div>
            <div>
              <div className="field__label" style={{ marginBottom: 4 }}>Ustaw na</div>
              <Input
                type="number"
                min={0}
                value={resetValue}
                onChange={e => { setResetValue(Math.max(0, parseInt(e.target.value, 10) || 0)); setConfirmReset(false) }}
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Następny numer: <span style={{ fontFamily: 'monospace', color: confirmReset ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{resetPreview}</span>
          </div>
          <div className="actions-row" style={{ marginTop: 10 }}>
            {confirmReset
              ? (
                <>
                  <Button
                    variant="danger"
                    loading={resetCounter.isPending}
                    onClick={handleReset}
                  >
                    Tak, resetuj licznik → {resetPreview}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmReset(false)}>Anuluj</Button>
                </>
              )
              : (
                <Button variant="secondary" onClick={handleReset}>
                  Resetuj licznik
                </Button>
              )
            }
          </div>
        </div>
      )}
    </Card>
  )
}
