import { z } from 'zod'

/**
 * ServiceCatalogItem — matches `service_catalog` table 1:1.
 * Read-only reference table: 349 items across 20 renovation categories.
 */
export const ServiceCatalogItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  unit: z.string().default('m2'),
  sort_order: z.number().int().default(0),
  tags: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
})

export type ServiceCatalogItem = z.infer<typeof ServiceCatalogItemSchema>

/** All 20 category slugs used in service_catalog */
export const SERVICE_CATALOG_CATEGORIES = [
  'demolition',
  'masonry',
  'substrate',
  'painting',
  'drywall',
  'flooring',
  'joinery',
  'electrical',
  'plumbing',
  'turnkey',
  'tiling',
  'tiling_specialist',
  'waterproofing',
  'exterior',
  'stone',
  'finishing',
  'carpentry',
  'repair',
  'service',
  'complex',
] as const

export type ServiceCatalogCategory = (typeof SERVICE_CATALOG_CATEGORIES)[number]

/** Polish display names for categories */
export const CATEGORY_LABELS: Record<ServiceCatalogCategory, string> = {
  demolition: 'Prace przygotowawcze i demontażowe',
  masonry: 'Prace murarskie i konstrukcyjne',
  substrate: 'Tynki, gładzie i przygotowanie powierzchni',
  painting: 'Malowanie i dekoracja ścian',
  drywall: 'Zabudowy gipsowo-kartonowe i sufity',
  flooring: 'Podłogi i posadzki',
  joinery: 'Stolarka wewnętrzna',
  electrical: 'Instalacje elektryczne',
  plumbing: 'Instalacje wodno-kanalizacyjne',
  turnkey: 'Łazienki i kuchnie pod klucz',
  tiling: 'Glazurnictwo podstawowe',
  tiling_specialist: 'Glazurnictwo specjalistyczne',
  waterproofing: 'Hydroizolacje i strefy mokre',
  exterior: 'Tarasy, balkony, schody',
  stone: 'Kamień, konglomerat, lastryko',
  finishing: 'Biały montaż i wyposażenie',
  carpentry: 'Prace stolarskie i meblowe',
  repair: 'Drobne naprawy i renowacje',
  service: 'Usługi dodatkowe i okołoremontowe',
  complex: 'Kompleksowe remonty i wykończenia',
}
