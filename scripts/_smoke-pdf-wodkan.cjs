// scripts/_smoke-pdf-wodkan.cjs  — runs ONLY the LAZIENKA PARTER_RZUT WODKAN asset
const { buildSync } = require('esbuild')
const path = require('path')
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto')

const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const eq = l.indexOf('=')
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
})
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
process.env.SUPABASE_URL              = SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
process.env.OPENAI_API_KEY            = env.OPENAI_API_KEY
delete process.env.SUPABASE_ANON_KEY
delete process.env.VITE_SUPABASE_ANON_KEY

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
const COMPANY_ID = 'eff93f68-1fdd-4c60-bc71-1d9bc2a88d9a'
const PROJECT_ID  = '62239f28-9433-423f-9ddd-7c6ce34c0c62'
const USER_ID     = 'f820469c-3409-4061-9594-05649219305d'

const outFile = path.resolve('./_smoke_wodkan.cjs')
buildSync({
  entryPoints: ['netlify/functions/composite-extract-asset.ts'],
  bundle: true, platform: 'node', target: 'node20', format: 'cjs', outfile: outFile,
  external: ['@supabase/supabase-js', '@netlify/functions'], absWorkingDir: process.cwd(),
})
const handler = require(outFile).handler

const LOCAL_PATH = 'C:\\FIRMA\\chmura\\drive-download-20260331T171016Z-3-001\\LAZIENKA PARTER_RZUT WODKAN (1).pdf'
const FILENAME   = 'LAZIENKA PARTER_RZUT WODKAN (1).pdf'

async function main() {
  const fileBytes  = fs.readFileSync(LOCAL_PATH)
  const fileBase64 = fileBytes.toString('base64')
  console.log(`📄 ${FILENAME} — ${Math.round(fileBytes.length/1024)} KB`)

  const bundleId = randomUUID()
  await sb.from('ai_analysis_bundles').insert({
    id: bundleId, company_id: COMPANY_ID, project_id: PROJECT_ID, created_by: USER_ID,
    status: 'pending', asset_count: 1, extracted_count: 0, document_type: 'projekt_wykonawczy',
  })

  const ts = Date.now()
  const storageName = `${ts}_LAZIENKA_PARTER_RZUT_WODKAN_1.pdf`
  const storagePath = `${COMPANY_ID}/messages/${storageName}`
  const { error: upErr } = await sb.storage.from('company-files').upload(storagePath, fileBytes, { contentType: 'application/pdf', upsert: false })
  if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1) }
  console.log('✅ Uploaded')

  const assetId = randomUUID()
  const { error: ae } = await sb.from('ai_bundle_assets').insert({
    id: assetId, bundle_id: bundleId, company_id: COMPANY_ID, project_id: PROJECT_ID,
    original_filename: FILENAME, storage_path: `company-files/${storagePath}`,
    mime_type: 'application/pdf', source_type: 'pdf',
    source_role: 'installation_drawing', layer_type: 'plumbing_wod_kan',
    source_priority: 15, extraction_status: 'pending', room_hint: 'łazienka parter',
  })
  if (ae) { console.error('Asset insert:', ae.message); process.exit(1) }

  const t0 = Date.now()
  const resp = await handler({
    httpMethod: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId, file_base64: fileBase64, file_mime: 'application/pdf',
      source_role: 'installation_drawing', room_hint: 'łazienka parter' }),
    isBase64Encoded: false, queryStringParameters: {}, rawQuery: '',
  }, {})

  const body = JSON.parse(resp.body)
  const elapsed = Date.now() - t0
  if (!body.ok) { console.error('Handler error:', body.error, body.message); process.exit(1) }
  console.log(`✅ Handler OK (${elapsed}ms) — evidence: ${body.evidence_count}`)

  const { data: rows } = await sb.from('ai_extraction_results')
    .select('evidence_type, confidence_score, confidence_reason, source_anchor')
    .eq('asset_id', assetId).order('created_at', { ascending: true })

  console.log('\nSOURCE_ANCHORS:')
  rows?.forEach(r => {
    const hasFn   = r.source_anchor?.includes(FILENAME)
    const hasPage = /\bstr:\S+/.test(r.source_anchor || '')
    const ok = hasFn && hasPage ? '✅' : hasFn ? '🟡' : '❌'
    console.log(`  ${ok} [${r.evidence_type}] "${r.source_anchor}"`)
    if (r.confidence_reason) console.log(`       reason: "${r.confidence_reason}"`)
  })

  const pageRefs = (rows || []).filter(r => /\bstr:\S+/.test(r.source_anchor || '')).length
  const total = rows?.length ?? 0
  console.log(`\nPage refs: ${pageRefs}/${total} ${pageRefs === total ? '✅' : '⚠️'}`)
  fs.unlinkSync(outFile)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
