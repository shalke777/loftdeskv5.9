import { useMemo, useRef, useState } from 'react'
import { Check, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { isDemoMode } from '@/shared/lib/supabase'
import { useServiceCatalog } from '@/features/service-catalog/hooks/useServiceCatalog'
import {
  useCompanyPriceList,
  useDeletePrice,
  useUpsertManyPrices,
  useUpsertPrice,
} from '@/features/service-catalog/hooks/useCompanyPriceList'
import { CATEGORY_LABELS } from '@/entities/service_catalog/model'
import type { ServiceCatalogItem } from '@/entities/service_catalog/model'

const UNIT_DISPLAY: Record<string, string> = { m2: 'm²', mb: 'mb', szt: 'szt.', kpl: 'kpl.', h: 'h', rg: 'rg' }
function displayUnit(unit: string) { return UNIT_DISPLAY[unit] ?? unit }

export function CompanyPriceListCard() {
  const { data: catalog = [], isLoading: catLoading } = useServiceCatalog()
  const { data: priceMap = new Map(), isLoading: pricesLoading } = useCompanyPriceList()
  const upsertPrice = useUpsertPrice()
  const deletePrice = useDeletePrice()
  const upsertMany = useUpsertManyPrices()

  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [search, setSearch] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [addMode, setAddMode] = useState(false)
  const [addItemId, setAddItemId] = useState<string | null>(null)
  const [addPrice, setAddPrice] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // CSV import state
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvPreview, setCsvPreview] = useState<Array<{ catalogItemId: string; name: string; price: number }> | null>(null)
  const [csvUnmatched, setCsvUnmatched] = useState<string[]>([])
  const [csvImporting, setCsvImporting] = useState(false)

  const isLoading = catLoading || pricesLoading

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 5000)
  }

  // Items with stored prices
  const savedItems = useMemo(() => {
    return catalog.filter((item) => {
      const p = priceMap.get(item.id) ?? 0
      return p > 0
    })
  }, [catalog, priceMap])

  // Filter saved items by search
  const filteredSaved = useMemo(() => {
    if (!search.trim()) return savedItems
    const q = search.toLowerCase()
    return savedItems.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      (CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category).toLowerCase().includes(q)
    )
  }, [savedItems, search])

  // Catalog items for add-search (exclude already saved)
  const addSuggestions = useMemo(() => {
    if (!addSearch.trim() || addSearch.length < 2) return []
    const q = addSearch.toLowerCase()
    return catalog
      .filter((item) => {
        const p = priceMap.get(item.id) ?? 0
        return p <= 0 && item.name.toLowerCase().includes(q)
      })
      .slice(0, 8)
  }, [catalog, priceMap, addSearch])

  function startEdit(item: ServiceCatalogItem) {
    const p = priceMap.get(item.id) ?? 0
    setEditId(item.id)
    setEditVal(p > 0 ? String(p) : '')
  }

  function cancelEdit() {
    setEditId(null)
    setEditVal('')
  }

  function saveEdit(catalogItemId: string) {
    const price = parseFloat(editVal.replace(',', '.'))
    if (!isNaN(price) && price > 0) {
      upsertPrice.mutate(
        { catalogItemId, unitPrice: price },
        {
          onSuccess: () => showSuccess('Cena zapisana'),
          onError: (e) => showError(`Błąd zapisu: ${(e as Error).message ?? 'nieznany błąd'}`),
        }
      )
    }
    setEditId(null)
    setEditVal('')
  }

  function handleDelete(catalogItemId: string) {
    deletePrice.mutate(catalogItemId)
  }

  function selectAddItem(item: ServiceCatalogItem) {
    setAddItemId(item.id)
    setAddSearch(item.name)
    setAddSuggestions_noop()
  }
  function setAddSuggestions_noop() {}

  function confirmAdd() {
    if (!addItemId) return
    const price = parseFloat(addPrice.replace(',', '.'))
    if (!isNaN(price) && price > 0) {
      upsertPrice.mutate(
        { catalogItemId: addItemId, unitPrice: price },
        {
          onSuccess: () => showSuccess('Cena dodana do cennika'),
          onError: (e) => showError(`Błąd zapisu: ${(e as Error).message ?? 'nieznany błąd'}`),
        }
      )
    }
    cancelAdd()
  }

  function cancelAdd() {
    setAddMode(false)
    setAddSearch('')
    setAddItemId(null)
    setAddPrice('')
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const matched: Array<{ catalogItemId: string; name: string; price: number }> = []
      const unmatched: string[] = []
      for (const line of lines) {
        const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ','
        const parts = line.split(sep)
        const rawName = (parts[0] ?? '').trim().replace(/^"|"$/g, '')
        const rawPrice = (parts[1] ?? '').trim().replace(/^"|"$/g, '').replace(',', '.')
        if (!rawName) continue
        const price = parseFloat(rawPrice)
        if (isNaN(price) || price <= 0) { unmatched.push(`${rawName} (brak ceny)`); continue }
        const norm = rawName.toLowerCase()
        const found = catalog.find(
          (c) => c.name.toLowerCase() === norm ||
                 c.name.toLowerCase().includes(norm) ||
                 norm.includes(c.name.toLowerCase())
        )
        if (found) {
          matched.push({ catalogItemId: found.id, name: found.name, price })
        } else {
          unmatched.push(rawName)
        }
      }
      setCsvPreview(matched)
      setCsvUnmatched(unmatched)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function confirmCsvImport() {
    if (!csvPreview || csvPreview.length === 0) return
    setCsvImporting(true)
    upsertMany.mutate(
      csvPreview.map((r) => ({ catalog_item_id: r.catalogItemId, unit_price: r.price })),
      {
        onSuccess: () => {
          showSuccess(`Zaimportowano ${csvPreview.length} cen z pliku CSV`)
          setCsvPreview(null)
          setCsvUnmatched([])
        },
        onError: (e) => showError(`Błąd importu: ${(e as Error).message ?? 'nieznany błąd'}`),
        onSettled: () => setCsvImporting(false),
      }
    )
  }

  return (
    <Card>
      {/* Demo mode warning */}
      {isDemoMode && (
        <div style={{
          background: 'rgba(184,116,42,0.1)',
          border: '1px solid rgba(184,116,42,0.3)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: '0.8rem',
          color: 'var(--color-warning, #B8742A)',
        }}>
          Tryb demo — zmiany w cenniku nie są zapisywane. Połącz z Supabase, aby zapisywać ceny.
        </div>
      )}

      {/* Error / success feedback */}
      {errorMsg && (
        <div style={{
          background: 'rgba(168,50,40,0.1)',
          border: '1px solid rgba(168,50,40,0.3)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: '0.8rem',
          color: 'var(--color-error, #A83228)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}
      {successMsg && (
        <div style={{
          background: 'rgba(26,92,50,0.1)',
          border: '1px solid rgba(26,92,50,0.3)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: '0.8rem',
          color: 'var(--color-brand, #1A5C32)',
        }}>
          {successMsg}
        </div>
      )}

      {/* Hidden CSV file input */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={handleCsvFile}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
        <h3 style={{ margin: 0 }}>Cennik usług</h3>
        {!addMode && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="outline" onClick={() => csvInputRef.current?.click()} title="Importuj ceny z pliku CSV">
              <Upload size={14} style={{ marginRight: 5 }} />
              Importuj CSV
            </Button>
            <Button variant="secondary" onClick={() => setAddMode(true)}>
              <Plus size={14} style={{ marginRight: 5 }} />
              Dodaj pozycję
            </Button>
          </div>
        )}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '0.83rem', color: 'var(--color-text-secondary)' }}>
        Domyślne ceny usług — automatycznie wstawiane do nowych wycen.
        {savedItems.length > 0 && (
          <span style={{ marginLeft: 6, fontWeight: 600, color: 'var(--color-brand)' }}>
            {savedItems.length} {savedItems.length === 1 ? 'pozycja' : savedItems.length < 5 ? 'pozycje' : 'pozycji'}
          </span>
        )}
      </p>

      {/* Add new price row */}
      {addMode && (
        <div style={{
          background: 'rgba(26,92,50,0.07)',
          border: '1px solid rgba(26,92,50,0.25)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-brand)', marginBottom: 2 }}>
            Dodaj cenę do katalogu
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              placeholder="Szukaj usługi z katalogu (min. 2 znaki)…"
              value={addSearch}
              onChange={(e) => { setAddSearch(e.target.value); setAddItemId(null) }}
              autoFocus
            />
            {addSuggestions.length > 0 && !addItemId && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                maxHeight: 220,
                overflowY: 'auto',
              }}>
                {addSuggestions.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => selectAddItem(item)}
                    style={{
                      padding: '9px 12px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-soft)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8, fontSize: '0.75rem' }}>
                      {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category} · {displayUnit(item.unit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {addItemId && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Cena netto (zł)"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                style={{ maxWidth: 140 }}
                onKeyDown={(e) => e.key === 'Enter' && confirmAdd()}
                autoFocus
              />
              <Button onClick={confirmAdd} loading={upsertPrice.isPending} disabled={!addPrice}>
                <Check size={14} style={{ marginRight: 4 }} />
                Zapisz
              </Button>
              <Button variant="ghost" onClick={cancelAdd}>
                <X size={14} />
              </Button>
            </div>
          )}

          {!addItemId && (
            <Button variant="ghost" onClick={cancelAdd} style={{ alignSelf: 'flex-start' }}>
              Anuluj
            </Button>
          )}
        </div>
      )}

      {/* CSV import preview */}
      {csvPreview !== null && (
        <div style={{
          background: 'rgba(26,92,50,0.05)',
          border: '1px solid rgba(26,92,50,0.2)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8 }}>
            Podgląd importu CSV — {csvPreview.length} dopasowanych pozycji
            {csvUnmatched.length > 0 && (
              <span style={{ color: 'var(--color-warning, #B8742A)', marginLeft: 8 }}>
                · {csvUnmatched.length} nierozpoznanych
              </span>
            )}
          </div>
          {csvPreview.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 10 }}>
              {csvPreview.map((r) => (
                <div key={r.catalogItemId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>{r.name}</span>
                  <span style={{ fontWeight: 600 }}>{r.price.toFixed(2)} zł</span>
                </div>
              ))}
            </div>
          )}
          {csvUnmatched.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Nierozpoznane: {csvUnmatched.join(', ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={confirmCsvImport} loading={csvImporting} disabled={csvPreview.length === 0}>
              <Check size={13} style={{ marginRight: 4 }} />
              Importuj {csvPreview.length} cen
            </Button>
            <Button variant="ghost" onClick={() => { setCsvPreview(null); setCsvUnmatched([]) }}>
              Anuluj
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>
      ) : savedItems.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '24px 16px',
          border: '1px dashed var(--color-border)',
          borderRadius: 10,
          color: 'var(--color-text-secondary)',
          fontSize: '0.82rem',
        }}>
          Brak zapisanych cen. Ceny są dodawane automatycznie podczas tworzenia wycen,<br />
          lub możesz dodać je ręcznie przyciskiem powyżej.
        </div>
      ) : (
        <>
          {/* Search filter */}
          {savedItems.length >= 5 && (
            <input
              className="input"
              placeholder="Szukaj w cenniku…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* Price rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredSaved.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                Brak wyników dla &ldquo;{search}&rdquo;
              </div>
            ) : (
              filteredSaved.map((item) => {
                const storedPrice = priceMap.get(item.id) ?? 0
                const isEditing = editId === item.id
                const catLabel = CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'var(--color-surface-soft)',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 1 }}>
                        {catLabel} · {displayUnit(item.unit)}
                      </div>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit() }}
                          autoFocus
                          style={{
                            width: 88,
                            height: 30,
                            padding: '3px 8px',
                            fontSize: '0.82rem',
                            border: '1px solid var(--color-brand)',
                            borderRadius: 6,
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                        />
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={upsertPrice.isPending}
                          title="Zapisz"
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'var(--color-brand)', color: '#fff', display: 'grid', placeItems: 'center',
                          }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Anuluj"
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                            cursor: 'pointer', background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
                            display: 'grid', placeItems: 'center',
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', minWidth: 72, textAlign: 'right' }}>
                          {storedPrice.toFixed(2)} zł
                        </span>
                        <button
                          onClick={() => startEdit(item)}
                          title="Edytuj cenę"
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                            cursor: 'pointer', background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
                            display: 'grid', placeItems: 'center',
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletePrice.isPending}
                          title="Usuń cenę"
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                            cursor: 'pointer', background: 'var(--color-surface)', color: 'var(--color-error)',
                            display: 'grid', placeItems: 'center',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--color-border)', margin: '14px 0 0' }}>
        Ceny aktualizują się automatycznie gdy dodajesz pozycje do wycen.
      </p>
    </Card>
  )
}
