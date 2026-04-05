/**
 * Catalog matcher v2: AI-generated item name → service_catalog entry.
 *
 * Strategy (in order):
 *   1. Exact match after normalization
 *   2. Synonym expansion — maps industry aliases to canonical catalog forms
 *   3. Catalog name is a prefix of AI name (or vice versa)
 *   4. High word-overlap (≥60%)
 *
 * Returns the best match with confidence + tier, or null if no match.
 * Supports returning alternatives for ambiguous matches.
 */

import type { ServiceCatalogItem } from '@/entities/service_catalog/model'

// ── Types ────────────────────────────────────────────────────────────────────

export type MatchTier = 'strong' | 'partial' | 'none'

export interface CatalogMatch {
  catalog_item_id: string
  canonical_name: string
  confidence: number          // 0–100
  tier: MatchTier
}

export interface CatalogMatchResult {
  best: CatalogMatch | null
  alternatives: CatalogMatch[]  // other plausible matches (confidence ≥ 50)
}

// ── Polish renovation synonym map ────────────────────────────────────────────
// Keys are normalized aliases → values are canonical catalog name fragments.
// Matcher expands AI name through synonyms before comparing.

const SYNONYMS: Record<string, string> = {
  // Demolition / preparation
  'kucie':            'skuwanie',
  'kuj':              'skuwanie',
  'zrywanie':         'demontaz',
  'rozbiorka':        'demontaz',
  'rozbiórka':        'demontaz',
  'zerwanie':         'demontaz',
  'sciaganie':        'demontaz',
  'ściąganie':        'demontaz',
  // Tiling
  'kafelki':          'plytki',
  'kafle':            'plytki',
  'kafelkowanie':     'ukladanie plytek',
  'glazura':          'plytki scienne',
  'terakota':         'plytki podlogowe',
  'gresy':            'plytki podlogowe',
  'gres':             'plytki podlogowe',
  'mozaika':          'plytki mozaikowe',
  'fugi':             'fugowanie',
  // Waterproofing
  'hydroizolacja':    'izolacja przeciwwilgociowa',
  'uszczelnienie':    'izolacja przeciwwilgociowa',
  'folia':            'izolacja',
  // Plumbing
  'rury':             'instalacja wodna',
  'kanalizacja':      'instalacja kanalizacyjna',
  'armatura':         'montaz armatury',
  'bateria':          'montaz baterii',
  'baterie':          'montaz baterii',
  'umywalka':         'montaz umywalki',
  'zlew':             'montaz zlewu',
  'miska':            'montaz miski wc',
  'wc':               'miska wc',
  'toaleta':          'miska wc',
  'sedes':            'miska wc',
  'prysznic':         'montaz kabiny prysznicowej',
  'kabina':           'kabina prysznicowa',
  'wanna':            'montaz wanny',
  'brodzik':          'montaz brodzika',
  'odpływ':           'montaz odplywu',
  'odplyw':           'montaz odplywu',
  'syfon':            'montaz syfonu',
  // Substrate / plastering
  'tynk':             'tynkowanie',
  'tynki':            'tynkowanie',
  'gladz':            'gladzenie',
  'gładź':            'gladzenie',
  'gładzie':          'gladzenie',
  'szpachlowanie':    'gladzenie',
  'wylewka':          'wylewki',
  'posadzka':         'wylewki',
  'jastrych':         'wylewki',
  // Electrical
  'gniazdka':         'montaz gniazdek',
  'gniazdko':         'montaz gniazdek',
  'wlacznik':         'montaz wlacznikow',
  'włącznik':         'montaz wlacznikow',
  'wlaczniki':        'montaz wlacznikow',
  'oświetlenie':      'montaz oswietlenia',
  'oswietlenie':      'montaz oswietlenia',
  'lampa':            'montaz oswietlenia',
  'lampy':            'montaz oswietlenia',
  // Drywall
  'karton-gips':      'zabudowa gipsowo-kartonowa',
  'gk':               'plyta gipsowo-kartonowa',
  'rigips':           'plyta gipsowo-kartonowa',
  'sufit podwieszany':'zabudowa sufitu',
  // Painting
  'farba':            'malowanie',
  'malowanie':        'malowanie scian',
  'lakierowanie':     'lakierowanie',
  // Finishing / white assembly
  'bialy montaz':     'bialy montaz',
  'lustro':           'montaz lustra',
  'polka':            'montaz polki',
  'wieszak':          'montaz wieszaka',
  'grzejnik':         'montaz grzejnika',
  'kaloryfer':        'montaz grzejnika',
  // Flooring
  'panele':           'ukladanie paneli',
  'deska':            'ukladanie desek podlogowych',
  'parkiet':          'ukladanie parkietu',
  'wykladzina':       'ukladanie wykladziny',
}

// ── Normalization ────────────────────────────────────────────────────────────

const DIACRITICS: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
  'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
}

/** Normalize a Polish string for comparison — strips diacritics, lowercases */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[ąćęłńóśźż]/g, ch => DIACRITICS[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .replace(/m²/g, 'm2')
    .replace(/m³/g, 'm3')
}

const STOP = new Set(['i', 'z', 'w', 'na', 'do', 'od', 'po', 'ze', 'we', 'pod', 'nad', 'dla', 'przy', 'oraz', 'lub'])

/** Extract meaningful words (skip short prepositions/articles) */
function words(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter(w => w.length > 1 && !STOP.has(w))
}

/** Expand a word through synonym map */
function expandSynonyms(inputWords: string[]): string[] {
  const expanded = [...inputWords]
  const joined = inputWords.join(' ')
  for (const [alias, canonical] of Object.entries(SYNONYMS)) {
    const normAlias = normalize(alias)
    if (joined.includes(normAlias) || inputWords.some(w => w === normAlias)) {
      const canonWords = words(canonical)
      for (const cw of canonWords) {
        if (!expanded.includes(cw)) expanded.push(cw)
      }
    }
  }
  return expanded
}

/** Word overlap ratio between two sets */
function wordOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const shared = a.filter(w => setB.has(w)).length
  const maxLen = Math.max(a.length, b.length)
  return shared / maxLen
}

function toTier(confidence: number): MatchTier {
  if (confidence >= 85) return 'strong'
  if (confidence >= 60) return 'partial'
  return 'none'
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Match a single AI-generated item name against the full catalog.
 * Returns best match + alternatives for operator review.
 */
export function matchCatalogItem(
  aiName: string,
  catalog: ServiceCatalogItem[],
): CatalogMatchResult {
  if (!aiName.trim()) return { best: null, alternatives: [] }

  const normAi = normalize(aiName)
  const aiW = words(aiName)
  const expandedAiW = expandSynonyms(aiW)

  const candidates: CatalogMatch[] = []

  for (const item of catalog) {
    const normCat = normalize(item.name)

    // 1. Exact match (after normalization)
    if (normAi === normCat) {
      const m: CatalogMatch = { catalog_item_id: item.id, canonical_name: item.name, confidence: 100, tier: 'strong' }
      return { best: m, alternatives: [] }
    }

    let score = 0

    // 2. Prefix match (one contains the other)
    if (normAi.startsWith(normCat) || normCat.startsWith(normAi)) {
      const ratio = Math.min(normAi.length, normCat.length) / Math.max(normAi.length, normCat.length)
      score = Math.round(70 + ratio * 25) // 70–95
    }

    // 3. Word overlap with synonym expansion
    if (score === 0) {
      const catWords = words(item.name)
      // Try expanded words first
      const overlapExpanded = wordOverlap(expandedAiW, catWords)
      const overlapDirect = wordOverlap(aiW, catWords)
      const overlap = Math.max(overlapExpanded, overlapDirect)

      if (overlap >= 0.5) {
        // Expanded match gets slight penalty vs direct match
        const bonus = overlapDirect >= overlap ? 0 : -5
        score = Math.round(50 + overlap * 45 + bonus) // 50–95
      }
    }

    if (score >= 50) {
      candidates.push({
        catalog_item_id: item.id,
        canonical_name: item.name,
        confidence: score,
        tier: toTier(score),
      })
    }
  }

  // Sort by confidence desc
  candidates.sort((a, b) => b.confidence - a.confidence)

  const best = candidates[0] ?? null
  const alternatives = candidates.slice(1, 4) // top 3 alternatives

  return { best, alternatives }
}

/**
 * Match all AI estimate items against catalog.
 * Returns a map of index → match result (best + alternatives).
 */
export function matchAllItems(
  names: string[],
  catalog: ServiceCatalogItem[],
): Map<number, CatalogMatchResult> {
  const results = new Map<number, CatalogMatchResult>()
  for (let i = 0; i < names.length; i++) {
    const result = matchCatalogItem(names[i], catalog)
    if (result.best) results.set(i, result)
  }
  return results
}
