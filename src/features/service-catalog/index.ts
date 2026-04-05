export { useServiceCatalog, useServiceCatalogByCategory } from './hooks/useServiceCatalog'
export { serviceCatalogApi } from './api/service-catalog.api'
export { matchCatalogItem, matchAllItems } from './lib/catalog-matcher'
export type { CatalogMatch, CatalogMatchResult, MatchTier } from './lib/catalog-matcher'
export type { ServiceCatalogItem } from '@/entities/service_catalog/model'
export {
  SERVICE_CATALOG_CATEGORIES,
  CATEGORY_LABELS,
} from '@/entities/service_catalog/model'
export type { ServiceCatalogCategory } from '@/entities/service_catalog/model'
