// scripts/_test-fusion.cjs
// Runs Fusion Skeleton v1 on the most recent bundle and prints results.
//
// Usage: node scripts/_test-fusion.cjs [bundle_id]
//        (omit bundle_id to use the latest bundle)

const { buildSync } = require('esbuild')
const path = require('path')
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const eq = l.indexOf('=')
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
})
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const COMPANY_ID   = 'eff93f68-1fdd-4c60-bc71-1d9bc2a88d9a'

const sb = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Compile fusion engine (not the Netlify handler — call engine directly)
const outFile = path.resolve('./_test_fusion_engine.cjs')
buildSync({
  entryPoints: ['src/services/ai/composite/fusion.engine.ts'],
  bundle: true, platform: 'node', target: 'node20', format: 'cjs', outfile: outFile,
  absWorkingDir: process.cwd(),
})
const { runFusion } = require(outFile)

async function main() {
  const targetBundleId = process.argv[2] ?? null

  // Get bundle ID
  let bundleId
  if (targetBundleId) {
    bundleId = targetBundleId
  } else {
    const { data } = await sb
      .from('ai_analysis_bundles')
      .select('id, status, asset_count, extracted_count, created_at')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(5)
    console.log('Recent bundles:')
    data?.forEach(b => console.log(`  ${b.id} | ${b.status} | ${b.extracted_count}/${b.asset_count} extracted | ${b.created_at.slice(0, 19)}`))
    bundleId = data?.[0]?.id
    if (!bundleId) { console.error('No bundles found'); process.exit(1) }
    console.log(`\nUsing: ${bundleId}\n`)
  }

  // Fetch assets
  const { data: assets } = await sb
    .from('ai_bundle_assets')
    .select('id, source_priority, original_filename, source_role, layer_type')
    .eq('bundle_id', bundleId)

  const priorityMap = {}
  for (const a of assets ?? []) { priorityMap[a.id] = a.source_priority ?? 50 }

  console.log('Assets:')
  for (const a of assets ?? []) {
    console.log(`  [${a.source_priority}] ${a.original_filename} (${a.source_role})`)
  }

  // Fetch evidence
  const { data: ev } = await sb
    .from('ai_extraction_results')
    .select('id, evidence_type, room_label, confidence_score, source_anchor, asset_id, content')
    .eq('bundle_id', bundleId)
    .order('created_at', { ascending: true })

  const rows = (ev ?? []).map(r => ({
    id: r.id, evidence_type: r.evidence_type,
    room_label: r.room_label, confidence_score: r.confidence_score ?? 0,
    source_anchor: r.source_anchor, asset_id: r.asset_id,
    content: r.content ?? {},
  }))

  // Fetch questions / risks
  const { data: qr } = await sb
    .from('ai_questions_risks')
    .select('id, entry_type, content')
    .eq('bundle_id', bundleId)

  const qrRows = (qr ?? []).map(r => ({ id: r.id, entry_type: r.entry_type, content: r.content ?? {} }))

  // Run fusion
  const t0    = Date.now()
  const fused = runFusion(bundleId, rows, priorityMap, qrRows)
  const ms    = Date.now() - t0

  // ── Print results ──
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  FUSION SKELETON v1 — OUTPUT                                   ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝\n')

  const s = fused.stats
  console.log(`  Input evidence:   ${s.input_evidence_count}`)
  console.log(`  Fusible:          ${s.fusible_count} → ${s.merged_groups} merged groups`)
  console.log(`  Pass-through:     ${s.passthrough_count}`)
  console.log(`  Conflicts:        ${s.conflict_count}`)
  console.log(`  Null room:        ${s.null_room_count}`)
  console.log(`  Rooms found:      ${s.rooms_found.join(', ') || '(none)'}`)
  console.log(`  Types seen:       ${s.types_processed.join(', ')}`)
  console.log(`  Fusion time:      ${ms}ms\n`)

  console.log('── FUSED SCOPE CANDIDATES ──────────────────────────────────────────')
  if (fused.fused_scope_candidates.length === 0) {
    console.log('  (none)')
  }
  for (const c of fused.fused_scope_candidates) {
    const conflictTag = c.conflicts.length > 0 ? ` ⚠️ ${c.conflicts.length} conflict(s)` : ''
    const mergeTag    = c.merged_from_count > 1  ? ` [merged ${c.merged_from_count}]` : ''
    console.log(`\n  [${c.id}] ${c.evidence_type.toUpperCase()} | room: ${c.room_label ?? 'null'}${mergeTag}${conflictTag}`)
    console.log(`         subject:  "${c.subject}"`)
    if (c.zone)     console.log(`         zone:     "${c.zone}"`)
    if (c.category) console.log(`         category: "${c.category}"`)
    console.log(`         conf:     ${c.confidence}`)
    console.log(`         anchors:  ${c.source_anchors.length > 0 ? c.source_anchors.map(a => `"${a}"`).join('\n                   ') : '(none)'}`)

    if (c.conflicts.length > 0) {
      for (const cf of c.conflicts) {
        console.log(`         CONFLICT field="${cf.field}" resolution="${cf.resolution}"`)
        for (const v of cf.values) {
          const tag = v.value === cf.resolved_value ? ' ← winner' : ''
          console.log(`           • ${JSON.stringify(v.value)} (conf:${v.confidence}) [${v.source_anchor?.split(' | ').slice(0,2).join(' | ') ?? '–'}]${tag}`)
        }
      }
    }

    // Key payload fields
    const p = c.payload
    const fields = Object.entries(p).filter(([, v]) => v != null && v !== '' && v !== false)
    fields.forEach(([k, v]) => console.log(`         ${k}: ${JSON.stringify(v)}`))

    // Enrichment links (R-F-enrich-dim + R-F-enrich-scope)
    if (c.linked_dimensions?.length > 0) {
      console.log(`         📐 linked_dimensions (${c.linked_dimensions.length}):`)
      for (const d of c.linked_dimensions) {
        console.log(`            \u2022 ${d.subject ?? '?'} \u2014 ${d.value} ${d.unit ?? ''} [${d.match_strength ?? '?'}]`)
      }
    }
    if (c.linked_scope_hints?.length > 0) {
      console.log(`         💡 linked_scope_hints (${c.linked_scope_hints.length}):`)
      for (const h of c.linked_scope_hints) {
        console.log(`            \u2022 cat:${h.category ?? '?'} unit:${h.unit ?? '?'} prio:${h.priority ?? '?'} [${h.match_strength ?? '?'}]`)
      }
    }
  }

  console.log('\n── PASS-THROUGH ITEMS ──────────────────────────────────────────────')
  for (const pt of fused.passthrough_items) {
    console.log(`  [${pt.evidence_type}] room:${pt.room_label ?? 'null'} | conf:${pt.confidence}`)
    const fields = Object.entries(pt.payload).filter(([, v]) => v != null && v !== '' && v !== false)
    const brief = fields.slice(0, 3).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
    if (brief) console.log(`         ${brief}`)
  }

  if (fused.fused_questions.length > 0) {
    console.log('\n── QUESTIONS ───────────────────────────────────────────────────────')
    for (const q of fused.fused_questions) {
      console.log(`  [${q.priority}] ${q.text}`)
    }
  }

  if (fused.fused_risks.length > 0) {
    console.log('\n── RISKS ───────────────────────────────────────────────────────────')
    for (const r of fused.fused_risks) {
      console.log(`  [${r.severity}] ${r.description}`)
    }
  }

  fs.unlinkSync(outFile)
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1) })
