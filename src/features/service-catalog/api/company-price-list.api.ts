import { isDemoMode, supabase } from '@/shared/lib/supabase'

export interface CompanyPriceEntry {
  id?: string
  catalog_item_id: string | null
  custom_label: string | null
  unit_price: number
  updated_at: string
}

export const companyPriceListApi = {
  /** Fetch all price entries for a company (returns Map for O(1) lookup by catalog_item_id) */
  async getByCompany(companyId: string): Promise<Map<string, number>> {
    if (isDemoMode || !supabase) return new Map()

    const { data, error } = await supabase
      .from('company_price_list')
      .select('catalog_item_id, unit_price')
      .eq('company_id', companyId)

    if (error) throw error
    const map = new Map<string, number>()
    for (const row of data ?? []) {
      if (row.catalog_item_id) {
        map.set(row.catalog_item_id, Number(row.unit_price))
      }
    }
    return map
  },

  /** Fetch all price entries with full details (for settings display) */
  async listByCompany(companyId: string): Promise<CompanyPriceEntry[]> {
    if (isDemoMode || !supabase) return []

    const { data, error } = await supabase
      .from('company_price_list')
      .select('id, catalog_item_id, custom_label, unit_price, updated_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as CompanyPriceEntry[]
  },

  /** Upsert a single catalog price entry */
  async upsertPrice(companyId: string, catalogItemId: string, unitPrice: number): Promise<void> {
    if (isDemoMode || !supabase || unitPrice <= 0) return

    const { error } = await supabase
      .from('company_price_list')
      .upsert(
        {
          company_id: companyId,
          catalog_item_id: catalogItemId,
          unit_price: unitPrice,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,catalog_item_id' }
      )

    if (error) throw error
  },

  /** Upsert a single custom (non-catalog) price entry (delete+insert to avoid partial index issue) */
  async upsertCustomPrice(companyId: string, customLabel: string, unitPrice: number): Promise<void> {
    if (isDemoMode || !supabase || unitPrice <= 0) return

    // Partial indexes not supported by PostgREST onConflict — use delete+insert
    await supabase
      .from('company_price_list')
      .delete()
      .eq('company_id', companyId)
      .eq('custom_label', customLabel)
      .is('catalog_item_id', null)

    const { error } = await supabase
      .from('company_price_list')
      .insert({
        company_id: companyId,
        catalog_item_id: null,
        custom_label: customLabel,
        unit_price: unitPrice,
        updated_at: new Date().toISOString(),
      })

    if (error) throw error
  },

  /** Bulk upsert — supports both catalog and custom entries */
  async upsertMany(
    companyId: string,
    entries: Array<{ catalog_item_id?: string | null; custom_label?: string | null; unit_price: number }>
  ): Promise<void> {
    if (isDemoMode || !supabase) return

    const now = new Date().toISOString()

    // Deduplicate by catalog_item_id (last wins) to avoid ON CONFLICT affecting same row twice
    const catalogMap = new Map<string, number>()
    for (const e of entries) {
      if (e.catalog_item_id && e.unit_price > 0) {
        catalogMap.set(e.catalog_item_id, e.unit_price)
      }
    }
    const catalogRows = Array.from(catalogMap.entries()).map(([id, price]) => ({
      company_id: companyId,
      catalog_item_id: id,
      custom_label: null,
      unit_price: price,
      updated_at: now,
    }))

    // Deduplicate by custom_label (last wins)
    const customMap = new Map<string, number>()
    for (const e of entries) {
      if (!e.catalog_item_id && e.custom_label && e.unit_price > 0) {
        customMap.set(e.custom_label, e.unit_price)
      }
    }
    const customRows = Array.from(customMap.entries()).map(([label, price]) => ({
      company_id: companyId,
      catalog_item_id: null,
      custom_label: label,
      unit_price: price,
      updated_at: now,
    }))

    if (catalogRows.length > 0) {
      const { error } = await supabase
        .from('company_price_list')
        .upsert(catalogRows, { onConflict: 'company_id,catalog_item_id' })
      if (error) throw error
    }

    if (customRows.length > 0) {
      // Partial indexes not supported by PostgREST onConflict — use delete+insert
      const labels = customRows.map((r) => r.custom_label!)
      await supabase
        .from('company_price_list')
        .delete()
        .eq('company_id', companyId)
        .in('custom_label', labels)
        .is('catalog_item_id', null)

      const { error } = await supabase
        .from('company_price_list')
        .insert(customRows)
      if (error) throw error
    }
  },

  /** Delete a price entry by catalog_item_id */
  async deletePrice(companyId: string, catalogItemId: string): Promise<void> {
    if (isDemoMode || !supabase) return

    const { error } = await supabase
      .from('company_price_list')
      .delete()
      .eq('company_id', companyId)
      .eq('catalog_item_id', catalogItemId)

    if (error) throw error
  },

  /** Delete a custom price entry by label */
  async deleteCustomPrice(companyId: string, customLabel: string): Promise<void> {
    if (isDemoMode || !supabase) return

    const { error } = await supabase
      .from('company_price_list')
      .delete()
      .eq('company_id', companyId)
      .eq('custom_label', customLabel)
      .is('catalog_item_id', null)

    if (error) throw error
  },
}
