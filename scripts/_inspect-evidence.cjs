// scripts/_inspect-evidence.cjs
// Shows full evidence detail for the last N ai_extraction_results per asset
// Usage: node scripts/_inspect-evidence.cjs [bundle_id]
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const eq = l.indexOf('=')
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
})
const sb = createClient(
  env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const COMPANY_ID = 'eff93f68-1fdd-4c60-bc71-1d9bc2a88d9a'

async function main() {
  // Get last 3 completed bundles
  const { data: bundles } = await sb
    .from('ai_analysis_bundles')
    .select('id, status, asset_count, extracted_count, created_at')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('Recent bundles:')
  bundles?.forEach(b => console.log(`  ${b.id} | ${b.status} | ${b.asset_count} assets | ${b.extracted_count} extracted | ${b.created_at}`))

  // For the target bundles (most recent), fetch all assets + evidence
  const targetBundleIds = process.argv[2]
    ? [process.argv[2]]
    : (bundles || []).slice(0, 2).map(b => b.id)

  for (const bundleId of targetBundleIds) {
    console.log(`\n${'═'.repeat(72)}`)
    console.log(`BUNDLE: ${bundleId}`)

    const { data: assets } = await sb
      .from('ai_bundle_assets')
      .select('id, original_filename, source_role, layer_type, extraction_status, processing_error')
      .eq('bundle_id', bundleId)
      .order('source_priority', { ascending: true })

    for (const asset of (assets || [])) {
      console.log(`\n  📄 ${asset.original_filename}`)
      console.log(`     role: ${asset.source_role} | layer: ${asset.layer_type} | status: ${asset.extraction_status}`)
      if (asset.processing_error) console.log(`     ❌ error: ${asset.processing_error}`)

      const { data: ev } = await sb
        .from('ai_extraction_results')
        .select('evidence_type, room_label, confidence_score, confidence_reason, source_anchor, content')
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: true })

      if (!ev?.length) { console.log('     (no evidence)'); continue }

      ev.forEach((e, i) => {
        const c = e.content || {}
        console.log(`\n     [${i + 1}] ${e.evidence_type} | room: ${e.room_label ?? '–'} | confidence: ${e.confidence_score}`)
        console.log(`         anchor:  "${e.source_anchor}"`)
        console.log(`         reason:  "${e.confidence_reason}"`)

        // Print type-specific payload fields (non-null only)
        const skip = new Set(['evidence_type', 'room_label', 'confidence_score', 'confidence_reason', 'source_anchor'])
        const payload = Object.entries(c).filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined)
        payload.forEach(([k, v]) => console.log(`         ${k}: ${JSON.stringify(v)}`))
      })
    }

    // Questions & risks
    const { data: qs } = await sb
      .from('ai_questions_risks')
      .select('entry_type, content')
      .eq('bundle_id', bundleId)
      .order('created_at', { ascending: true })

    if (qs?.length) {
      console.log(`\n  Questions/Risks:`)
      qs.forEach(q => {
        const c = q.content || {}
        console.log(`  [${q.entry_type}] ${c.text || c.description} (${c.priority || c.severity})`)
      })
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
