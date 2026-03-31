// =============================================================================
// src/features/ai-review/lib/mapAiScopeToEstimate.ts
// =============================================================================
// Sprint 4 bridge: maps reviewed ai_scope_items into EstimateItem[] for use
// with estimatesApi.create().
//
// Rules:
//   - Only items with review_status 'accepted' or 'modified' are included.
//   - quantity_final takes priority over quantity_suggested (operator override).
//   - price_confirmed_by_operator takes priority over price_suggested_by_ai.
//     If neither is set (missing_price=true), unit_price defaults to 0.
//     Operator must fill prices manually in the estimate editor before sending.
//   - vat_rate defaults to 23% — the standard Polish rate. Operator can edit.
//   - sort_order is preserved from ai_scope_items.
//   - scope_layer items (HIDDEN_PROBABLE_SCOPE) are included if accepted/modified.
//     Operator made a conscious decision by reviewing them.
//
// This is a pure mapping function — no API calls, no side effects.
// =============================================================================

import type { EstimateItem } from '@/entities/estimate/model'
import type { AiScopeItem } from '../api/ai-review.api'

const DEFAULT_VAT_RATE = 23

/**
 * Map reviewed AI scope items to estimate line items.
 * Returns only accepted and modified items in their review order.
 */
export function mapAiScopeToEstimateItems(
  scopeItems: AiScopeItem[],
): EstimateItem[] {
  return scopeItems
    .filter(item =>
      item.review_status === 'accepted' || item.review_status === 'modified',
    )
    .map((item, index) => ({
      id:          item.id,   // reuse scope item id as a stable key (not saved to DB)
      name:        (item.title ?? item.description ?? 'Pozycja').slice(0, 120),
      description: item.description,
      unit:        item.unit ?? 'szt.',
      quantity:    item.quantity_final
                     ?? item.quantity_suggested
                     ?? 1,
      unit_price:  item.price_confirmed_by_operator
                     ?? item.price_suggested_by_ai
                     ?? 0,
      vat_rate:    DEFAULT_VAT_RATE,
      sort_order:  item.sort_order ?? index,
    } satisfies EstimateItem))
}

/**
 * Build a human-readable estimate name from the AI run context.
 */
export function buildAiEstimateName(
  roomType: 'bathroom' | 'wc' | string,
  runCreatedAt: string,
): string {
  const roomLabel = roomType === 'bathroom' ? 'Łazienka' : roomType === 'wc' ? 'WC' : roomType
  const date = new Date(runCreatedAt)
  const datePart = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`
  return `Wycena AI — ${roomLabel} (${datePart})`
}
