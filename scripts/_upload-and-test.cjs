#!/usr/bin/env node
// _upload-and-test.cjs
// ─────────────────────────────────────────────────────────────────────────────
// Uploads a local PDF to Supabase Storage, creates a new ai_bundle_assets row
// (inheriting bundle/company/project/source_role from an existing reference asset),
// then immediately runs the R-LIT1 clean extraction test (NO DB write for evidence).
//
// Usage:
//   node scripts/_upload-and-test.cjs <local_pdf_path> [reference_asset_id]
//
// Example:
//   node scripts/_upload-and-test.cjs "C:\path\to\1.1 B - układ funkcjonalny 1 B.pdf"
//
// Default reference asset: 89f5dfa5 (existing 1.1 B with prysznic — used for
// bundle_id / company_id / project_id / source_role / layer_type inheritance)
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

// ── env ───────────────────────────────────────────────────────────────────────
const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const eq = l.indexOf('=')
  if (eq > 0) env[l.slice(0,eq).trim()] = l.slice(eq+1).trim().replace(/^['"]|['"]$/g,'')
})
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY   = env.OPENAI_API_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env'); process.exit(1) }
if (!OPENAI_KEY)                    { console.error('Missing OPENAI_API_KEY'); process.exit(1) }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const LOCAL_PDF        = process.argv[2]
const REF_ASSET_ID     = process.argv[3] || '89f5dfa5-9e13-4dbe-bcf0-66ca63af440f'

if (!LOCAL_PDF) {
  console.error('Usage: node scripts/_upload-and-test.cjs <local_pdf_path> [ref_asset_id]')
  process.exit(1)
}
if (!fs.existsSync(LOCAL_PDF)) {
  console.error(`File not found: ${LOCAL_PDF}`)
  process.exit(1)
}

// ── Load system prompt from TS source ────────────────────────────────────────
function loadSystemPrompt() {
  const src = fs.readFileSync(
    path.join(__dirname, '../src/services/ai/prompts/evidence.prompt.ts'), 'utf8'
  )
  const match = src.match(/export const EVIDENCE_SYSTEM_PROMPT = `([\s\S]+?)`;?\s*\n\/\/ ── Source-role/)
  if (!match) throw new Error('Cannot extract EVIDENCE_SYSTEM_PROMPT from source')
  return match[1]
}

// ── OpenAI Responses API ──────────────────────────────────────────────────────
function openaiRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/responses', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let raw = ''; res.on('data', c => raw += c)
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch(e) { reject(e) } })
    })
    req.on('error', reject); req.write(data); req.end()
  })
}

// ── Simplified schema for test (not strict — allows extra fields) ─────────────
const TEST_SCHEMA = {
  type: 'json_schema',
  name: 'evidence_output',
  strict: false,
  schema: {
    type: 'object',
    properties: {
      extraction_summary: { type: 'string' },
      confidence_summary: { type: 'number' },
      missing_data:       { type: 'boolean' },
      evidence: {
        type: 'array',
        items: { type: 'object', additionalProperties: true }
      },
      questions: { type: 'array', items: { type: 'object', additionalProperties: true } },
      risks:     { type: 'array', items: { type: 'object', additionalProperties: true } }
    },
    required: ['evidence'],
    additionalProperties: true
  }
}

const CHECKLIST = [
  { key: 'wanna zabudowana',              label: 'wanna zabudowana' },
  { key: 'parawan nawannowy',             label: 'parawan nawannowy' },
  { key: 'przedściank',                   label: 'przedścianka GK' },
  { key: 'gips-karton',                   label: 'gips-karton (przedścianka)' },
  { key: 'stelaż',                        label: 'stelaż geberit' },
  { key: 'geberit',                       label: 'geberit' },
  { key: 'wc',                            label: 'WC wisząca' },
  { key: 'blat',                          label: 'blat/umywalka' },
  { key: 'panele laminowane',             label: 'granica materiałów (panele)' },
  { key: 'płytki gresowe',               label: 'granica materiałów (gres)' },
]

async function main() {
  const filename = path.basename(LOCAL_PDF)
  const pdfBuf   = fs.readFileSync(LOCAL_PDF)
  const sha256   = crypto.createHash('sha256').update(pdfBuf).digest('hex').toUpperCase()

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  UPLOAD + EXTRACTION TEST                            ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')
  console.log(`📄 Local file : ${LOCAL_PDF}`)
  console.log(`   Filename   : ${filename}`)
  console.log(`   Size       : ${pdfBuf.length} bytes (${(pdfBuf.length/1024).toFixed(1)} KB)`)
  console.log(`   SHA256     : ${sha256}\n`)

  // ── Load reference asset metadata ────────────────────────────────────────
  const { data: ref, error: refErr } = await sb.from('ai_bundle_assets')
    .select('bundle_id,company_id,project_id,source_role,layer_type,room_hint')
    .eq('id', REF_ASSET_ID).single()
  if (refErr || !ref) { console.error('Ref asset not found:', refErr?.message); process.exit(1) }

  console.log(`🔗 Bundle     : ${ref.bundle_id}`)
  console.log(`   Company    : ${ref.company_id}`)
  console.log(`   Project    : ${ref.project_id}`)
  console.log(`   Source role: ${ref.source_role}`)
  console.log(`   Layer      : ${ref.layer_type}\n`)

  // ── Detect MIME type ────────────────────────────────────────────────────
  const ext = path.extname(filename).toLowerCase()
  const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)
  const mimeType = ext === '.png' ? 'image/png'
               : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
               : ext === '.webp' ? 'image/webp'
               : 'application/pdf'

  // ── Build storage path ───────────────────────────────────────────────────
  const timestamp   = Date.now()
  const safeName    = filename.replace(/\s+/g, '_').replace(/[^\w.\-]/g, '_')
  const storagePath = `${ref.company_id}/ai-bundles/${timestamp}_${safeName}`
  const fullPath    = `company-files/${storagePath}`

  console.log(`📤 Uploading to storage: ${storagePath}`)

  const { error: upErr } = await sb.storage
    .from('company-files')
    .upload(storagePath, pdfBuf, { contentType: mimeType, upsert: false })
  if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1) }
  console.log('✅ Upload OK\n')

  // ── Create new asset row ─────────────────────────────────────────────────
  const { data: newAsset, error: insertErr } = await sb.from('ai_bundle_assets').insert({
    bundle_id:          ref.bundle_id,
    company_id:         ref.company_id,
    project_id:         ref.project_id,
    source_role:        ref.source_role,
    layer_type:         ref.layer_type,
    room_hint:          ref.room_hint,
    original_filename:  filename,
    storage_path:       fullPath,
    mime_type:          mimeType,
    extraction_status:  'pending',
  }).select('id').single()

  if (insertErr || !newAsset) { console.error('Insert failed:', insertErr?.message); process.exit(1) }

  const newAssetId = newAsset.id
  console.log(`✅ New asset created: ${newAssetId}`)
  console.log(`   original_filename: ${filename}`)
  console.log(`   storage_path     : ${fullPath}\n`)

  // ── Run extraction test (NO DB write for evidence) ───────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('EXTRACTION TEST (NO evidence DB write)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const base64  = pdfBuf.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const systemPrompt = loadSystemPrompt()
  const userMessage  = `[PLIK: "${filename}"]
[LAYER: layer_type="${ref.layer_type}"]
[ANCHOR_TEMPLATE: "${filename} | str:{N} | {nr_rysunku_lub_–} | {tytul_rysunku_lub_–} | {sekcja_lub_element}"]
[PDF_SCAN: Wykonaj PDF_SCAN_PROTOCOL — najpierw zidentyfikuj każdą stronę (nr, tytuł, skalę), POTEM ekstrahuj evidence z każdej strony osobno]
[TYP ASSETU: Rysunek architektoniczny — rzut lub projekt techniczny z wymiarami]
PROTOKÓŁ: wykonaj PDF_SCAN_PROTOCOL — najpierw zidentyfikuj KAŻDĄ stronę, POTEM sweep każdej strony z rzutem osobno.
SWEEP OBOWIĄZKOWY (R-08b): dla KAŻDEGO pomieszczenia widocznego na rzucie.
R-LIT1: jeśli opis jest jawnie wpisany na rysunku → confirmed=true, confidence ≥ 0.80.
R-MROOM1: rzut całego lokalu → izoluj odczyt adnotacji per pomieszczenie, nie mieszaj między pokojami.`

  console.log('🤖 Calling OpenAI gpt-4o...')
  const t0 = Date.now()
  const resp = await openaiRequest({
    model:   'gpt-4o',
    instructions: systemPrompt,
    input:   [{ role: 'user', content: [
      { type: 'input_text', text: userMessage },
      ...(isImage
        ? [{ type: 'input_image', image_url: dataUrl }]
        : [{ type: 'input_file', filename, file_data: dataUrl }])
    ]}],
    text:    { format: TEST_SCHEMA },
    max_output_tokens: 10000,
  })
  console.log(`⏱  ${Date.now()-t0}ms\n`)

  if (resp.error) { console.error('OpenAI error:', JSON.stringify(resp.error)); process.exit(1) }

  const outputBlock = resp.output?.find(o => o.content?.length)
  const rawText = outputBlock?.content?.find(c => c.type === 'output_text' || c.type === 'text')?.text
  if (!rawText) { console.log('Empty response. RAW:', JSON.stringify(resp).slice(0,500)); process.exit(1) }

  let parsed
  try { parsed = JSON.parse(rawText) } catch(e) { console.error('JSON parse failed:', rawText.slice(0,300)); process.exit(1) }
  if (parsed.properties && !parsed.evidence) parsed = parsed.properties

  const ev = parsed.evidence || []
  console.log(`📋 Evidence items: ${ev.length}`)
  console.log(`   confidence_summary: ${parsed.confidence_summary ?? '–'}`)
  console.log(`   extraction_summary: ${parsed.extraction_summary ?? '–'}\n`)

  // Print all items
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    const c = e.content || {}
    const name = c.fix_name || e.fix_name || c.mat_name || e.mat_name || c.dim_subject || e.dim_subject ||
                 c.sh_description || e.sh_description || c.md_subject || e.md_subject || e.description || '–'
    const confirmed = e.fix_confirmed !== undefined ? e.fix_confirmed : (c.fix_confirmed !== undefined ? c.fix_confirmed : (c.confirmed !== undefined ? c.confirmed : '–'))
    const reason  = e.confidence_reason || c.confidence_reason || '–'
    const room    = e.room_label        || c.room_label        || 'null'
    console.log(`[${i+1}] ${e.evidence_type} | room:${room} | conf:${e.confidence_score||c.confidence_score} | confirmed:${confirmed}`)
    console.log(`    ${name}`)
    console.log(`    ${reason}`)
    console.log()
  }

  // ── CHECKLIST ────────────────────────────────────────────────────────────
  const allText = JSON.stringify(ev).toLowerCase()
  console.log('════ CHECKLIST ══════════════════════════════════════')
  let allPass = true
  for (const item of CHECKLIST) {
    const found = allText.includes(item.key.toLowerCase())
    if (!found) allPass = false
    console.log(`  ${found ? '✅' : '❌'} ${item.label}`)
  }
  console.log()
  console.log(allPass ? '✅ WSZYSTKIE POZYCJE ZNALEZIONE' : '⚠️  NIEKTÓRE POZYCJE BRAKUJE')

  // ── Material boundary check ──────────────────────────────────────────────
  const materials = ev.filter(e => e.evidence_type === 'material' || (e.content && e.content.mat_name))
  if (materials.length) {
    console.log(`\n══ MATERIAL ITEMS (${materials.length}) ══════════════════════`)
    for (const m of materials) {
      const c = m.content || {}
      const name = m.mat_name || c.mat_name || '–'
      const zone = m.mat_zone || c.mat_zone || '–'
      console.log(`  material | ${name} | zone:${zone} | room:${m.room_label||'null'} | conf:${m.confidence_score}`)
    }
  }

  console.log(`\n📋 New asset_id for future reference: ${newAssetId}`)
  console.log(`   Re-run test:  node scripts/_test-r-lit1.cjs ${newAssetId}`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
