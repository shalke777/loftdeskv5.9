// =============================================================================
// PDF text extraction utilities for project analysis
// =============================================================================
// Reuses the battle-tested text extraction from parse-invoice.ts.
// Project-specific usability gate checks for construction/renovation keywords
// instead of invoice keywords.
// =============================================================================

import { extractTextFromPDF } from '../parse-invoice'

/** Max characters to extract from PDF for project analysis */
const MAX_TEXT_CHARS = 40_000

/**
 * Extract text from a PDF buffer, capped at MAX_TEXT_CHARS.
 * Returns empty string on failure (caller should fall back to vision path).
 */
export async function extractProjectPdfText(buffer: Buffer): Promise<string> {
  try {
    const raw = await extractTextFromPDF(buffer)
    return raw.slice(0, MAX_TEXT_CHARS)
  } catch (e) {
    console.warn('[pdf-text] extractTextFromPDF failed:', (e as Error).message)
    return ''
  }
}

/**
 * Check if extracted PDF text is usable for project analysis.
 *
 * Three gates (all must pass):
 *  1. Minimum length: 500+ chars (rejects near-empty extractions)
 *  2. Readable character ratio ≥ 55% (rejects subsetted-font garbage)
 *  3. Construction keyword density: ≥ 4 distinct domain keywords found
 *     (rejects PDFs where text is only headers/legends from drawings)
 *
 * Gate 3 is critical: a PDF with technical drawings may yield readable text
 * (scale labels, page numbers, legend entries) but without enough project
 * content for meaningful AI analysis.
 */
export function isPdfProjectTextUsable(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 500) return false

  // Readable character ratio: ASCII printable + Polish diacritics
  const POLISH = 'ąęółśźżćńĄĘÓŁŚŹŻĆŃ'
  let readable = 0
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x20 && cp <= 0x7E) { readable++; continue }
    if (POLISH.includes(ch)) readable++
  }
  if ((readable / trimmed.length) < 0.55) return false

  // Construction/renovation keyword density gate
  const lower = trimmed.toLowerCase()
  const PROJECT_KEYWORDS = [
    // rooms
    'łazienk', 'kuchni', 'salon', 'pokój', 'pokoi', 'sypialn', 'korytarz',
    'przedpokój', 'pomieszczen', 'garderob', 'piwnic', 'garaż', 'taras',
    'balkon', 'wc', 'toalet',
    // dimensions / units
    'm²', 'm2', 'mb', 'metr', 'wymiar', 'powierzchni', 'wysokoś',
    // materials
    'płytk', 'gres', 'terakot', 'panel', 'parkiet', 'laminat',
    'gładź', 'tynk', 'farba', 'malowa', 'tapeta', 'beton',
    'gipskart', 'regips', 'styropian', 'wełna', 'izolac',
    'cement', 'zaprawa', 'klej', 'fuga', 'silikon',
    // finishes / elements
    'podłog', 'ścian', 'sufit', 'okno', 'drzwi', 'futryn',
    'parapet', 'schody', 'balustr', 'poręcz',
    // installations
    'instalac', 'elektr', 'hydraul', 'wodno', 'kanaliz', 'ocieplen',
    'wentylac', 'klimatyz', 'ogrzewan', 'grzejnik', 'kaloryfer',
    // scope
    'wykończen', 'remont', 'renowac', 'przebudow', 'adaptac',
    'demontaż', 'montaż', 'roboty', 'robocizn', 'usług',
    'kosztorys', 'wycen', 'pozycj', 'zakres',
    // project
    'projekt', 'rzut', 'kondygnac', 'piętro', 'parter',
    'inwestycj', 'budow', 'budynek', 'mieszkan', 'lokal',
  ]

  let keywordHits = 0
  for (const kw of PROJECT_KEYWORDS) {
    if (lower.includes(kw)) {
      keywordHits++
      if (keywordHits >= 4) return true
    }
  }
  return false
}
