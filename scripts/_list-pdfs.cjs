// scripts/_list-pdfs.cjs
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
  // List all paths we know about
  const paths = [
    `company-files/${COMPANY_ID}/messages`,
    `company-files/${COMPANY_ID}/project-photos`,
    `company-files/${COMPANY_ID}/attachments`,
    `company-files/${COMPANY_ID}`,
  ]

  for (const p of paths) {
    const { data, error } = await sb.storage.from('company-files').list(p.replace('company-files/', ''), { limit: 100 })
    if (error) { console.log(`${p}: ERROR — ${error.message}`); continue }
    const pdfs = (data || []).filter(f => f.name?.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) { console.log(`${p}: 0 PDFs`); continue }
    console.log(`\n${p}: ${pdfs.length} PDFs`)
    pdfs.forEach(f => console.log(`  - ${f.name}  (${Math.round((f.metadata?.size || 0) / 1024)} KB)`))
  }

  // Also query DB for PDF assets
  const { data: assets } = await sb
    .from('ai_bundle_assets')
    .select('id, original_filename, storage_path, mime_type, source_type, source_role, layer_type')
    .eq('company_id', COMPANY_ID)
    .eq('mime_type', 'application/pdf')
    .order('created_at', { ascending: false })
    .limit(20)

  console.log(`\n\nDB ai_bundle_assets (PDFs): ${assets?.length ?? 0}`)
  assets?.forEach(a => console.log(`  id: ${a.id}\n  file: ${a.original_filename}\n  role: ${a.source_role} | layer: ${a.layer_type}\n  path: ${a.storage_path}\n`))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
