#!/usr/bin/env node
// _test-r-lit1.cjs
// Clean isolated extraction test — calls OpenAI with current prompt,
// shows FULL model response, does NOT persist to DB.
// Usage: node scripts/_test-r-lit1.cjs [asset_id]

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')
const https = require('https')

// ── env ───────────────────────────────────────────────────────────────────────
const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const eq = l.indexOf('=')
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
})
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY   = env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase env'); process.exit(1) }
if (!OPENAI_KEY)                    { console.error('❌ Missing OPENAI_API_KEY'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const ASSET_ID = process.argv[2] || '89f5dfa5-9e13-4dbe-bcf0-66ca63af440f'

// ── Load current prompt from source ──────────────────────────────────────────
// We require the compiled JS — but since it's .ts, load it via dynamic require
// after tsc. Instead, read the .ts file and eval the exported string inline.
// Safer: just import the TS content by reading the literals out of the file.
function loadSystemPrompt() {
  const src = fs.readFileSync(
    path.join(__dirname, '../src/services/ai/prompts/evidence.prompt.ts'),
    'utf8'
  )
  // Extract the template literal for EVIDENCE_SYSTEM_PROMPT
  const match = src.match(/export const EVIDENCE_SYSTEM_PROMPT = `([\s\S]+?)`;?\s*\n\/\/ ── Source-role/)
  if (!match) throw new Error('Cannot extract EVIDENCE_SYSTEM_PROMPT from source')
  return match[1]
}

function buildUserMessage(filename) {
  return `[PLIK: "${filename}"]
[LAYER: layer_type="functional_layout"]
[ANCHOR_TEMPLATE: "${filename} | str:{N} | {nr_rysunku_lub_–} | {tytul_rysunku_lub_–} | {sekcja_lub_element}"]
[PDF_SCAN: Wykonaj PDF_SCAN_PROTOCOL — najpierw zidentyfikuj każdą stronę (nr, tytuł, skalę), POTEM ekstrahuj evidence z każdej strony osobno]
[TYP ASSETU: Rysunek architektoniczny — rzut lub projekt techniczny z wymiarami]
PROTOKÓŁ: wykonaj PDF_SCAN_PROTOCOL — najpierw zidentyfikuj KAŻDĄ stronę, POTEM sweep każdej strony z rzutem osobno.
TABELA NADRYSUNKOWA: czytaj PIERWSZA na każdym rzucie — numer rysunku (np. A-01), tytuł, skala → do source_anchor i confidence_reason.
LEGENDA: czytaj PRZED wymiarami (R-14). Rozróżnij: "wymiary mebli z legendy" (→ fix_dims, NIE dim) vs "wymiary pomieszczenia w świetle" (→ dim).
DIM PRIORYTET: dim_subject = "pomieszczenie — cecha" (np. "łazienka — długość", "pow. podłogi łazienki"). NIGDY nie twórz dim dla mebla.
SWEEP OBOWIĄZKOWY (R-08b): dla KAŻDEGO pomieszczenia widocznego na rzucie:
  - 1× dimension (podłoga lub ściana, jeśli widoczna linia wymiarowa)
  - 1× fixture per element armatury (walk-in, WC, umywalka, grzejnik, wanna)
  - 1× scope_hint jeśli R-17/R-22/R-27 dotyczy
  - 1× missing_data jeśli brakuje kluczowych danych
R-LIT1: jeśli opis jest jawnie wpisany na rysunku (np. "wanna zabudowana + parawan nawannowy") → confirmed=true, confidence ≥ 0.80.
R-MROOM1: rzut całego lokalu → izoluj odczyt adnotacji per pomieszczenie, nie mieszaj między pokojami.
R-26 NIE ZWALNIA ze sweep rzutu.

BRAK WSKAZANIA POMIESZCZENIA: Analizuj wszystkie pomieszczenia widoczne w assetzie.
Dla każdego evidence item: wyciągnij pomieszczenie z kontekstu (R-RL1a/b) i zapisz w room_label.

Użyj source_anchor w formacie z podanego ANCHOR_TEMPLATE dla każdego evidence item.`
}

// ── Schema (simplified for Responses API text.format) ────────────────────────
const SCHEMA = {
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

// ── OpenAI Responses API call (same as Netlify function uses) ─────────────────
function openaiRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/responses',
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve(JSON.parse(raw)) } catch(e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  R-LIT1 clean extraction test (NO DB write)')
  console.log(`  asset: ${ASSET_ID}`)
  console.log('═══════════════════════════════════════════════\n')

  // Load asset metadata
  const { data: asset, error } = await sb
    .from('ai_bundle_assets')
    .select('original_filename, storage_path, mime_type')
    .eq('id', ASSET_ID)
    .single()
  if (error || !asset) { console.error('Asset not found:', error?.message); process.exit(1) }
  console.log(`📄 File: ${asset.original_filename}`)
  console.log(`   path: ${asset.storage_path}\n`)

  // Download from Supabase Storage
  const { data: fileData, error: dlErr } = await sb.storage
    .from('company-files')
    .download(asset.storage_path.replace('company-files/', ''))
  if (dlErr || !fileData) { console.error('Download failed:', dlErr?.message); process.exit(1) }

  const arrayBuf  = await fileData.arrayBuffer()
  const base64    = Buffer.from(arrayBuf).toString('base64')
  const dataUrl   = `data:${asset.mime_type};base64,${base64}`
  console.log(`✅ Downloaded: ${Math.round(base64.length / 1024)} KB base64\n`)

  // Load current system prompt from source
  const systemPrompt = loadSystemPrompt()
  const userMessage  = buildUserMessage(asset.original_filename)

  console.log('🤖 Calling OpenAI gpt-4o (vision)...\n')
  const t0 = Date.now()

  const response = await openaiRequest({
    model: 'gpt-4o',
    instructions: systemPrompt,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: userMessage },
        { type: 'input_file', filename: asset.original_filename, file_data: dataUrl }
      ]
    }],
    text: { format: SCHEMA },
    max_output_tokens: 10000,
  })

  const elapsed = Date.now() - t0
  console.log(`⏱  ${elapsed}ms\n`)

  if (response.error) {
    console.error('OpenAI error:', JSON.stringify(response.error, null, 2))
    process.exit(1)
  }

  // Responses API: output[0].content[0].text
  const outputBlock = response.output?.find(o => o.content?.length)
  const content = outputBlock?.content?.find(c => c.type === 'output_text' || c.type === 'text')?.text
  if (!content) {
    console.log('RAW response (first 2000 chars):', JSON.stringify(response).slice(0, 2000))
    process.exit(1)
  }

  let parsed
  try { parsed = JSON.parse(content) } catch(e) {
    console.error('JSON parse failed. Raw:', content.slice(0, 500))
    process.exit(1)
  }

  // Responses API with json_schema wraps in { type, properties: {...} }
  if (parsed.properties && !parsed.evidence) parsed = parsed.properties

  const ev = parsed.evidence || []
  console.log(`📋 TOTAL EVIDENCE: ${ev.length} items`)
  console.log(`   confidence_summary: ${parsed.confidence_summary}`)
  console.log(`   extraction_summary: ${parsed.extraction_summary}\n`)

  // ── Print all evidence ────────────────────────────────────────────────────
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    const c = e.content || {}
    const confirmed = c.confirmed !== undefined ? c.confirmed :
                      c.fix_confirmed !== undefined ? c.fix_confirmed : '–'
    const name = c.fix_name || c.mat_name || c.dim_subject || c.sh_description ||
                 c.md_description || c.description || '–'
    console.log(`[${i+1}] ${e.evidence_type} | room:${e.room_label ?? 'null'} | conf:${e.confidence_score} | confirmed:${confirmed}`)
    console.log(`    name: ${name}`)
    console.log(`    reason: ${e.confidence_reason}`)
    console.log(`    anchor: ${e.source_anchor}`)
    if (c.fix_note || c.note)   console.log(`    note: ${c.fix_note || c.note}`)
    if (c.mat_zone || c.ts_zone || c.zone) console.log(`    zone: ${c.mat_zone || c.ts_zone || c.zone}`)
    if (c.fix_dims || c.dims)   console.log(`    dims: ${c.fix_dims || c.dims}`)
    console.log()
  }

  // ── Targeted search for required elements ─────────────────────────────────
  const targets = ['wanna', 'parawan', 'geberit', 'wc', 'toaleta', 'przedściank', 'umywalka', 'gresow', 'panele', 'laminowan', 'blat']
  console.log('═══ TARGET ELEMENTS CHECK ══════════════════════')
  for (const t of targets) {
    const matches = ev.filter(e =>
      JSON.stringify(e).toLowerCase().includes(t.toLowerCase())
    )
    if (matches.length) {
      for (const m of matches) {
        const c = m.content || {}
        const confirmed = c.confirmed !== undefined ? c.confirmed : c.fix_confirmed !== undefined ? c.fix_confirmed : '–'
        console.log(`  [${t}] → ${m.evidence_type} | room:${m.room_label ?? 'null'} | conf:${m.confidence_score} | confirmed:${confirmed}`)
        console.log(`          anchor: ${m.source_anchor}`)
      }
    } else {
      console.log(`  [${t}] → NOT FOUND`)
    }
  }

  // ── Material items (for floor boundary check) ─────────────────────────────
  const materials = ev.filter(e => e.evidence_type === 'material')
  console.log(`\n═══ MATERIAL ITEMS (${materials.length} total) ══════════════════`)
  for (const m of materials) {
    const c = m.content || {}
    console.log(`  material | name:${c.mat_name || c.name || '–'} | zone:${c.mat_zone || c.zone || '–'} | room:${m.room_label ?? 'null'} | conf:${m.confidence_score} | confirmed:${c.confirmed ?? '–'}`)
  }

  if (parsed.questions?.length) {
    console.log(`\n═══ QUESTIONS (${parsed.questions.length}) ══════════════════`)
    for (const q of parsed.questions) console.log(`  [${q.priority}] ${q.id || ''}: ${q.text}`)
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
