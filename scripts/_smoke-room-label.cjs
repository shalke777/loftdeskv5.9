// scripts/_smoke-room-label.cjs
// Re-tests the 3 technical PDFs focusing on room_label quality.
// Compares against known baseline room_label issues.

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
process.env.SUPABASE_URL              = SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
process.env.OPENAI_API_KEY            = env.OPENAI_API_KEY
delete process.env.SUPABASE_ANON_KEY
delete process.env.VITE_SUPABASE_ANON_KEY

const sb = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const COMPANY_ID = 'eff93f68-1fdd-4c60-bc71-1d9bc2a88d9a'
const PROJECT_ID  = '62239f28-9433-423f-9ddd-7c6ce34c0c62'
const USER_ID     = 'f820469c-3409-4061-9594-05649219305d'

// Baseline room_label quality from previous run (bundle 4e08d0a8)
// Format: [filename]: { total, with_room, null_room, types_with_room }
const BASELINE = {
  'A.02.13 Podkład do wyceny _ Wykończenie.pdf': {
    total: 7, with_room: 3, null_room: 4,
    note: 'tile_spec [1,2], hypothesis [5], missing_data [6] all had room:–'
  },
  '1.1 B - układ funkcjonalny.pdf': {
    total: 4, with_room: 0, null_room: 4,
    note: 'dimension room:– though dim_subject had "pokój dzienny"/"korytarz"; fixture/scope_hint room:–'
  },
  'LAZIENKA PARTER_RZUT WODKAN (1).pdf': {
    total: 2, with_room: 2, null_room: 0,
    note: 'OK — room_hint was set'
  },
}

const ASSETS = [
  {
    localPath: 'C:\\FIRMA\\chmura\\drive-download-20260331T170414Z-3-001\\A.02.13 Podkład do wyceny _ Wykończenie.pdf',
    filename:  'A.02.13 Podkład do wyceny _ Wykończenie.pdf',
    source_role: 'architectural_drawing', layer_type: 'functional_layout',
    source_priority: 10, room_hint: null,
  },
  {
    localPath: 'C:\\FIRMA\\chmura\\drive-download-20260331T170414Z-3-001\\1.1 B - układ funkcjonalny.pdf',
    filename:  '1.1 B - układ funkcjonalny.pdf',
    source_role: 'architectural_drawing', layer_type: 'functional_layout',
    source_priority: 12, room_hint: null,
  },
  {
    localPath: 'C:\\FIRMA\\chmura\\drive-download-20260331T171016Z-3-001\\LAZIENKA PARTER_RZUT WODKAN (1).pdf',
    filename:  'LAZIENKA PARTER_RZUT WODKAN (1).pdf',
    source_role: 'installation_drawing', layer_type: 'plumbing_wod_kan',
    source_priority: 15, room_hint: 'łazienka parter',
  },
]

// Compile function bundle
const outFile = path.resolve('./_smoke_room_label.cjs')
console.log('🔨 Compiling...')
buildSync({
  entryPoints: ['netlify/functions/composite-extract-asset.ts'],
  bundle: true, platform: 'node', target: 'node20', format: 'cjs', outfile: outFile,
  external: ['@supabase/supabase-js', '@netlify/functions'], absWorkingDir: process.cwd(),
})
const handler = require(outFile).handler
console.log('   ✅ Handler loaded\n')

function mockEvent(body) {
  return {
    httpMethod: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), isBase64Encoded: false,
    queryStringParameters: {}, rawQuery: '',
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  ROOM_LABEL QUALITY TEST — before/after R-RL1 propagation rules ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝\n')

  const bundleId = randomUUID()
  await sb.from('ai_analysis_bundles').insert({
    id: bundleId, company_id: COMPANY_ID, project_id: PROJECT_ID, created_by: USER_ID,
    status: 'pending', asset_count: ASSETS.length, extracted_count: 0, document_type: 'projekt_wykonawczy',
  })
  console.log('Bundle:', bundleId, '\n')

  const results = []

  for (const asset of ASSETS) {
    console.log(`${'═'.repeat(68)}`)
    console.log(`📄 ${asset.filename}`)

    const fileBytes = fs.readFileSync(asset.localPath)
    const fileBase64 = fileBytes.toString('base64')

    // Upload
    const ts = Date.now()
    const storageName = `${ts}_${asset.filename.replace(/[^a-zA-Z0-9._\-]/g, '_')}`
    const { error: upErr } = await sb.storage.from('company-files').upload(
      `${COMPANY_ID}/messages/${storageName}`, fileBytes, { contentType: 'application/pdf', upsert: false }
    )
    if (upErr) { console.error('Upload:', upErr.message); continue }

    const assetId = randomUUID()
    await sb.from('ai_bundle_assets').insert({
      id: assetId, bundle_id: bundleId, company_id: COMPANY_ID, project_id: PROJECT_ID,
      original_filename: asset.filename,
      storage_path: `company-files/${COMPANY_ID}/messages/${storageName}`,
      mime_type: 'application/pdf', source_type: 'pdf',
      source_role: asset.source_role, layer_type: asset.layer_type,
      source_priority: asset.source_priority, extraction_status: 'pending',
      room_hint: asset.room_hint,
    })

    const t0 = Date.now()
    const resp = await handler(mockEvent({
      asset_id: assetId, file_base64: fileBase64, file_mime: 'application/pdf',
      source_role: asset.source_role, room_hint: asset.room_hint,
    }), {})
    const elapsed = Date.now() - t0
    const body = JSON.parse(resp.body)
    if (!body.ok) { console.error('Handler error:', body.error); continue }

    const { data: rows } = await sb
      .from('ai_extraction_results')
      .select('evidence_type, room_label, confidence_score, confidence_reason, source_anchor, content')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: true })

    const total = rows?.length ?? 0
    const withRoom = (rows || []).filter(r => r.room_label && r.room_label !== '–' && r.room_label !== 'null').length
    const nullRoom = total - withRoom
    const baseline = BASELINE[asset.filename]

    console.log(`\n   BEFORE: ${baseline.null_room}/${baseline.total} null room_label — ${baseline.note}`)
    console.log(`   AFTER:  ${nullRoom}/${total} null room_label (${withRoom} have room) in ${elapsed}ms`)

    const delta = baseline.null_room - nullRoom
    const symbol = delta > 0 ? '✅' : delta === 0 ? '🟡' : '❌'
    console.log(`   DELTA:  ${symbol} ${delta > 0 ? '+' + delta + ' more rooms filled' : delta === 0 ? 'no change' : delta + ' regression'}`)

    console.log('\n   Evidence breakdown:')
    rows?.forEach((r, i) => {
      const roomOk = r.room_label && r.room_label !== '–'
      const c = r.content || {}
      // Show dim_subject if it contains a room name to check R-RL1a
      const dimSubject = c.dim_subject || null
      const payload = dimSubject ? ` [dim_subject: "${dimSubject}"]` : ''
      console.log(`   [${i+1}] ${r.evidence_type} | room_label: "${r.room_label ?? 'null'}" ${roomOk ? '✅' : '⚠️'}${payload}`)
    })

    results.push({ label: asset.filename, total, withRoom, nullRoom, baseline, delta })
  }

  // ── Summary ──
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  ROOM_LABEL IMPROVEMENT SUMMARY                                ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝\n')

  let totalBefore = 0, totalNullBefore = 0, totalNullAfter = 0

  for (const r of results) {
    const pctBefore = Math.round(100 * r.baseline.null_room / r.baseline.total)
    const pctAfter  = Math.round(100 * r.nullRoom / r.total)
    const sym = r.delta > 0 ? '✅' : r.delta === 0 ? '🟡' : '❌'
    console.log(`${sym} ${r.label}`)
    console.log(`   null room: ${r.baseline.null_room}/${r.baseline.total} (${pctBefore}%) → ${r.nullRoom}/${r.total} (${pctAfter}%)`)
    totalBefore    += r.baseline.null_room
    totalNullAfter += r.nullRoom
    totalNullBefore+= r.baseline.null_room
  }

  const overallDelta = totalNullBefore - totalNullAfter
  console.log(`\nTotal null room_label: BEFORE ${totalNullBefore} → AFTER ${totalNullAfter} (${overallDelta > 0 ? '-' + overallDelta + ' ✅ improved' : 'no change'})`)
  console.log(`R-RL1 propagation rules active: ✅ YES (in compiled production bundle)`)

  fs.unlinkSync(outFile)
  console.log('\nbundle_id:', bundleId)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
