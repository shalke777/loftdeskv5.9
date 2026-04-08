
import { Fragment, type CSSProperties, useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Select } from '@/shared/ui/Select/Select'
import { generateId } from '@/shared/lib/generateId'
import { calcItemGross } from '@/features/estimates/lib/estimate.calculations'
import type { EstimateItem } from '@/entities/estimate/model'
import { ServiceCatalogPicker } from './ServiceCatalogPicker'
import { useServiceCatalog } from '@/features/service-catalog/hooks/useServiceCatalog'
import { useCompanyPriceList, useUpsertPrice } from '@/features/service-catalog/hooks/useCompanyPriceList'

const DEFAULT_UNIT = 'm²'
const DEFAULT_VAT = 8
const VAT_OPTIONS = [
  { value: '23', label: '23%' },
  { value: '8', label: '8%' },
  { value: '5', label: '5%' },
  { value: '0', label: '0%' },
]
const baseInput: CSSProperties = {
  height: 34, fontSize: 13, padding: '4px 8px', background: 'var(--color-surface)',
  border: '1px solid var(--color-border)', borderRadius: 6, outline: 'none',
  width: '100%', boxSizing: 'border-box',
}


export function ItemsEditor({ items, onChange }: { items: EstimateItem[]; onChange: (items: EstimateItem[]) => void }) {
  const [fastName, setFastName] = useState('')
  const [fastDescription, setFastDescription] = useState('')
  const [fastUnit, setFastUnit] = useState(DEFAULT_UNIT)
  const [fastQty, setFastQty] = useState(1)
  const [fastNet, setFastNet] = useState('')
  const [fastVat, setFastVat] = useState(DEFAULT_VAT)
  const [fastCatalogItemId, setFastCatalogItemId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<EstimateItem>>({})
  const [catalogOpen, setCatalogOpen] = useState(false)

  // Autocomplete
  const [acOpen, setAcOpen] = useState(false)
  const acRef = useRef<HTMLDivElement>(null)

  const { data: catalog = [] } = useServiceCatalog()
  const { data: priceMap } = useCompanyPriceList()
  const upsertPrice = useUpsertPrice()

  const suggestions = useMemo(() => {
    const q = fastName.toLowerCase().trim()
    if (!q || q.length < 2) return []
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [catalog, fastName])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (acRef.current && !acRef.current.contains(e.target as Node)) setAcOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function selectSuggestion(item: typeof catalog[number]) {
    const storedPrice = priceMap?.get(item.id)
    setFastName(item.name)
    setFastUnit(item.unit === 'm2' ? 'm²' : item.unit)
    if (storedPrice && storedPrice > 0) setFastNet(String(storedPrice))
    setFastCatalogItemId(item.id)
    setAcOpen(false)
    setTimeout(() => {
      const el = document.getElementById('fast-add-price')
      if (el) (el as HTMLInputElement).focus()
    }, 50)
  }

  function startEdit(item: EstimateItem) {
    setEditId(item.id)
    setEditValues({ ...item })
  }
  function cancelEdit() {
    setEditId(null)
    setEditValues({})
  }
  function saveEdit() {
    if (!editId) return;
    onChange(items.map((item) => item.id === editId ? { ...item, ...editValues } as EstimateItem : item))
    setEditId(null)
    setEditValues({})
  }

  function patch(id: string, key: keyof EstimateItem, value: string) {
    onChange(items.map((item) => item.id === id ? { ...item, [key]: ['quantity','unit_price','vat_rate','sort_order'].includes(String(key)) ? Number(value) : value } : item))
  }
  function patchDescription(id: string, value: string) {
    onChange(items.map((item) => item.id === id ? { ...item, description: value } : item))
  }
  function addRow() {
    onChange([...items, { id: generateId(), name: 'Nowa pozycja', description: '', unit: DEFAULT_UNIT, quantity: 1, unit_price: 0, vat_rate: DEFAULT_VAT, sort_order: items.length + 1 }])
  }
  function removeRow(id: string) { onChange(items.filter((item) => item.id !== id).map((item, index) => ({ ...item, sort_order: index + 1 }))) }

  function fastAdd() {
    if (!fastName.trim()) return
    const net = parseFloat(fastNet) || 0
    onChange([
      ...items,
      {
        id: generateId(),
        name: fastName.trim(),
        description: fastDescription,
        unit: fastUnit,
        quantity: fastQty,
        unit_price: net,
        vat_rate: fastVat,
        sort_order: items.length + 1,
        catalog_item_id: fastCatalogItemId ?? undefined,
      },
    ])
    // Auto-save price to company price list
    if (fastCatalogItemId && net > 0) {
      upsertPrice.mutate({ catalogItemId: fastCatalogItemId, unitPrice: net })
    }
    setFastName('')
    setFastDescription('')
    setFastUnit(DEFAULT_UNIT)
    setFastQty(1)
    setFastNet('')
    setFastVat(DEFAULT_VAT)
    setFastCatalogItemId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Fast-add form ── */}
      <div style={{ background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand)', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Dodaj pozycję
        </div>
        {/* Row 1: Nazwa + Cena netto + j.m. + Ilość + VAT + Dodaj */}
        <div className="items-fast-add-row" style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px 60px 64px auto', gap: 8, alignItems: 'flex-end' }}>
          <div ref={acRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-primary)', marginBottom: 3, fontWeight: 500 }}>
              Nazwa <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              className="input"
              placeholder="np. Montaż drzwi"
              value={fastName}
              onChange={e => { setFastName(e.target.value); setFastCatalogItemId(null); setAcOpen(true) }}
              style={{ ...baseInput, fontWeight: 600 }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAcOpen(false); fastAdd() } if (e.key === 'Escape') setAcOpen(false) }}
              onFocus={() => { if (fastName.length >= 2) setAcOpen(true) }}
              autoComplete="off"
            />
            {acOpen && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--color-card)', border: '1px solid var(--color-border)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                marginTop: 2, maxHeight: 280, overflowY: 'auto',
              }}>
                {suggestions.map((item) => {
                  const storedPrice = priceMap?.get(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(item) }}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none', background: 'none',
                        padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        gap: 8, borderBottom: '1px solid var(--color-border)',
                        fontSize: 13, color: 'var(--color-text-primary)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <span style={{ flex: 1 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', background: 'var(--color-surface-soft)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                        {item.unit === 'm2' ? 'm²' : item.unit}
                      </span>
                      {storedPrice && storedPrice > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', background: 'var(--color-success-soft)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                          {storedPrice.toFixed(2)} zł
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-primary)', marginBottom: 3, fontWeight: 500 }}>
              Cena netto
            </label>
            <input
              id="fast-add-price"
              type="number"
              min={0}
              step="any"
              placeholder="0.00 zł"
              value={fastNet}
              onChange={e => setFastNet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fastAdd()}
              style={{ ...baseInput, textAlign: 'right' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-primary)', marginBottom: 3, fontWeight: 500 }}>j.m.</label>
            <input
              className="input"
              placeholder="m²"
              value={fastUnit}
              onChange={e => setFastUnit(e.target.value)}
              style={{ ...baseInput, textAlign: 'center' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-primary)', marginBottom: 3, fontWeight: 500 }}>Ilość</label>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={String(fastQty)}
              onChange={e => setFastQty(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && fastAdd()}
              style={{ ...baseInput, textAlign: 'right' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-primary)', marginBottom: 3, fontWeight: 500 }}>VAT</label>
            <select
              className="input"
              value={String(fastVat)}
              onChange={e => setFastVat(Number(e.target.value))}
              style={baseInput}
            >
              {VAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'transparent', marginBottom: 3 }}>–</label>
            <button
              className="btn btn--sm btn--primary"
              onClick={fastAdd}
              disabled={!fastName.trim()}
              style={{ height: 34, padding: '0 16px', whiteSpace: 'nowrap' }}
            >
              + Dodaj
            </button>
          </div>
        </div>
        {/* Row 2: Opis (optional, collapsed) */}
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3, fontWeight: 500 }}>Opis / uwagi (opcjonalnie)</label>
          <textarea
            className="input"
            placeholder="Szczegóły, materiał, robocizna..."
            value={fastDescription}
            onChange={e => setFastDescription(e.target.value)}
            style={{ width: '100%', fontSize: 12, padding: '6px 8px', resize: 'vertical', minHeight: 36, border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* ── Items table ── */}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-soft)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: 11, width: 30 }}>#</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11 }}>Nazwa</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, width: 52 }}>j.m.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, width: 58 }}>Ilość</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, width: 90 }}>Netto j.m.</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, width: 52 }}>VAT</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, width: 90 }}>Brutto</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                editId === item.id ? (
                  <Fragment key={item.id}>
                    <tr style={{ background: 'var(--color-warning-soft)', borderBottom: '1px solid var(--color-warning)' }}>
                      <td style={{ padding: '7px 10px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>{item.sort_order}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <input className="input" value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} style={{ width: '100%', height: 28, fontSize: 13, padding: '3px 7px', border: '1px solid var(--color-border)', borderRadius: 5 }} />
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <input className="input" value={editValues.unit ?? ''} onChange={e => setEditValues(v => ({ ...v, unit: e.target.value }))} style={{ width: 44, height: 28, fontSize: 13, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 5, textAlign: 'center' }} />
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <input className="input" type="number" value={String(editValues.quantity ?? '')} onChange={e => setEditValues(v => ({ ...v, quantity: Number(e.target.value) }))} style={{ width: 52, height: 28, fontSize: 13, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 5, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <input className="input" type="number" value={String(editValues.unit_price ?? '')} onChange={e => setEditValues(v => ({ ...v, unit_price: Number(e.target.value) }))} style={{ width: 80, height: 28, fontSize: 13, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 5, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <Select
                          value={String(editValues.vat_rate ?? '')}
                          onChange={e => setEditValues(v => ({ ...v, vat_rate: Number(e.target.value) }))}
                          options={VAT_OPTIONS}
                          style={{ width: 60, height: 28, fontSize: 12, padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 5 }}
                        />
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</td>
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn--sm btn--primary" onClick={saveEdit} style={{ height: 26, padding: '0 10px', fontSize: 12 }}>Zapisz</button>
                          <button className="btn btn--sm btn--ghost" onClick={cancelEdit} style={{ height: 26, padding: '0 8px', fontSize: 12 }}>Anuluj</button>
                        </div>
                      </td>
                    </tr>
                    <tr style={{ background: 'var(--color-warning-soft)', borderBottom: '1px solid var(--color-warning)' }}>
                      <td colSpan={8} style={{ padding: '2px 10px 8px 44px' }}>
                        <textarea
                          className="input"
                          value={editValues.description ?? item.description ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                          placeholder="Opis, szczegóły, uwagi..."
                          style={{ width: '100%', minHeight: 32, resize: 'vertical', fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 5 }}
                        />
                      </td>
                    </tr>
                  </Fragment>
                ) : (
                  <Fragment key={item.id}>
                    <tr
                      style={{ borderBottom: '1px solid var(--color-surface-soft)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '9px 10px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>{item.sort_order}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 500 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {item.name}
                          {item.catalog_item_id && (
                            <span title="Z katalogu usług" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--color-success-soft)', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>📚</span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{item.unit}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-text-primary)' }}>{item.quantity}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-text-primary)' }}>{item.unit_price.toFixed(2)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{item.vat_rate}%</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-primary)' }}>{calcItemGross(item).toFixed(2)} zł</td>
                      <td style={{ padding: '9px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button className="btn btn--sm btn--secondary" onClick={() => startEdit(item)} style={{ height: 26, padding: '0 10px', fontSize: 12 }}>Edytuj</button>
                          <button className="btn btn--sm btn--ghost" onClick={() => removeRow(item.id)} style={{ height: 26, padding: '0 8px', fontSize: 12, color: 'var(--color-error)' }}>Usuń</button>
                        </div>
                      </td>
                    </tr>
                    {item.description?.trim() && (
                      <tr style={{ borderBottom: '1px solid var(--color-surface-soft)' }}>
                        <td colSpan={8} style={{ padding: '2px 10px 8px 44px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {item.description}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={addRow}>+ Nowa pusta pozycja</Button>
        <Button variant="secondary" onClick={() => setCatalogOpen(true)}>📚 Dodaj z biblioteki</Button>
      </div>

      <ServiceCatalogPicker
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onAdd={(newItems) => onChange([...items, ...newItems])}
        existingCount={items.length}
      />
    </div>
  )
}
