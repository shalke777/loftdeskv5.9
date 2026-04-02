// scripts/_retest-pdf-quality.cjs
// Re-tests the same 3 technical PDFs with the updated prompt.
// Focuses on measuring evidence density improvement vs previous run.
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

// Previous baseline evidence counts (from smoke test before this fix)
const BASELINE = {
  'A.02.13 Podkład do wyceny _ Wykończenie.pdf': 3,
  '1.1 B - układ funkcjonalny.pdf': 2,
  'LAZIENKA PARTER_RZUT WODKAN (1).pdf': 3,
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

const outFile = path.resolve('./_retest_pdf_bundle.cjs')
console.log('🔨 Compiling composite-extract-asset.ts...')
buildSync({
  entryPoints: ['netlify/functions/composite-extract-asset.ts'],
  bundle: true, platform: 'node', target: 'node20', format: 'cjs',
  outfile: outFile, external: ['@supabase/supabase-js', '@netlify/functions'],
  absWorkingDir: process.cwd(),
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
  console.log('║  RE-TEST: extraction density + dim/furniture disambiguation     ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝\n')

  const bundleId = randomUUID()
  await sb.from('ai_analysis_bundles').insert({
    id: bundleId, company_id: COMPANY_ID, project_id: PROJECT_ID, created_by: USER_ID,
    status: 'pending', asset_count: ASSETS.length, extracted_count: 0,
    document_type: 'projekt_wykonawczy',
  })

  const results = []

  for (const pdf of ASSETS) {
    console.log(`${'═'.repeat(68)}`)
    console.log(`📄 ${pdf.filename}`)

    const fileBytes  = fs.readFileSync(pdf.localPath)
    const fileBase64 = fileBytes.toString('base64')

    // Upload
    const ts = Date.now()
    const storageName = `${ts}_${pdf.filename.replace(/[^a-zA-Z0-9._\-]/g, '_')}`
    const { error: upErr } = await sb.storage.from('company-files').upload(
      `${COMPANY_ID}/messages/${storageName}`, fileBytes,
      { contentType: 'application/pdf', upsert: false }
    )
    if (upErr) { console.error('Upload:', upErr.message); continue }

    const assetId = randomUUID()
    const { error: ae } = await sb.from('ai_bundle_assets').insert({
      id: assetId, bundle_id: bundleId, company_id: COMPANY_ID, project_id: PROJECT_ID,
      original_filename: pdf.filename,
      storage_path: `company-files/${COMPANY_ID}/messages/${storageName}`,
      mime_type: 'application/pdf', source_type: 'pdf',
      source_role: pdf.source_role, layer_type: pdf.layer_type,
      source_priority: pdf.source_priority, extraction_status: 'pending',
      room_hint: pdf.room_hint,
    })
    if (ae) { console.error('Asset:', ae.message); continue }

    const t0 = Date.now()
    const resp = await handler(mockEvent({
      asset_id: assetId, file_base64: fileBase64, file_mime: 'application/pdf',
      source_role: pdf.source_role, room_hint: pdf.room_hint,
    }), {})

    const body = JSON.parse(resp.body)
    const elapsed = Date.now() - t0

    if (!body.ok) {
      console.error(`❌ Handler error: ${body.error} — ${body.message}`)
      results.push({ label: pdf.filename, ok: false })
      continue
    }

    const { data: rows } = await sb
      .from('ai_extraction_results')
      .select('evidence_type, room_label, confidence_score, confidence_reason, source_anchor, content')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: true })

    const evidence = rows || []
    const baseline  = BASELINE[pdf.filename] || 0
    const current   = evidence.length
    const delta     = current - baseline
    const densityUp = delta > 0 ? `⬆️  +${delta}` : delta === 0 ? '= same' : `⬇️  ${delta}`

    // Check dimension quality
    const dimItems      = evidence.filter(e => e.evidence_type === 'dimension')
    const furnitureDims = dimItems.filter(e => {
      const subj = (e.content?.subject || e.content?.dim_subject || '').toLowerCase()
      return /łóżk|materac|stoł|szaf|krzesł|biurk|mebel|szafk/.test(subj)
    })
    const roomDims = dimItems.filter(e => {
      const subj = (e.content?.subject || e.content?.dim_subject || '').toLowerCase()
      return /\u0142azienka|salon|kuchnia|przed|hol|pok|syp|pow|d\u0142ugo|\u015bcia|wysoko|pod\u0142/.test(subj)
    })

    // Check scope_hints
    const scopeHints    = evidence.filter(e => e.evidence_type === 'scope_hint')
    const missingData   = evidence.filter(e => e.evidence_type === 'missing_data')
    const fixtures      = evidence.filter(e => e.evidence_type === 'fixture')
    const tile_specs    = evidence.filter(e => e.evidence_type === 'tile_spec')
    const installations = evidence.filter(e => e.evidence_type === 'installation')

    // Page spread
    const pages = new Set(evidence.map(e => {
      const m = (e.source_anchor || '').match(/str:(\S+)/)
      return m ? m[1] : '?'
    }))

    console.log(`   Handler: ${elapsed}ms | evidence: ${baseline} → ${current} (${densityUp})`)
    console.log(`   By type: dim:${dimItems.length} fixture:${fixtures.length} tile_spec:${tile_specs.length} install:${installations.length} scope_hint:${scopeHints.length} missing:${missingData.length}`)
    console.log(`   Dim quality: room_dims:${roomDims.length} furniture_dim_violations:${furnitureDims.length}`)
    console.log(`   Pages with evidence: ${[...pages].sort().join(', ')}`)

    console.log('\n   ALL EVIDENCE:')
    evidence.forEach((e, i) => {
      const c = e.content || {}
      const subj = c.subject || c.name || c.description || c.text || ''
      const val  = c.value !== undefined ? ` = ${c.value}${c.unit ? ' '+c.unit : ''}` : ''
      const page = (e.source_anchor || '').match(/str:(\S+)/)?.[1] ?? '?'
      const anchor_short = (e.source_anchor || '').split(' | ').slice(1, 4).join(' | ')
      const room = e.room_label ? `[${e.room_label}]` : ''
      console.log(`   [${i+1}] ${e.evidence_type}${room} str:${page} | ${subj.slice(0,50)}${val}`)
      console.log(`       ↳ ${anchor_short}`)
      if (e.confidence_reason) console.log(`       reason: ${e.confidence_reason}`)
    })

    results.push({
      label: pdf.filename, ok: true, elapsed,
      baseline, current, delta,
      dimViolations: furnitureDims.length,
      roomDims: roomDims.length,
      scopeHints: scopeHints.length,
      pages: [...pages].sort(),
    })
  }

  // Final report
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  QUALITY COMPARISON REPORT                                     ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝\n')
  console.log('File                                        Before → After  Δ    dim_fix  scope_hints  pages')
  console.log('─'.repeat(100))

  let totalBefore = 0, totalAfter = 0, totalViolations = 0, totalRoomDims = 0, totalScopeHints = 0
  for (const r of results) {
    if (!r.ok) { console.log(`❌ ${r.label}`); continue }
    const label = r.label.slice(0, 42).padEnd(44)
    const delta = r.delta > 0 ? `+${r.delta}` : `${r.delta}`
    console.log(`${r.delta > 0 ? '✅' : '🟡'} ${label} ${r.baseline} → ${r.current}  ${delta.padEnd(4)} viol:${r.dimViolations}  sh:${r.scopeHints}  str:[${r.pages.join(',')}]`)
    totalBefore     += r.baseline
    totalAfter      += r.current
    totalViolations += r.dimViolations
    totalRoomDims   += r.roomDims
    totalScopeHints += r.scopeHints
  }

  const totalDelta = totalAfter - totalBefore
  console.log(`\nTOTAL: ${totalBefore} → ${totalAfter} (${totalDelta > 0 ? '+' : ''}${totalDelta} items)`)
  console.log(`R-14b dim violations: ${totalViolations} (target: 0)`)
  console.log(`Room dim items:       ${totalRoomDims}`)
  console.log(`Scope hints:          ${totalScopeHints}`)

  const improved = totalAfter > totalBefore && totalViolations === 0
  console.log(`\nExtraction quality improved: ${improved ? '✅ TAK' : totalViolations === 0 ? '🟡 PARTIAL (less violations)' : '❌ NIE'}`)
  console.log(`bundle_id: ${bundleId}`)

  fs.unlinkSync(outFile)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
