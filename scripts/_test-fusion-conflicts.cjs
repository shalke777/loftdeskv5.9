// scripts/_test-fusion-conflicts.cjs
// In-memory conflict test harness for Fusion Skeleton v1.
// No DB required — runs runFusion() with handcrafted conflicting rows.
//
// Scenarios:
//   S1. Same fixture, same name, different dims → expect merge + conflict on dims
//   S2. Same tile_spec: render low-conf area vs zestawienie high-conf area → conflict, zestawienie wins (R-26)
//   S3. Same installation type+layer, different description → conflict on description (R-F-hard-1)
//   S4. Same room, same category 'prysznic', different fixture names → peer_review_needed (both showers)
//   S5. Same room, same category 'armatura łazienkowa', WC + prysznic → coexistence_ok (NO peer flag)
//   S6. Same room, same canonical type 'shower', prysznic + kabina walk-in → peer_review_needed

const { buildSync } = require('esbuild')
const path = require('path')
const fs   = require('fs')

const outFile = path.resolve('./_test_fusion_conflicts.cjs')
buildSync({
  entryPoints: ['src/services/ai/composite/fusion.engine.ts'],
  bundle: true, platform: 'node', target: 'node20', format: 'cjs', outfile: outFile,
  absWorkingDir: process.cwd(),
})
const { runFusion } = require(outFile)

// ── Asset priority map ───────────────────────────────────────────────────────
// asset_tech  = technical drawing, priority 10 (most authoritative)
// asset_spec  = zestawienie specification, priority 8
// asset_vis   = visualization render, priority 30 (least authoritative)
const PRIORITY_MAP = {
  asset_tech: 10,
  asset_spec: 8,
  asset_vis:  30,
}

// ── Scenario rows ────────────────────────────────────────────────────────────

// S1: Brodzik — same name, different dims
const S1 = [
  {
    id: 's1-tech', evidence_type: 'fixture', room_label: 'łazienka',
    confidence_score: 0.90, asset_id: 'asset_tech',
    source_anchor: 'rzut_łazienki.pdf | str:1 | A-01 | Rzut łazienki | brodzik',
    content: { name: 'brodzik Cifre Reload White', category: 'brodzik', dims: '80x140', quantity: 1, confirmed: true },
  },
  {
    id: 's1-vis', evidence_type: 'fixture', room_label: 'łazienka',
    confidence_score: 0.75, asset_id: 'asset_vis',
    source_anchor: 'render_łazienki.jpg | render | brodzik | widok_frontowy',
    content: { name: 'brodzik Cifre Reload White', category: 'brodzik', dims: '70x140', quantity: 1, confirmed: false },
  },
]

// S2: tile_spec — render vs zestawienie, different area_netto
const S2 = [
  {
    id: 's2-vis',  evidence_type: 'tile_spec', room_label: 'łazienka',
    confidence_score: 0.65, asset_id: 'asset_vis',
    source_anchor: 'render_łazienki.jpg | render | płytki Cifre | widok_ściana',
    content: { product: 'Cifre Reload White 120x120', format: '120x120', area_netto: 14.0, waste_multi: 1.1, zone: 'ściany' },
  },
  {
    id: 's2-spec', evidence_type: 'tile_spec', room_label: 'łazienka',
    confidence_score: 0.95, asset_id: 'asset_spec',
    source_anchor: 'zestawienie.pdf | str:2 | – | ZESTAWIENIE POWIERZCHNI | Cifre Reload White',
    content: { product: 'Cifre Reload White 120x120', format: '120x120', area_netto: 15.56, waste_multi: 1.1, zone: 'ściany' },
  },
]

// S3: Installation same type+layer, different description — SILENT weakness
const S3 = [
  {
    id: 's3-tech', evidence_type: 'installation', room_label: 'łazienka',
    confidence_score: 0.85, asset_id: 'asset_tech',
    source_anchor: 'rzut_instalacji.pdf | str:1 | I-01 | Rzut elektryczny | obwód_łazienka',
    content: { type: 'electrical', layer: 'separate_layer', description: 'obwód 16A gniazdo + ogrzewanie podłogowe' },
  },
  {
    id: 's3-vis', evidence_type: 'installation', room_label: 'łazienka',
    confidence_score: 0.60, asset_id: 'asset_vis',
    source_anchor: 'notatka.txt | text | instalacja elektryczna | łazienka',
    content: { type: 'electrical', layer: 'separate_layer', description: 'standardowy obwód łazienka' },
  },
]

// S4: Same room + same category 'prysznic', different fixture names (both showers) → peer_review_needed
const S4 = [
  {
    id: 's4-tech', evidence_type: 'fixture', room_label: 'łazienka',
    confidence_score: 0.90, asset_id: 'asset_tech',
    source_anchor: 'rzut_łazienki.pdf | str:1 | A-01 | Rzut łazienki | prysznic',
    content: { name: 'prysznic walk-in Villeroy & Boch', category: 'prysznic', dims: '90x90', quantity: 1, confirmed: true },
  },
  {
    id: 's4-vis', evidence_type: 'fixture', room_label: 'łazienka',
    confidence_score: 0.70, asset_id: 'asset_vis',
    source_anchor: 'render_łazienki.jpg | render | kabina prysznicowa | widok_boczny',
    content: { name: 'kabina walk-in Grohe bezprogowa', category: 'prysznic', dims: '80x90', quantity: 1, confirmed: false },
  },
]

// S5: WC + prysznic in same room, both category 'armatura łazienkowa'
// → different canonical types (toilet vs shower) → coexistence_ok → NO peer conflict flag
const S5 = [
  {
    id: 's5-wc', evidence_type: 'fixture', room_label: 'łazienka',
    confidence_score: 0.90, asset_id: 'asset_tech',
    source_anchor: 'rzut_łazienki.pdf | str:1 | A-01 | Rzut łazienki | wc',
    content: { name: 'WC wiszące Geberit Acanto', category: 'armatura łazienkowa', dims: '35x54', quantity: 1 },
  },
  {
    id: 's5-prysznic', evidence_type: 'fixture', room_label: 'łazienka',
    confidence_score: 0.88, asset_id: 'asset_tech',
    source_anchor: 'rzut_łazienki.pdf | str:1 | A-01 | Rzut łazienki | prysznic',
    content: { name: 'prysznic walk-in Hansgrohe', category: 'armatura łazienkowa', dims: '90x90', quantity: 1 },
  },
]

// S6: Two different shower descriptions in same room, same category
// → same canonical type (shower) → peer_review_needed
const S6 = [
  {
    id: 's6-a', evidence_type: 'fixture', room_label: 'łazienka master',
    confidence_score: 0.90, asset_id: 'asset_tech',
    source_anchor: 'rzut_łazienki-master.pdf | str:1 | A-02 | Rzut en-suite | prysznic',
    content: { name: 'prysznic narożny Hansgrohe Raindance', category: 'armatura łazienkowa', dims: '90x90', quantity: 1 },
  },
  {
    id: 's6-b', evidence_type: 'fixture', room_label: 'łazienka master',
    confidence_score: 0.75, asset_id: 'asset_vis',
    source_anchor: 'render_mastersuite.jpg | render | kabina prysznicowa | widok_front',
    content: { name: 'kabina prysznicowa Kermi Walk-In', category: 'armatura łazienkowa', dims: '100x90', quantity: 1 },
  },
]

const ALL_ROWS = [...S1, ...S2, ...S3, ...S4]

// ── Run fusion ───────────────────────────────────────────────────────────────
const fused = runFusion('test-bundle', ALL_ROWS, PRIORITY_MAP, [])

// ── Print results ────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════════╗')
console.log('║  FUSION CONFLICT TEST — BEFORE HARDENING                       ║')
console.log('╚══════════════════════════════════════════════════════════════════╝\n')

const s = fused.stats
console.log(`  Input:    ${s.input_evidence_count} rows`)
console.log(`  Groups:   ${s.merged_groups}`)
console.log(`  Conflicts: ${s.conflict_count}`)
console.log()

function checkScenario(tag, expectMerge, expectConflictField, notes) {
  console.log(`─── ${tag} ─────────────────────────────────────────────────────────`)
  console.log(`    notes: ${notes}`)

  const candidates = fused.fused_scope_candidates
  const passthrough = fused.passthrough_items

  console.log(`    candidates: ${candidates.length}   pass-through: ${passthrough.length}`)

  for (const c of candidates) {
    const mergeTag = c.merged_from_count > 1 ? ` [merged ${c.merged_from_count}]` : ''
    const conflictTag = c.conflicts.length > 0
      ? ` ⚠️ conflicts: ${c.conflicts.map(cf => cf.field + '(' + cf.resolution + ')').join(', ')}`
      : ' (no conflicts)'
    console.log(`    [${c.id}] ${c.evidence_type} | room:${c.room_label}${mergeTag}${conflictTag}`)
    console.log(`           subject: "${c.subject}"`)
    if (c.conflicts.length > 0) {
      for (const cf of c.conflicts) {
        console.log(`           CONFLICT field="${cf.field}": ${cf.values.map(v => `${JSON.stringify(v.value)} (${v.asset_id})`).join(' vs ')}`)
        console.log(`           → resolved_value: ${JSON.stringify(cf.resolved_value)} via ${cf.resolution}`)
      }
    }
    // category_peer_conflict if present
    if ('category_peer_conflict' in c && c.category_peer_conflict) {
      console.log(`           PEER CONFLICT ⚡ (same room+category in another group): ${c.category_peer_ids?.join(', ')}`)
    }
  }
  console.log()
}

// Run per scenario by building separate bundles
function runScenario(tag, rows, expectConflictField, notes) {
  const result = runFusion('test-bundle', rows, PRIORITY_MAP, [])
  const s = result.stats
  console.log(`─── ${tag} ─────────────────────────────────────────────────────────`)
  console.log(`    ${notes}`)
  console.log(`    input: ${s.input_evidence_count} | groups: ${s.merged_groups} | conflicts: ${s.conflict_count}`)

  for (const c of result.fused_scope_candidates) {
    const mergeTag = c.merged_from_count > 1 ? `[merged ${c.merged_from_count}]` : '[single]'
    const peers = 'category_peer_conflict' in c && c.category_peer_conflict ? ` PEER⚡(${c.category_peer_ids?.join(',')})` : ''
    const conflictList = c.conflicts.length > 0
      ? ' CONFLICTS: ' + c.conflicts.map(cf =>
          `  ${cf.field}: ${cf.values.map(v => `${JSON.stringify(v.value)}`).join(' vs ')} → winner:${JSON.stringify(cf.resolved_value)} [${cf.resolution}]`
        ).join('; ')
      : ' (no conflicts)'
    console.log(`    ${mergeTag} ${c.evidence_type} room:${c.room_label} "${c.subject}" conf:${c.confidence}`)
    if (c.conflicts.length > 0) {
      c.conflicts.forEach(cf => {
        console.log(`      ⚠️  ${cf.field}: ${cf.values.map(v => JSON.stringify(v.value) + '@' + v.asset_id).join(' vs ')} → winner ${JSON.stringify(cf.resolved_value)} (${cf.resolution})`)
      })
    }
    if ('category_peer_conflict' in c && c.category_peer_conflict) {
      console.log(`      ⚡ category_peer: ids=[${c.category_peer_ids?.join(', ')}]`)
    }
    if (peers && !('category_peer_conflict' in c)) {
      console.log(`      [no peer detection yet]`)
    }
  }

  // Expected check
  const hasExpectedConflict = expectConflictField
    ? result.fused_scope_candidates.some(c => c.conflicts.some(cf => cf.field === expectConflictField))
    : true
  const iconExpect = hasExpectedConflict ? '✅' : '❌'
  const iconPeer   = expectConflictField === 'PEER'
    ? (result.fused_scope_candidates.some(c => c.category_peer_conflict) ? '✅' : '❌')
    : null

  if (expectConflictField === 'MERGE') {
    const hasMerge = result.fused_scope_candidates.some(c => c.merged_from_count > 1)
    console.log(`    EXPECTED: at least 1 merged group (merged_from_count>1) ${hasMerge ? '✅' : '❌'}`)
  } else if (expectConflictField === 'PEER') {
    const hasPeer = result.fused_scope_candidates.some(c => c.category_peer_conflict)
    console.log(`    EXPECTED: category_peer_conflict detected ${hasPeer ? '✅' : '❌'}`)
  } else if (expectConflictField === 'NO_PEER') {
    const hasPeer = result.fused_scope_candidates.some(c => c.category_peer_conflict)
    console.log(`    EXPECTED: NO peer_conflict (coexistence_ok) ${!hasPeer ? '✅' : '❌ (false positive!)'}`)
  } else if (expectConflictField) {
    console.log(`    EXPECTED: conflict on field "${expectConflictField}" ${iconExpect}`)
  }
  console.log()
  return result
}

console.log('\n️ ─── BEFORE hardening ─────────────────────────────────────────────\n')

runScenario('S1: fixture same name, different dims', S1, 'dims',
  'EXPECT: 1 merged group, conflict on dims, tech (priority 10) wins over vis (30)')

runScenario('S2: tile_spec render vs zestawienie area', S2, 'area_netto',
  'EXPECT: 1 merged group, conflict on area_netto, zestawienie wins via R-26 (str anchor)')

runScenario('S3: installation same type/layer, different description', S3, 'description',
  'EXPECT: conflict on description — currently SILENT (not in conflict_fields)')

runScenario('S4: fixture same category different name (peer coexistence)', S4, 'PEER',
  'EXPECT: 2 separate groups, peer_review_needed flagged (both showers)')

runScenario('S5: WC + prysznic same room (coexistence_ok — different canonical types)', S5, 'NO_PEER',
  'EXPECT: 2 separate groups, NO peer_conflict flag (toilet vs shower = coexistence_ok)')

runScenario('S6: two showers same room same category (peer_review_needed)', S6, 'PEER',
  'EXPECT: 2 separate groups, peer_review_needed flagged (both showers by canonical type)')

// ── S7–S9: R-F-norm1 + R-F-norm2 normalization scenarios ─────────────────────

// S7: Same tile_spec — render uses full name+format in string, zone "ściana"
//     zestawienie uses short name, zone "Ściany" (plural)
//     BEFORE R-F-norm1/2: two separate groups
//     AFTER:  one merged group + conflict on area_netto
const S7 = [
  {
    id: 's7-render', evidence_type: 'tile_spec', room_label: 'łazienka',
    confidence_score: 0.65, asset_id: 'asset_vis',
    source_anchor: 'render.jpg | render | tile | widok_sciana',
    content: { product: 'Płytki Cifre Reload White 120x120', format: '120x120', area_netto: 14.0, waste_multi: 1.1, zone: 'ściana' },
  },
  {
    id: 's7-spec', evidence_type: 'tile_spec', room_label: 'łazienka',
    confidence_score: 0.95, asset_id: 'asset_spec',
    source_anchor: 'zestawienie.pdf | str:2 | – | ZESTAWIENIE POWIERZCHNI | Cifre Reload White',
    content: { product: 'Cifre Reload White', format: '120x120', area_netto: 15.56, waste_multi: 1.1, zone: 'Ściany' },
  },
]

// S8: Same material — one source prepends type word "farba" and unit "10L",
//     the other uses clean brand name only.
//     BEFORE: two separate groups; AFTER: one merged group + conflict on area_netto
const S8 = [
  {
    id: 's8-vis', evidence_type: 'material', room_label: 'salon',
    confidence_score: 0.60, asset_id: 'asset_vis',
    source_anchor: 'render-salon.jpg | render | farba | kolor_biały',
    content: { name: 'farba Beckers Perfect White 10L', category: 'malowanie', area_netto: 25.0 },
  },
  {
    id: 's8-tech', evidence_type: 'material', room_label: 'salon',
    confidence_score: 0.85, asset_id: 'asset_tech',
    source_anchor: 'zestawienie_salon.pdf | str:3 | – | ZESTAWIENIE | Beckers Perfect White',
    content: { name: 'Beckers Perfect White', category: 'malowanie', area_netto: 27.5 },
  },
]

// S9: Same material, same name, zone "podłoga" vs "posadzka" (synonyms in Polish)
//     BEFORE: two separate groups; AFTER: one merged group + conflict on area_netto
const S9 = [
  {
    id: 's9-tech', evidence_type: 'material', room_label: 'łazienka',
    confidence_score: 0.85, asset_id: 'asset_tech',
    source_anchor: 'rzut_instalacji.pdf | str:1 | A-01 | Rzut | wylewka',
    content: { name: 'wylewka Ardex A 35', category: 'podłogi', area_netto: 12.0, zone: 'podłoga' },
  },
  {
    id: 's9-vis', evidence_type: 'material', room_label: 'łazienka',
    confidence_score: 0.65, asset_id: 'asset_vis',
    source_anchor: 'render.jpg | render | posadzka | Ardex',
    content: { name: 'wylewka Ardex A 35', category: 'podłogi', area_netto: 10.8, zone: 'posadzka' },
  },
]

runScenario('S7: tile_spec — type prefix + format in name + zone ściana vs Ściany', S7, 'area_netto',
  'EXPECT: 1 merged group (R-F-norm1+2), conflict on area_netto (14.0 vs 15.56)')

runScenario('S8: material — type prefix "farba" + unit suffix "10L" stripped', S8, 'area_netto',
  'EXPECT: 1 merged group (R-F-norm1), conflict on area_netto (25.0 vs 27.5)')

runScenario('S9: material — zone "podłoga" vs "posadzka" canonical (R-F-norm2)', S9, 'area_netto',
  'EXPECT: 1 merged group (R-F-norm2), conflict on area_netto (12.0 vs 10.8, >5% diff)')

fs.unlinkSync(outFile)
console.log('─────────────────────────────────────────────────────────────────────')
