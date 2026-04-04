/**
 * Minimal matcher: AI-generated item name → service_catalog entry.
 *
 * Strategy (in order):
 *   1. Exact match after normalization
 *   2. Catalog name is a prefix of AI name (or vice versa)
 *   3. High word-overlap (≥80%)
 *
 * Returns the best match with confidence, or null if no good match.
 * No embeddings, no Levenshtein — pure string normalization.
 */

import type { ServiceCatalogItem } from '@/entities/service_catalog/model'

export interface CatalogMatch {
  catalog_item_id: string
  canonical_name: string
  confidence: number          // 0–100
}

/** Normalize a Polish string for comparison */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/m²/g, 'm2')
    .replace(/m³/g, 'm3')
}

/** Extract meaningful words (skip short prepositions/articles) */
function words(s: string): string[] {
  const STOP = new Set(['i', 'z', 'w', 'na', 'do', 'od', 'po', 'ze', 'we', 'pod', 'nad', 'dla', 'przy', 'oraz'])
  return normalize(s)
    .split(' ')
    .filter(w => w.length > 1 && !STOP.has(w))
}

/** Word overlap ratio between two sets */
function wordOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const shared = a.filter(w => setB.has(w)).length
  const maxLen = Math.max(a.length, b.length)
  return shared / maxLen
}

/**
 * Match a single AI-generated item name against the full catalog.
 * Returns the best match above threshold, or null.
 */
export function matchCatalogItem(
  aiName: string,
  catalog: ServiceCatalogItem[],
): CatalogMatch | null {
  if (!aiName.trim()) return null

  const normAi = normalize(aiName)
  const aiWords = words(aiName)

  let bestMatch: CatalogMatch | null = null
  let bestScore = 0

  for (const item of catalog) {
    const normCat = normalize(item.name)

    // 1. Exact match
    if (normAi === normCat) {
      return { catalog_item_id: item.id, canonical_name: item.name, confidence: 100 }
    }

    // 2. Prefix match (one contains the other)
    let score = 0
    if (normAi.startsWith(normCat) || normCat.startsWith(normAi)) {
      const ratio = Math.min(normAi.length, normCat.length) / Math.max(normAi.length, normCat.length)
      score = Math.round(70 + ratio * 20) // 70–90
    }

    // 3. Word overlap
    if (score === 0) {
      const catWords = words(item.name)
      const overlap = wordOverlap(aiWords, catWords)
      if (overlap >= 0.8) {
        score = Math.round(60 + overlap * 30) // 60–90
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = { catalog_item_id: item.id, canonical_name: item.name, confidence: score }
    }
  }

  // Only return matches with confidence ≥ 70
  return bestMatch && bestMatch.confidence >= 70 ? bestMatch : null
}

/**
 * Match all AI estimate items against catalog, returning a map of index → match.
 */
export function matchAllItems(
  names: string[],
  catalog: ServiceCatalogItem[],
): Map<number, CatalogMatch> {
  const results = new Map<number, CatalogMatch>()
  for (let i = 0; i < names.length; i++) {
    const match = matchCatalogItem(names[i], catalog)
    if (match) results.set(i, match)
  }
  return results
}
