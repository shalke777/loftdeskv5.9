import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { companyPriceListApi, normalizeLabel } from '../api/company-price-list.api'
import type { CompanyPriceEntry } from '../api/company-price-list.api'

export type { CompanyPriceEntry }
export { normalizeLabel }

function priceListKey(companyId: string) {
  return ['company_price_list', companyId] as const
}

function priceListDetailKey(companyId: string) {
  return ['company_price_list_detail', companyId] as const
}

/** Returns a Map<catalog_item_id, unit_price> for quick lookup in pickers */
export function useCompanyPriceList() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: priceListKey(companyId),
    queryFn: () => companyPriceListApi.getByCompany(companyId),
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  })
}

/** Returns a Map<normalized_custom_label, unit_price> for fallback fuzzy lookup */
export function useCompanyCustomPriceMap() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['company_price_list_custom', companyId],
    queryFn: () => companyPriceListApi.getCustomMapByCompany(companyId),
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  })
}

/** Returns full list of entries including custom ones (for settings display) */
export function useCompanyPriceListDetail() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: priceListDetailKey(companyId),
    queryFn: () => companyPriceListApi.listByCompany(companyId),
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  })
}

/** Mutation: upsert a single catalog price entry */
export function useUpsertPrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ catalogItemId, unitPrice }: { catalogItemId: string; unitPrice: number }) =>
      companyPriceListApi.upsertPrice(companyId, catalogItemId, unitPrice),
    onSuccess: (_, { catalogItemId, unitPrice }) => {
      // Update Map cache immediately
      qc.setQueryData<Map<string, number>>(priceListKey(companyId), (old) => {
        const next = new Map(old ?? [])
        next.set(catalogItemId, unitPrice)
        return next
      })
      // Update detail list cache immediately
      qc.setQueryData<CompanyPriceEntry[]>(priceListDetailKey(companyId), (old = []) => {
        const now = new Date().toISOString()
        const exists = old.some(e => e.catalog_item_id === catalogItemId)
        if (exists) return old.map(e => e.catalog_item_id === catalogItemId ? { ...e, unit_price: unitPrice, updated_at: now } : e)
        return [{ catalog_item_id: catalogItemId, custom_label: null, unit_price: unitPrice, updated_at: now }, ...old]
      })
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      const msg = error?.message ?? 'Sprawdź połączenie i spróbuj ponownie'
      toast.error('Nie udało się zapisać ceny', msg)
      console.error('[price-list] upsertPrice error:', error)
    },
  })
}

/** Mutation: upsert a single custom (non-catalog) price entry */
export function useUpsertCustomPrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ customLabel, unitPrice }: { customLabel: string; unitPrice: number }) =>
      companyPriceListApi.upsertCustomPrice(companyId, customLabel, unitPrice),
    onSuccess: (_, { customLabel, unitPrice }) => {
      // Update detail list cache immediately
      qc.setQueryData<CompanyPriceEntry[]>(priceListDetailKey(companyId), (old = []) => {
        const now = new Date().toISOString()
        const exists = old.some(e => e.custom_label === customLabel && !e.catalog_item_id)
        if (exists) return old.map(e => (e.custom_label === customLabel && !e.catalog_item_id) ? { ...e, unit_price: unitPrice, updated_at: now } : e)
        return [{ catalog_item_id: null, custom_label: customLabel, unit_price: unitPrice, updated_at: now }, ...old]
      })
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      const msg = error?.message ?? 'Sprawdź połączenie i spróbuj ponownie'
      toast.error('Nie udało się zapisać ceny', msg)
      console.error('[price-list] upsertCustomPrice error:', error)
    },
  })
}

/** Mutation: delete a catalog price entry */
export function useDeletePrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (catalogItemId: string) =>
      companyPriceListApi.deletePrice(companyId, catalogItemId),
    onSuccess: (_, catalogItemId) => {
      qc.setQueryData<Map<string, number>>(priceListKey(companyId), (old) => {
        const next = new Map(old ?? [])
        next.delete(catalogItemId)
        return next
      })
      qc.setQueryData<CompanyPriceEntry[]>(priceListDetailKey(companyId), (old = []) =>
        old.filter(e => e.catalog_item_id !== catalogItemId),
      )
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      toast.error('Nie udało się usunąć ceny', error?.message ?? 'Spróbuj ponownie')
      console.error('[price-list] deletePrice error:', error)
    },
  })
}

/** Mutation: delete a custom price entry */
export function useDeleteCustomPrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (customLabel: string) =>
      companyPriceListApi.deleteCustomPrice(companyId, customLabel),
    onSuccess: (_, customLabel) => {
      qc.setQueryData<CompanyPriceEntry[]>(priceListDetailKey(companyId), (old = []) =>
        old.filter(e => !(e.custom_label === customLabel && !e.catalog_item_id)),
      )
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      toast.error('Nie udało się usunąć ceny', error?.message ?? 'Spróbuj ponownie')
      console.error('[price-list] deleteCustomPrice error:', error)
    },
  })
}

/** Mutation: bulk upsert — supports catalog and custom entries */
export function useUpsertManyPrices() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (entries: Array<{ catalog_item_id?: string | null; custom_label?: string | null; unit_price: number }>) =>
      companyPriceListApi.upsertMany(companyId, entries),
    onSuccess: (_, entries) => {
      const now = new Date().toISOString()
      // Update Map cache immediately for catalog entries
      qc.setQueryData<Map<string, number>>(priceListKey(companyId), (old) => {
        const next = new Map(old ?? [])
        for (const e of entries) {
          if (e.catalog_item_id && e.unit_price > 0) next.set(e.catalog_item_id, e.unit_price)
        }
        return next
      })
      // Update detail list cache immediately
      qc.setQueryData<CompanyPriceEntry[]>(priceListDetailKey(companyId), (old = []) => {
        let updated = [...old]
        for (const e of entries) {
          if (e.catalog_item_id) {
            const idx = updated.findIndex(x => x.catalog_item_id === e.catalog_item_id)
            if (idx >= 0) updated[idx] = { ...updated[idx], unit_price: e.unit_price, updated_at: now }
            else updated = [{ catalog_item_id: e.catalog_item_id, custom_label: null, unit_price: e.unit_price, updated_at: now }, ...updated]
          } else if (e.custom_label) {
            const idx = updated.findIndex(x => x.custom_label === e.custom_label && !x.catalog_item_id)
            if (idx >= 0) updated[idx] = { ...updated[idx], unit_price: e.unit_price, updated_at: now }
            else updated = [{ catalog_item_id: null, custom_label: e.custom_label, unit_price: e.unit_price, updated_at: now }, ...updated]
          }
        }
        return updated
      })
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      toast.error('Nie udało się zapisać cennika', error?.message ?? 'Spróbuj ponownie')
      console.error('[price-list] upsertMany error:', error)
    },
  })
}
