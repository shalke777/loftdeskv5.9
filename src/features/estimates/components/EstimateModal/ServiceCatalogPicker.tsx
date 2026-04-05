import { useMemo, useState } from 'react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { useServiceCatalog } from '@/features/service-catalog/hooks/useServiceCatalog'
import { CATEGORY_LABELS, SERVICE_CATALOG_CATEGORIES } from '@/entities/service_catalog/model'
import type { ServiceCatalogItem } from '@/entities/service_catalog/model'
import type { EstimateItem } from '@/entities/estimate/model'
import { generateId } from '@/shared/lib/generateId'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (items: EstimateItem[]) => void
  existingCount: number
}

const DEFAULT_VAT = 8

export function ServiceCatalogPicker({ open, onClose, onAdd, existingCount }: Props) {
  const { data: catalog = [], isLoading } = useServiceCatalog()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return catalog.filter((item) => {
      if (category && item.category !== category) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [catalog, search, category])

  // Group filtered items by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, ServiceCatalogItem[]>()
    for (const item of filtered) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return map
  }, [filtered])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAdd() {
    const items: EstimateItem[] = Array.from(selected)
      .map((id) => catalog.find((c) => c.id === id))
      .filter(Boolean)
      .map((item, idx) => ({
        id: generateId(),
        name: item!.name,
        description: '',
        unit: item!.unit === 'm2' ? 'm²' : item!.unit,
        quantity: 1,
        unit_price: 0,
        vat_rate: DEFAULT_VAT,
        sort_order: existingCount + idx + 1,
        catalog_item_id: item!.id,
      }))

    onAdd(items)
    setSelected(new Set())
    setSearch('')
    setCategory('')
    onClose()
  }

  function handleClose() {
    setSelected(new Set())
    setSearch('')
    setCategory('')
    onClose()
  }

  return (
    <Modal title="Dodaj z biblioteki" open={open} onClose={handleClose} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Szukaj usługi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              height: 36,
              fontSize: 13,
              padding: '6px 10px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              background: 'var(--color-surface)',
            }}
          />
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: 240,
              height: 36,
              fontSize: 13,
              padding: '6px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              background: 'var(--color-surface)',
            }}
          >
            <option value="">Wszystkie kategorie</option>
            {SERVICE_CATALOG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* ── Status bar ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>
            {filtered.length} pozycji
            {search || category ? ' (filtrowane)' : ''}
          </span>
          {selected.size > 0 && (
            <span style={{ color: 'var(--color-brand)', fontWeight: 600 }}>
              Zaznaczono: {selected.size}
            </span>
          )}
        </div>

        {/* ── Items list ── */}
        <div
          style={{
            maxHeight: 420,
            overflowY: 'auto',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            background: 'var(--color-surface)',
          }}
        >
          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              Ładowanie katalogu...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              Nie znaleziono pozycji
            </div>
          ) : (
            Array.from(grouped.entries()).map(([cat, items]) => (
              <div key={cat}>
                {/* Category header */}
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-surface-soft)',
                    borderBottom: '1px solid var(--color-border)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    zIndex: 1,
                  }}
                >
                  {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                  <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>({items.length})</span>
                </div>
                {/* Items in category */}
                {items.map((item) => {
                  const isSelected = selected.has(item.id)
                  return (
                    <label
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(26,92,50,0.08)' : undefined,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-soft)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected ? 'rgba(26,92,50,0.08)' : ''
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(item.id)}
                        style={{ accentColor: 'var(--color-brand)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)' }}>
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-tertiary)',
                          background: 'var(--color-surface-soft)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        {item.unit === 'm2' ? 'm²' : item.unit}
                      </span>
                    </label>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button
            className="btn btn--sm btn--ghost"
            onClick={handleClose}
            style={{ height: 34, padding: '0 16px', fontSize: 13 }}
          >
            Anuluj
          </button>
          <button
            className="btn btn--sm btn--primary"
            onClick={handleAdd}
            disabled={selected.size === 0}
            style={{ height: 34, padding: '0 20px', fontSize: 13 }}
          >
            Dodaj ({selected.size})
          </button>
        </div>
      </div>
    </Modal>
  )
}
