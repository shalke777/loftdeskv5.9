import type { ServiceCatalogItem } from '@/entities/service_catalog/model'
import { isDemoMode, supabase } from '@/shared/lib/supabase'

function mapRow(row: any): ServiceCatalogItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    unit: row.unit ?? 'm2',
    sort_order: row.sort_order ?? 0,
    tags: row.tags ?? [],
    is_active: row.is_active ?? true,
  }
}

export const serviceCatalogApi = {
  /** All active catalog items, ordered by category → sort_order */
  async list(): Promise<ServiceCatalogItem[]> {
    if (isDemoMode || !supabase) return []

    const { data, error } = await supabase
      .from('service_catalog')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapRow)
  },

  /** Active items in a single category */
  async listByCategory(category: string): Promise<ServiceCatalogItem[]> {
    if (isDemoMode || !supabase) return []

    const { data, error } = await supabase
      .from('service_catalog')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapRow)
  },
}
