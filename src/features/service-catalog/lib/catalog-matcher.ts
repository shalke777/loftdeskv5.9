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
  match_reason: 'exact' | 'prefix' | 'synonym' | 'word_overlap' | 'compound_part'
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
  'wyburzenie':       'demontaz',
  'rozbiórka ścian':  'demontaz scian',
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
  'spoinowanie':      'fugowanie',
  'fugówka':          'fugowanie',
  'plytkowanie':      'ukladanie plytek',
  'plytkarstwo':      'ukladanie plytek',
  'okladziny':        'ukladanie plytek',
  'okladzina':        'ukladanie plytek',
  // Waterproofing
  'hydroizolacja':    'izolacja przeciwwilgociowa',
  'uszczelnienie':    'izolacja przeciwwilgociowa',
  'folia':            'izolacja',
  'membrana':         'izolacja przeciwwilgociowa',
  'impregnacja':      'izolacja',
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
  'kran':             'montaz armatury',
  'spust':            'montaz odplywu',
  'rura':             'instalacja wodna',
  'instalacja':       'montaz',
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
  'przygotowanie':    'przygotowanie podloza',
  'podloze':          'przygotowanie podloza',
  'podłoże':          'przygotowanie podloza',
  'preparacja':       'przygotowanie podloza',
  'gruntowanie':      'przygotowanie podloza',
  'grunt':            'gruntowanie',
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
  'elektryka':        'instalacja elektryczna',
  'okablowanie':      'instalacja elektryczna',
  'przewody':         'instalacja elektryczna',
  // Drywall
  'karton-gips':      'zabudowa gipsowo-kartonowa',
  'gk':               'plyta gipsowo-kartonowa',
  'rigips':           'plyta gipsowo-kartonowa',
  'sufit podwieszany':'zabudowa sufitu',
  // Painting
  'farba':            'malowanie',
  'malowanie':        'malowanie scian',
  'lakierowanie':     'lakierowanie',
  'finisz':           'lakierowanie',
  'lakier':           'lakierowanie',
  // Finishing / white assembly
  'bialy montaz':     'bialy montaz',
  'lustro':           'montaz lustra',
  'polka':            'montaz polki',
  'wieszak':          'montaz wieszaka',
  'grzejnik':         'montaz grzejnika',
  'kaloryfer':        'montaz grzejnika',
  'kalorifer':        'montaz grzejnika',
  // Flooring
  'panele':           'ukladanie paneli',
  'deska':            'ukladanie desek podlogowych',
  'parkiet':          'ukladanie parkietu',
  'wykladzina':       'ukladanie wykladziny',
  // HVAC
  'klimatyzacja':     'montaz klimatyzacji',
  'wentylacja':       'montaz wentylacji',
  'ogrzewanie':       'instalacja grzewcza',
  'podlogówka':       'ogrzewanie podlogowe',
  'podlogowka':       'ogrzewanie podlogowe',
  // Doors / windows
  'drzwi':            'montaz drzwi',
  'okna':             'montaz okien',
  'okno':             'montaz okien',
  'parapety':         'montaz parapetow',
  'parapet':          'montaz parapetow',
  // Transport / general
  'utylizacja':       'wywoz gruzu',
  'gruz':             'wywoz gruzu',
  'transport':        'transport materialow',
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

// ── Compound splitting ───────────────────────────────────────────────────────
// AI often says "montaż płytek i fugowanie" = 2 distinct catalog items.

const COMPOUND_SEP = /\s+(?:i|oraz|lub|,)\s+/

/** Split compound AI names like "X i Y" into parts. Returns original if not compound. */
function splitCompound(name: string): string[] {
  const parts = name.split(COMPOUND_SEP).map(p => p.trim()).filter(p => p.length > 2)
  return parts.length >= 2 ? parts : [name]
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Match a single AI-generated item name against the full catalog.
 * Handles compound names ("X i Y") by splitting and matching each part.
 * Returns best match + alternatives for operator review.
 */
export function matchCatalogItem(
  aiName: string,
  catalog: ServiceCatalogItem[],
): CatalogMatchResult {
  if (!aiName.trim()) return { best: null, alternatives: [] }

  // Compound splitting — if AI name has "i" / "oraz" / "lub" separator
  const parts = splitCompound(aiName)
  if (parts.length >= 2) {
    // Match each part independently, merge results
    const allMatches: CatalogMatch[] = []
    for (const part of parts) {
      const sub = matchSingle(part, catalog)
      if (sub.best) {
        allMatches.push({ ...sub.best, match_reason: 'compound_part' })
      }
      allMatches.push(...sub.alternatives.map(a => ({ ...a, match_reason: 'compound_part' as const })))
    }
    allMatches.sort((a, b) => b.confidence - a.confidence)
    const seen = new Set<string>()
    const unique = allMatches.filter(m => {
      if (seen.has(m.catalog_item_id)) return false
      seen.add(m.catalog_item_id)
      return true
    })
    return { best: unique[0] ?? null, alternatives: unique.slice(1, 5) }
  }

  return matchSingle(aiName, catalog)
}

/** Core single-item matching logic */
function matchSingle(
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
      const m: CatalogMatch = {
        catalog_item_id: item.id, canonical_name: item.name,
        confidence: 100, tier: 'strong', match_reason: 'exact',
      }
      return { best: m, alternatives: [] }
    }

    let score = 0
    let reason: CatalogMatch['match_reason'] = 'word_overlap'

    // 2. Prefix match (one contains the other)
    if (normAi.startsWith(normCat) || normCat.startsWith(normAi)) {
      const ratio = Math.min(normAi.length, normCat.length) / Math.max(normAi.length, normCat.length)
      score = Math.round(70 + ratio * 25) // 70–95
      reason = 'prefix'
    }

    // 3. Word overlap with synonym expansion
    if (score === 0) {
      const catWords = words(item.name)
      const overlapExpanded = wordOverlap(expandedAiW, catWords)
      const overlapDirect = wordOverlap(aiW, catWords)
      const overlap = Math.max(overlapExpanded, overlapDirect)

      if (overlap >= 0.5) {
        const isSynonym = overlapDirect < overlap
        const bonus = isSynonym ? -5 : 0
        score = Math.round(50 + overlap * 45 + bonus) // 50–95
        reason = isSynonym ? 'synonym' : 'word_overlap'
      }
    }

    if (score >= 50) {
      candidates.push({
        catalog_item_id: item.id,
        canonical_name: item.name,
        confidence: score,
        tier: toTier(score),
        match_reason: reason,
      })
    }
  }

  // Sort by confidence desc
  candidates.sort((a, b) => b.confidence - a.confidence)

  const best = candidates[0] ?? null
  const alternatives = candidates.slice(1, 4)

  return { best, alternatives }
}

/**
 * Match all AI estimate items against catalog.
 * Returns a map of index → match result. Always stores a result (even if no match).
 */
export function matchAllItems(
  names: string[],
  catalog: ServiceCatalogItem[],
): Map<number, CatalogMatchResult> {
  const results = new Map<number, CatalogMatchResult>()
  for (let i = 0; i < names.length; i++) {
    results.set(i, matchCatalogItem(names[i], catalog))
  }
  return results
}
