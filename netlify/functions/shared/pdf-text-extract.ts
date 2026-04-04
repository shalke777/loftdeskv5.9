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
 * Two gates:
 *  1. Minimum length (200 chars — shorter means image-only or near-empty)
 *  2. Readable character ratio ≥ 55% (rejects subsetted-font garbage)
 *
 * Unlike invoice gate, we do NOT require domain keywords — construction PDFs
 * may contain room names, dimensions, material lists in many formats.
 * Instead we rely on length + readability as the quality signal.
 */
export function isPdfProjectTextUsable(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 200) return false

  // Readable character ratio: ASCII printable + Polish diacritics
  const POLISH = 'ąęółśźżćńĄĘÓŁŚŹŻĆŃ'
  let readable = 0
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x20 && cp <= 0x7E) { readable++; continue }
    if (POLISH.includes(ch)) readable++
  }
  return (readable / trimmed.length) >= 0.55
}
