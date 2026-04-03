// temp: find asset by filename pattern, then show existing evidence for it
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

const PATTERN = process.argv[2] || '%układ funkcjonalny%'

async function main() {
  const { data: assets, error } = await sb
    .from('ai_bundle_assets')
    .select('id, bundle_id, original_filename, extraction_status, source_role, created_at')
    .ilike('original_filename', PATTERN)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) { console.error('Query error:', error.message); process.exit(1) }
  if (!assets?.length) { console.log('No assets found for pattern:', PATTERN); process.exit(0) }

  console.log(`Found ${assets.length} asset(s):\n`)
  for (const a of assets) {
    console.log(`  id:       ${a.id}`)
    console.log(`  bundle:   ${a.bundle_id}`)
    console.log(`  file:     ${a.original_filename}`)
    console.log(`  role:     ${a.source_role}`)
    console.log(`  status:   ${a.extraction_status}`)
    console.log(`  created:  ${a.created_at}`)
    console.log()

    // Show evidence for this asset (bathroom items only)
    const { data: ev } = await sb
      .from('ai_extraction_results')
      .select('evidence_type, room_label, confidence_score, confidence_reason, source_anchor, content')
      .eq('asset_id', a.id)
      .order('created_at', { ascending: true })

    if (!ev?.length) { console.log('  (no evidence stored)\n'); continue }

    const bathItems = ev.filter(e =>
      (e.room_label || '').toLowerCase().includes('łazienk') ||
      (e.room_label || '').toLowerCase().includes('lazienk') ||
      JSON.stringify(e.content || {}).toLowerCase().includes('łazienk') ||
      JSON.stringify(e.content || {}).toLowerCase().includes('parawan') ||
      JSON.stringify(e.content || {}).toLowerCase().includes('wanna') ||
      JSON.stringify(e.content || {}).toLowerCase().includes('geberit') ||
      JSON.stringify(e.content || {}).toLowerCase().includes('gresow') ||
      JSON.stringify(e.content || {}).toLowerCase().includes('przedściank') ||
      JSON.stringify(e.content || {}).toLowerCase().includes('przedsciank')
    )

    console.log(`  Evidence: ${ev.length} total, ${bathItems.length} bathroom-related\n`)

    for (const e of ev) {
      const c = e.content || {}
      const confirmed = c.fix_confirmed !== undefined ? c.fix_confirmed :
                        c.confirmed !== undefined ? c.confirmed : '–'
      const name = c.fix_name || c.mat_name || c.dim_subject || c.sh_description || c.md_description || '–'
      console.log(`  [${e.evidence_type}] room:${e.room_label ?? '–'} | conf:${e.confidence_score} | confirmed:${confirmed}`)
      console.log(`    name/subject: ${name}`)
      console.log(`    anchor: "${e.source_anchor}"`)
      if (c.fix_note) console.log(`    note: ${c.fix_note}`)
      if (c.mat_zone || c.ts_zone) console.log(`    zone: ${c.mat_zone || c.ts_zone}`)
      console.log()
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
