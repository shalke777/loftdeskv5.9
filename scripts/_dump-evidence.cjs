// Dump full raw content for an asset's evidence
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

// Most recent asset for the functional layout PDF
const ASSET_ID = process.argv[2] || '89f5dfa5-9e13-4dbe-bcf0-66ca63af440f'

async function main() {
  const { data: ev, error } = await sb
    .from('ai_extraction_results')
    .select('*')
    .eq('asset_id', ASSET_ID)
    .order('created_at', { ascending: true })

  if (error) { console.error(error.message); process.exit(1) }
  if (!ev?.length) { console.log('No evidence for asset', ASSET_ID); process.exit(0) }

  console.log(`Evidence for asset ${ASSET_ID} (${ev.length} rows):\n`)
  for (const e of ev) {
    console.log('─'.repeat(60))
    console.log(`evidence_type: ${e.evidence_type}`)
    console.log(`room_label:    ${e.room_label ?? 'null'}`)
    console.log(`confidence:    ${e.confidence_score}`)
    console.log(`reason:        ${e.confidence_reason}`)
    console.log(`source_anchor: ${e.source_anchor}`)
    console.log(`content (raw):`)
    console.log(JSON.stringify(e.content, null, 2))
    console.log()
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
