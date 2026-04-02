// =============================================================================
// src/services/ai/composite/fusion.engine.ts
// =============================================================================
// Fusion Skeleton v1 — pure TypeScript, no I/O.
//
// Takes evidence rows from ai_extraction_results + asset source_priority map,
// groups fusible types, merges duplicates, detects conflicts, returns
// FusedBundleOutput.
//
// Merge rules:
//   R-F1  Group by: evidence_type + room_label + subject_key (normalized)
//   R-F2  Winner = item from asset with lowest source_priority (most authoritative)
//   R-F3  Conflict = same group, different value for numeric/string key field,
//         both confidence > 0.5, and values differ beyond threshold
//   R-F4  Pass-through types (dimension, scope_hint, missing_data, hypothesis)
//         are collected as-is — not merged, not grouped
//   R-F5  Questions/risks are deduplicated by id (questions) or text hash (risks)
//   R-F6  tile_spec zestawienie pages win over rzut pages even at same asset
//         (detected by source_anchor containing "zestawienie" — R-26 compliance)
// =============================================================================

import { createHash } from 'crypto'
import type {
  FusedBundleOutput,
  FusedConflict,
  FusedQuestion,
  FusedRisk,
  FusedScopeCandidate,
  FusionStats,
  LinkedDimension,
  LinkedScopeHint,
  PassthroughItem,
} from './fusion.types'

// ── Input shapes (mirrors DB row shape) ───────────────────────────────────────

export interface EvidenceRow {
  id:               string
  evidence_type:    string
  room_label:       string | null
  confidence_score: number
  source_anchor:    string | null
  asset_id:         string
  content:          Record<string, unknown>
}

export interface AssetPriorityMap {
  [asset_id: string]: number   // source_priority (lower = more authoritative)
}

export interface QuestionRiskRow {
  id?:        string
  entry_type: 'question' | 'risk'
  content:    Record<string, unknown>
}

// ── Fusible evidence_types ─────────────────────────────────────────────────────

const FUSIBLE_TYPES = new Set(['fixture', 'tile_spec', 'material', 'installation'])
const PASSTHROUGH_TYPES = new Set(['dimension', 'scope_hint', 'missing_data', 'hypothesis'])

// ── Canonical fixture type lookup (R-F-peer2) ─────────────────────────────────
// Maps regex patterns against a fixture's normalized name to a functional semantic type.
// When two fixtures in the same room share the same category but have DIFFERENT
// canonical types (e.g. toilet vs shower), they legitimately coexist — do NOT flag.
// When canonical types are the SAME (two showers), flag as peer_review_needed.
const FIXTURE_CANONICAL_TYPES: [RegExp, string][] = [
  [/prysznic|walk[\s-]?in|kabina.*prysznic|kabina.*walk|shower/,     'shower'],
  [/wanna|bathtub/,                                                    'bath'],
  [/\bwc\b|miska.*wc|toaleta|toilet|sedes|kompakt/,                  'toilet'],
  [/umywalka|lavabo|washbasin/,                                       'washbasin'],
  [/brodzik|shower[\s-]?tray/,                                        'shower_tray'],
  [/grzejnik|radiator|ogrzewanie/,                                    'heating'],
  [/od[pł]yw|drain/,                                                  'drain'],
]

function getCanonicalFixtureType(name: string): string | null {
  const lower = name.toLowerCase()
  for (const [re, type] of FIXTURE_CANONICAL_TYPES) {
    if (re.test(lower)) return type
  }
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeKey(s: unknown): string {
  if (s == null) return ''
  return String(s).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_\u00e0-\u017f]/g, '')
}

// ── Canonical zone normalization (R-F-norm2) ──────────────────────────────────
// Maps Polish zone/surface name variants to stable ASCII keys for group key use.
// Prevents false splits when two sources describe the same surface differently:
//   "ściana" / "ściany" / "ściany boczne" → "sciana"
//   "podłoga" / "posadzka" / "floor" → "podloga"
const ZONE_CANONICAL: [RegExp, string][] = [
  [/[śs]cian/,           'sciana'],    // ściana, ściany, ściany boczne, sciana
  [/pod[łl]og|posadzk|floor/, 'podloga'],  // podłoga, podłogi, posadzka, floor
  [/sufit|ceiling/,      'sufit'],
  [/podest|stopnic/,     'podest'],
  [/cok[oó][łl]|skirting/, 'cokol'],
]

function normalizeZone(zone: unknown): string {
  if (zone == null) return 'null'
  const z = String(zone).trim()
  if (!z) return 'null'
  const lower = z.toLowerCase()
  for (const [re, canonical] of ZONE_CANONICAL) {
    if (re.test(lower)) return canonical
  }
  return normalizeKey(z)
}

// ── Product/material name key normalization (R-F-norm1) ───────────────────────
// Strips leading Polish type-prefix words, format dimensions, and unit suffixes
// from product/material names before building the group key.
// Prevents false splits when one source includes the format or type prefix
// in the name string and another omits it.
//
// Examples that collapse to the same key:
//   "Płytki Cifre Reload White 120x120" → "cifre_reload_white"
//   "Cifre Reload White"                 → "cifre_reload_white"  ← same group
//
//   "farba Beckers Perfect White 10L" → "beckers_perfect_white"
//   "Beckers Perfect White"            → "beckers_perfect_white" ← same group
//
// The format field is still checked in CONFLICT_FIELDS — genuine format
// discrepancies will surface as an explicit conflict within the merged group.

// Leading type prefix words that AI commonly prepends to product names.
// Matched after toLowerCase() — only unambiguous, high-frequency Polish words.
const PRODUCT_TYPE_PREFIX_RE = /^(?:p[łl]ytki?|kafelki?|kafle?|gres|terakot[ay]?|farb[ay]?|emulsj[ay]?|tynk|szpachl[ay]?|ok[łl]adzin[ay]?|p[łl]yta)\s+/

// Dimension pattern: "120x120", "60 x 60", "120×60 cm"
const PRODUCT_FORMAT_DIM_RE = /\b\d+\s*[x×]\s*\d+\s*(?:cm|mm)?\b/g

// Unit suffix: "10L", "5 kg", "12 mb", "2 szt"
const PRODUCT_UNIT_SUFFIX_RE = /\b\d+\s*(?:l|kg|m2|m²|szt|mb|pcs)\b/g

function normalizeProductKey(name: unknown): string {
  if (name == null) return ''
  const lower = String(name).toLowerCase()
  const stripped = lower
    .replace(PRODUCT_TYPE_PREFIX_RE, '')
    .replace(PRODUCT_FORMAT_DIM_RE,  '')
    .replace(PRODUCT_UNIT_SUFFIX_RE, '')
    .trim()
  return normalizeKey(stripped)
}

function shortHash(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 8)
}

/**
 * R-F1: Compute the group key for a fusible evidence item.
 * Returns null for pass-through types.
 */
function computeGroupKey(row: EvidenceRow): string | null {
  const room = row.room_label ?? 'null'
  const c = row.content

  switch (row.evidence_type) {
    case 'fixture': {
      const name = normalizeKey(c.name)
      if (!name) return null
      return `fixture:${room}:${name}`
    }
    case 'tile_spec': {
      const product = normalizeProductKey(c.product)   // R-F-norm1: strip prefix/format/units
      const zone    = normalizeZone(c.zone)             // R-F-norm2: canonical zone
      if (!product) return null
      return `tile_spec:${room}:${product}:${zone}`
    }
    case 'material': {
      const name = normalizeProductKey(c.name)          // R-F-norm1: strip prefix/format/units
      const zone = normalizeZone(c.zone)                // R-F-norm2: canonical zone
      if (!name) return null
      return `material:${room}:${name}:${zone}`
    }
    case 'installation': {
      const type  = normalizeKey(c.type)
      const layer = normalizeKey(c.layer)
      return `installation:${room}:${type}:${layer}`
    }
    default:
      return null
  }
}

/**
 * R-F6: When multiple tile_spec items are in the same group,
 * prefer the one whose source_anchor contains "zestawienie" (R-26 gold truth).
 * Returns negative if `a` wins, positive if `b` wins, 0 = tie.
 */
function compareAuthority(
  a: EvidenceRow, b: EvidenceRow,
  priorityMap: AssetPriorityMap,
): number {
  // R-26: zestawienie beats rzut even at same asset priority
  if (a.evidence_type === 'tile_spec') {
    const aSpec = /zestawienie/i.test(a.source_anchor ?? '')
    const bSpec = /zestawienie/i.test(b.source_anchor ?? '')
    if (aSpec && !bSpec) return -1
    if (!aSpec && bSpec) return 1
  }
  const aPri = priorityMap[a.asset_id] ?? 50
  const bPri = priorityMap[b.asset_id] ?? 50
  return aPri - bPri  // lower priority number = more authoritative
}

/**
 * R-F3: Detect conflicts for key numeric and string fields.
 * Returns populated FusedConflict[] if any field differs beyond threshold.
 */
function detectConflicts(
  rows: EvidenceRow[],
  winner: EvidenceRow,
  priorityMap: AssetPriorityMap,
  conflictFields: string[],
): FusedConflict[] {
  const conflicts: FusedConflict[] = []

  for (const field of conflictFields) {
    const allValues = rows
      .filter(r => r.content[field] != null && r.confidence_score > 0.5)
      .map(r => ({
        value:         r.content[field],
        source_anchor: r.source_anchor,
        asset_id:      r.asset_id,
        confidence:    r.confidence_score,
      }))

    if (allValues.length < 2) continue

    // Check if values meaningfully differ
    const winnerVal  = winner.content[field]
    const differing  = allValues.filter(v => {
      if (typeof v.value === 'number' && typeof winnerVal === 'number') {
        // Numeric: flag if >5% difference
        return Math.abs(v.value - winnerVal) / (Math.abs(winnerVal) || 1) > 0.05
      }
      return String(v.value).toLowerCase() !== String(winnerVal).toLowerCase()
    })

    if (differing.length === 0) continue

    const winnerPri = priorityMap[winner.asset_id] ?? 50
    // Unresolved only if all involved items share same source_priority
    const allSamePri = allValues.every(v => (priorityMap[v.asset_id] ?? 50) === winnerPri)

    conflicts.push({
      field,
      values: allValues,
      resolution: allSamePri ? 'unresolved' : 'highest_priority',
      resolved_value: winnerVal ?? null,
    })
  }

  return conflicts
}

// Conflict fields to check, per evidence_type
// R-F-hard-1: installation.description added — different descriptions of same
// electrical/plumbing layer in same room = meaningful scope discrepancy.
const CONFLICT_FIELDS: Record<string, string[]> = {
  fixture:      ['dims', 'quantity'],
  tile_spec:    ['area_netto', 'format', 'waste_multi'],
  material:     ['area_netto', 'format'],
  installation: ['type', 'layer', 'description'],
}

// Subject display label, per evidence_type
function extractSubject(type: string, c: Record<string, unknown>): string {
  switch (type) {
    case 'fixture':      return String(c.name      ?? '–')
    case 'tile_spec':    return String(c.product   ?? '–')
    case 'material':     return String(c.name      ?? '–')
    case 'installation': return `${String(c.type ?? '?')} / ${String(c.layer ?? '?')}`
    default:             return '–'
  }
}

function extractCategory(type: string, c: Record<string, unknown>): string | null {
  switch (type) {
    case 'fixture':      return String(c.category ?? '') || null
    case 'material':     return String(c.category ?? '') || null
    case 'installation': return String(c.type     ?? '') || null
    default:             return null
  }
}

function extractZone(type: string, c: Record<string, unknown>): string | null {
  if (type === 'tile_spec' || type === 'material') return String(c.zone ?? '') || null
  return null
}

// ── Main fusion function ────────────────────────────────────────────────────────

/**
 * Fusion Skeleton v1.
 * Pure function — no I/O, no DB writes.
 */
export function runFusion(
  bundleId:     string,
  rows:         EvidenceRow[],
  priorityMap:  AssetPriorityMap,
  qrRows:       QuestionRiskRow[],
): FusedBundleOutput {
  const fusedAt = new Date().toISOString()

  // ─── 1. Partition: fusible vs pass-through ──────────────────────────────────
  const fusibleRows:     EvidenceRow[] = []
  const passthroughRows: EvidenceRow[] = []

  for (const row of rows) {
    if (FUSIBLE_TYPES.has(row.evidence_type)) {
      fusibleRows.push(row)
    } else if (PASSTHROUGH_TYPES.has(row.evidence_type)) {
      passthroughRows.push(row)
    }
    // evidence_type:'conflict' is intentionally skipped in v1
  }

  // ─── 2. Group fusible rows by group key ────────────────────────────────────
  const groups = new Map<string, EvidenceRow[]>()
  const ungrouped: EvidenceRow[] = []

  for (const row of fusibleRows) {
    const key = computeGroupKey(row)
    if (!key) { ungrouped.push(row); continue }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  // ─── 3. Merge each group into a FusedScopeCandidate ───────────────────────
  const candidates: FusedScopeCandidate[] = []
  let totalConflicts = 0

  for (const [groupKey, groupRows] of groups) {
    // Sort by authority: winner is first
    const sorted = [...groupRows].sort((a, b) => compareAuthority(a, b, priorityMap))
    const winner = sorted[0]
    const cPayload = { ...winner.content }

    // Detect conflicts (only when >1 items in group)
    const conflicts: FusedConflict[] = groupRows.length > 1
      ? detectConflicts(groupRows, winner, priorityMap, CONFLICT_FIELDS[winner.evidence_type] ?? [])
      : []
    totalConflicts += conflicts.length

    const dedupeAnchors = [...new Set(
      groupRows.map(r => r.source_anchor).filter((a): a is string => !!a)
    )]

    const candidateId = shortHash(groupKey)

    candidates.push({
      id:                    candidateId,
      evidence_type:         winner.evidence_type as FusedScopeCandidate['evidence_type'],
      room_label:            winner.room_label,
      category:              extractCategory(winner.evidence_type, winner.content),
      subject:               extractSubject(winner.evidence_type, winner.content),
      zone:                  extractZone(winner.evidence_type, winner.content),
      confidence:            Math.max(...groupRows.map(r => r.confidence_score)),
      merged_from_count:     groupRows.length,
      evidence_ids:          groupRows.map(r => r.id),
      source_anchors:        dedupeAnchors,
      conflicts,
      // populated in post-merge pass below
      category_peer_conflict: false,
      category_peer_ids:      [],
      peer_conflict_type:     null,
      linked_dimensions:      [],
      linked_scope_hints:     [],
      payload:               cPayload,
    })
  }

  // Ungroupable fusible rows become pass-through
  for (const row of ungrouped) {
    passthroughRows.push(row)
  }

  // ─── 3b. R-F-peer2: Category peer conflict detection ──────────────────────
  // After all groups are formed, scan for candidates that share
  // room_label + evidence_type + category but have different subjects.
  // For fixtures: if both resolve to DIFFERENT canonical types (toilet vs shower)
  // they legitimately coexist — skip. Only flag when same canonical type or
  // canonical type is unresolvable (fallback to category check).
  for (let i = 0; i < candidates.length; i++) {
    const ca = candidates[i]
    if (!ca.category) continue   // no category = can't do peer check
    for (let j = i + 1; j < candidates.length; j++) {
      const cb = candidates[j]
      if (!cb.category) continue
      if (
        ca.evidence_type === cb.evidence_type &&
        ca.room_label    === cb.room_label    &&
        ca.category      === cb.category      &&
        ca.id            !== cb.id
      ) {
        // R-F-peer2: For fixtures, use canonical type to avoid false positives.
        // Different canonical types (toilet + shower) = coexistence_ok → suppress.
        if (ca.evidence_type === 'fixture') {
          const typeA = getCanonicalFixtureType(ca.subject)
          const typeB = getCanonicalFixtureType(cb.subject)
          if (typeA !== null && typeB !== null && typeA !== typeB) {
            // Coexistence OK — different fixture functions in same room. Skip.
            continue
          }
        }
        // Mutual flagging — same type or unresolvable
        ca.category_peer_conflict = true
        cb.category_peer_conflict = true
        ca.peer_conflict_type = 'peer_review_needed'
        cb.peer_conflict_type = 'peer_review_needed'
        if (!ca.category_peer_ids.includes(cb.id)) ca.category_peer_ids.push(cb.id)
        if (!cb.category_peer_ids.includes(ca.id)) cb.category_peer_ids.push(ca.id)
        totalConflicts++
      }
    }
  }

  // ─── 3c. R-F-enrich-dim + R-F-enrich-scope: Link pass-through to candidates ─
  // Attach dimension and scope_hint pass-through items to fused candidates that
  // share the same non-null room_label.
  //
  // Safety rule: only link when room_label is non-null on BOTH sides.
  // missing_data and hypothesis remain global (room_label often null, subject
  // overlap matching too unreliable without text similarity).
  const dimensionRows  = passthroughRows.filter(r => r.evidence_type === 'dimension'  && r.room_label)
  const scopeHintRows  = passthroughRows.filter(r => r.evidence_type === 'scope_hint' && r.room_label)

  for (const candidate of candidates) {
    if (!candidate.room_label) continue

    // Link dimensions in the same room
    for (const row of dimensionRows) {
      if (row.room_label !== candidate.room_label) continue
      const dim: LinkedDimension = {
        source_id:     row.id,
        subject:       String(row.content.subject ?? row.content.name ?? '') || null,
        unit:          String(row.content.unit   ?? '') || null,
        value:         typeof row.content.value === 'number' ? row.content.value : null,
        source_anchor: row.source_anchor,
      }
      candidate.linked_dimensions.push(dim)
    }

    // Link scope_hints in the same room
    for (const row of scopeHintRows) {
      if (row.room_label !== candidate.room_label) continue
      const hint: LinkedScopeHint = {
        source_id:     row.id,
        category:      String(row.content.category ?? '') || null,
        unit:          String(row.content.unit     ?? '') || null,
        priority:      String(row.content.priority ?? '') || null,
        note:          String(row.content.note ?? row.content.text ?? '') || null,
        source_anchor: row.source_anchor,
      }
      candidate.linked_scope_hints.push(hint)
    }
  }

  // ─── 4. Pass-through items ────────────────────────────────────────────────
  const passthroughItems: PassthroughItem[] = passthroughRows.map(row => ({
    id:            row.id,
    evidence_type: row.evidence_type,
    room_label:    row.room_label,
    source_anchor: row.source_anchor,
    confidence:    row.confidence_score,
    payload:       { ...row.content },
  }))

  // ─── 5. Questions & risks ────────────────────────────────────────────────
  const questions: FusedQuestion[] = []
  const risks:     FusedRisk[]     = []
  const seenQIds   = new Set<string>()
  const seenRTexts = new Set<string>()

  for (const qr of qrRows) {
    const c = qr.content
    if (qr.entry_type === 'question') {
      const id   = String(c.id ?? shortHash(String(c.text ?? '')))
      const text = String(c.text ?? '')
      if (!text || seenQIds.has(id)) continue
      seenQIds.add(id)
      questions.push({
        id,
        text,
        priority: (c.priority as FusedQuestion['priority']) ?? 'optional',
        rule:     c.rule as string | null ?? null,
        evidence_ids: [],
      })
    } else if (qr.entry_type === 'risk') {
      const desc = String(c.description ?? '')
      if (!desc || seenRTexts.has(desc)) continue
      seenRTexts.add(desc)
      risks.push({
        description:  desc,
        severity:     (c.severity as FusedRisk['severity']) ?? 'low',
        rule:         c.rule as string | null ?? null,
        evidence_ids: [],
      })
    }
  }

  // ─── 6. Stats ─────────────────────────────────────────────────────────────
  const allRoomsRaw = rows.map(r => r.room_label).filter((r): r is string => !!r)
  const roomsFound  = [...new Set(allRoomsRaw)]
  const typesProcessed = [...new Set(rows.map(r => r.evidence_type))]

  const stats: FusionStats = {
    input_evidence_count: rows.length,
    fusible_count:        fusibleRows.length,
    passthrough_count:    passthroughRows.length,
    merged_groups:        candidates.length,
    conflict_count:       totalConflicts,
    null_room_count:      rows.filter(r => !r.room_label).length,
    rooms_found:          roomsFound,
    types_processed:      typesProcessed,
  }

  return {
    bundle_id:              bundleId,
    fused_at:               fusedAt,
    fused_scope_candidates: candidates,
    passthrough_items:      passthroughItems,
    fused_questions:        questions,
    fused_risks:            risks,
    stats,
  }
}
