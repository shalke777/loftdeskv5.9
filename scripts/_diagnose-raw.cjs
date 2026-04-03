#!/usr/bin/env node
// _diagnose-raw.cjs
// Root-cause diagnostic for R-LIT1 failure.
// STEP 1: Free-form visual description (no JSON schema) — what does the model SEE?
// STEP 2: Full raw JSON extraction dump — what does the model RETURN in schema-constrained mode?
// STEP 3: Compare presence of target annotations between steps.
// NO DB write. Read-only diagnostic.
// Usage: node scripts/_diagnose-raw.cjs [asset_id]

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

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env'); process.exit(1) }
if (!OPENAI_KEY)                    { console.error('Missing OPENAI_API_KEY'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const ASSET_ID = process.argv[2] || '89f5dfa5-9e13-4dbe-bcf0-66ca63af440f'

function loadSystemPrompt() {
  const src = fs.readFileSync(
    path.join(__dirname, '../src/services/ai/prompts/evidence.prompt.ts'), 'utf8'
  )
  const match = src.match(/export const EVIDENCE_SYSTEM_PROMPT = `([\s\S]+?)`;?\s*\n\/\/ ── Source-role/)
  if (!match) throw new Error('Cannot extract EVIDENCE_SYSTEM_PROMPT')
  return match[1]
}

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

// ── PRODUCTION SCHEMA (identical to composite-extract-asset.ts) ────────────────
// strict: true, flat fields, additionalProperties: false
const EVIDENCE_ITEM_SCHEMA_STRICT = {
  type: 'object',
  properties: {
    evidence_type:     { type: 'string', enum: ['dimension','fixture','material','tile_spec','installation','scope_hint','missing_data','hypothesis'] },
    room_label:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
    confidence_score:  { type: 'number' },
    confidence_reason: { type: 'string' },
    source_anchor:     { anyOf: [{ type: 'string' }, { type: 'null' }] },
    dim_subject:       { anyOf: [{ type: 'string' }, { type: 'null' }] },
    dim_value:         { anyOf: [{ type: 'number' }, { type: 'null' }] },
    dim_unit:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    dim_note:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    fix_name:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    fix_category:      { anyOf: [{ type: 'string' }, { type: 'null' }] },
    fix_confirmed:     { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    fix_quantity:      { anyOf: [{ type: 'number' }, { type: 'null' }] },
    fix_dims:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    fix_note:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    mat_name:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    mat_category:      { anyOf: [{ type: 'string' }, { type: 'null' }] },
    mat_format:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
    mat_area_netto:    { anyOf: [{ type: 'number' }, { type: 'null' }] },
    mat_waste_multi:   { anyOf: [{ type: 'number' }, { type: 'null' }] },
    mat_zone:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    mat_note:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    ts_product:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
    ts_format:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
    ts_area_netto:     { anyOf: [{ type: 'number' }, { type: 'null' }] },
    ts_waste_multi:    { anyOf: [{ type: 'number' }, { type: 'null' }] },
    ts_zone:           { anyOf: [{ type: 'string' }, { type: 'null' }] },
    ts_source_page:    { anyOf: [{ type: 'string' }, { type: 'null' }] },
    inst_type:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
    inst_description:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
    inst_layer:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
    inst_question_id:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
    inst_note:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
    sh_description:    { anyOf: [{ type: 'string' }, { type: 'null' }] },
    sh_category:       { anyOf: [{ type: 'string' }, { type: 'null' }] },
    sh_quantity:       { anyOf: [{ type: 'number' }, { type: 'null' }] },
    sh_unit:           { anyOf: [{ type: 'string' }, { type: 'null' }] },
    sh_rule:           { anyOf: [{ type: 'string' }, { type: 'null' }] },
    sh_priority:       { anyOf: [{ type: 'string' }, { type: 'null' }] },
    md_subject:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
    md_impact:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
    md_question:       { anyOf: [{ type: 'string' }, { type: 'null' }] },
    md_severity:       { anyOf: [{ type: 'string' }, { type: 'null' }] },
    hyp_description:   { anyOf: [{ type: 'string' }, { type: 'null' }] },
    hyp_basis:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
    hyp_rule:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    hyp_confirm_with:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: [
    'evidence_type','room_label','confidence_score','confidence_reason','source_anchor',
    'dim_subject','dim_value','dim_unit','dim_note',
    'fix_name','fix_category','fix_confirmed','fix_quantity','fix_dims','fix_note',
    'mat_name','mat_category','mat_format','mat_area_netto','mat_waste_multi','mat_zone','mat_note',
    'ts_product','ts_format','ts_area_netto','ts_waste_multi','ts_zone','ts_source_page',
    'inst_type','inst_description','inst_layer','inst_question_id','inst_note',
    'sh_description','sh_category','sh_quantity','sh_unit','sh_rule','sh_priority',
    'md_subject','md_impact','md_question','md_severity',
    'hyp_description','hyp_basis','hyp_rule','hyp_confirm_with',
  ],
  additionalProperties: false,
}

const PRODUCTION_SCHEMA = {
  type: 'json_schema',
  name: 'evidence_extraction_v1',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      evidence:           { type: 'array', items: EVIDENCE_ITEM_SCHEMA_STRICT },
      questions:          { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, priority: { type: 'string', enum: ['critical','important','optional'] }, rule: { anyOf: [{ type: 'string' }, { type: 'null' }] } }, required: ['id','text','priority','rule'], additionalProperties: false } },
      risks:              { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, severity: { type: 'string', enum: ['high','medium','low'] }, rule: { anyOf: [{ type: 'string' }, { type: 'null' }] } }, required: ['description','severity','rule'], additionalProperties: false } },
      confidence_summary: { type: 'number' },
      missing_data:       { type: 'boolean' },
    },
    required: ['evidence','questions','risks','confidence_summary','missing_data'],
    additionalProperties: false,
  },
}

const TARGETS = ['wanna','parawan','przedściank','gips-karton','geberit','blat','panele','laminowan','gresow']

function checkTargets(text) {
  const lower = text.toLowerCase()
  const found  = []
  const missing = []
  for (const t of TARGETS) {
    if (lower.includes(t.toLowerCase())) found.push(t)
    else missing.push(t)
  }
  return { found, missing }
}

async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('  DIAGNOSTYKA ROOT-CAUSE — R-LIT1 / wanna vs prysznic')
  console.log(`  asset: ${ASSET_ID}`)
  console.log('══════════════════════════════════════════════════════\n')

  // ── 1. Load asset ──────────────────────────────────────────────────────────
  const { data: asset, error } = await sb
    .from('ai_bundle_assets')
    .select('original_filename, storage_path, mime_type, source_role, layer_type')
    .eq('id', ASSET_ID)
    .single()
  if (error || !asset) { console.error('Asset not found:', error?.message); process.exit(1) }
  console.log(`📄 Plik  : ${asset.original_filename}`)
  console.log(`   MIME  : ${asset.mime_type}`)
  console.log(`   role  : ${asset.source_role}`)
  console.log(`   layer : ${asset.layer_type}`)
  console.log(`   path  : ${asset.storage_path}\n`)

  // ── 2. Download ────────────────────────────────────────────────────────────
  const storagePath = asset.storage_path.replace('company-files/', '')
  const { data: fileData, error: dlErr } = await sb.storage
    .from('company-files')
    .download(storagePath)
  if (dlErr || !fileData) { console.error('Download failed:', dlErr?.message); process.exit(1) }

  const arrayBuf = await fileData.arrayBuffer()
  const base64   = Buffer.from(arrayBuf).toString('base64')
  const dataUrl  = `data:${asset.mime_type};base64,${base64}`
  console.log(`✅ Pobrano: ${Math.round(base64.length / 1024)} KB base64\n`)

  // save local copy for manual inspection if needed
  const localPath = path.join(__dirname, '_debug_1b.pdf')
  fs.writeFileSync(localPath, Buffer.from(arrayBuf))
  console.log(`💾 Zapisano lokalnie: ${localPath} (${Math.round(arrayBuf.byteLength/1024)} KB)\n`)

  const systemPrompt = loadSystemPrompt()

  // ══════════════════════════════════════════════════════════════════════════
  // KROK 1 — FREE-FORM: Co model widzi na rysunku? (bez schematu JSON)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('KROK 1 — VISUAL SCAN (free-form, bez schematu JSON)')
  console.log('Pytanie: wymień WSZYSTKIE dosłowne tekst na rysunku')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const freeFormQuestion = `Jesteś ekspertem od analizy rzutów architektonicznych.
Proszę przeanalizuj ten rysunek i odpowiedz wyłącznie w formie listy punktowej:

LISTA 1: Wszystkie dosłowne teksty i adnotacje wpisane na rysunku (cytaty w cudzysłowie), np.:
  - "prysznic 80cm walk-in"
  - "wanna zabudowana + parawan nawannowy"
  - "stelaż geberit + miska WC wisząca"
  - itd.
Wymień KAŻDĄ literalną adnotację widoczną na planszy.

LISTA 2: Jakie pomieszczenia / strefy są zaznaczone na planie?

LISTA 3: Czy są na rysunku słowa: "wanna", "parawan", "przedścianka", "gips-karton", "blat"?
  Odpowiedz TAK/NIE dla każdego słowa i podaj dosłowny cytat jeśli TAK.`

  const t1 = Date.now()
  const freeResp = await openaiRequest({
    model: 'gpt-4o',
    instructions: 'Jesteś ekspertem od analizy rysunków architektonicznych. Czytasz LITERALNE teksty z pliku PDF.',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text',  text: freeFormQuestion },
        { type: 'input_file',  filename: asset.original_filename, file_data: dataUrl }
      ]
    }],
    max_output_tokens: 2000,
  })

  const freeText = freeResp.output?.[0]?.content?.find(c => c.type === 'output_text')?.text
    || freeResp.output?.[0]?.content?.find(c => c.type === 'text')?.text
    || null

  console.log(`⏱  ${Date.now()-t1}ms\n`)
  if (!freeText) {
    console.log('❌ Free-form response empty. RAW:', JSON.stringify(freeResp).slice(0, 500))
  } else {
    console.log('=== MODEL FREE-FORM ANSWER ===')
    console.log(freeText)
    console.log('=== END FREE-FORM ===\n')

    // Check targets in free-form description
    const fc = checkTargets(freeText)
    console.log(`✅ Słowa ZNALEZIONE w visual scan: ${fc.found.join(', ') || '(brak)'}`)
    console.log(`❌ Słowa NIE znalezione w visual scan: ${fc.missing.join(', ') || '(brak)'}\n`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KROK 2 — SCHEMA PRODUCTION: Pełna ekstrakcja (strict schema, jak produkcja)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('KROK 2 — PRODUCTION SCHEMA (strict:true, flat fields)')
  console.log('Identyczny z composite-extract-asset.ts w produkcji')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const userMessage = `[PLIK: "${asset.original_filename}"]
[LAYER: layer_type="functional_layout"]
[ANCHOR_TEMPLATE: "${asset.original_filename} | str:{N} | {nr_rysunku_lub_–} | {tytul_rysunku_lub_–} | {sekcja_lub_element}"]
[PDF_SCAN: Wykonaj PDF_SCAN_PROTOCOL — najpierw zidentyfikuj każdą stronę (nr, tytuł, skalę), POTEM ekstrahuj evidence z każdej strony osobno]
[TYP ASSETU: Rysunek architektoniczny — rzut lub projekt techniczny z wymiarami]
PROTOKÓŁ: wykonaj PDF_SCAN_PROTOCOL — najpierw zidentyfikuj KAŻDĄ stronę, POTEM sweep każdej strony z rzutem osobno.
TABELA NADRYSUNKOWA: czytaj PIERWSZA na każdym rzucie — numer rysunku (np. A-01), tytuł, skala → do source_anchor i confidence_reason.
LEGENDA: czytaj PRZED wymiarami (R-14). Rozróżnij: "wymiary mebli z legendy" (→ fix_dims, NIE dim) vs "wymiary pomieszczenia w świetle" (→ dim).
DIM PRIORYTET: dim_subject = "pomieszczenie — cecha" (np. "łazienka — długość", "pow. podłogi łazienki"). NIGDY nie twórz dim dla mebla.
SWEEP OBOWIĄZKOWY (R-08b): dla KAŻDEGO pomieszczenia widocznego na rzucie.
R-LIT1: jeśli opis jest jawnie wpisany na rysunku (np. "wanna zabudowana + parawan nawannowy") → confirmed=true, confidence ≥ 0.80.
R-MROOM1: rzut całego lokalu → izoluj odczyt adnotacji per pomieszczenie, nie mieszaj między pokojami.`

  const t2 = Date.now()
  const strictResp = await openaiRequest({
    model: 'gpt-4o',
    instructions: systemPrompt,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: userMessage },
        { type: 'input_file', filename: asset.original_filename, file_data: dataUrl }
      ]
    }],
    text: { format: PRODUCTION_SCHEMA },
    max_output_tokens: 5000,
  })

  const strictRaw = strictResp.output?.[0]?.content?.find(c => c.type === 'output_text')?.text
    || strictResp.output?.[0]?.content?.find(c => c.type === 'text')?.text
    || null

  console.log(`⏱  ${Date.now()-t2}ms\n`)

  // Save full raw JSON for inspection
  const rawPath = path.join(__dirname, '_debug_strict_raw.json')
  if (strictRaw) {
    fs.writeFileSync(rawPath, strictRaw)
    console.log(`💾 Surowy JSON zapisany: ${rawPath} (${Math.round(strictRaw.length/1024)} KB)\n`)
  }

  if (!strictRaw) {
    console.log('❌ Strict schema response EMPTY. RAW API response:')
    console.log(JSON.stringify(strictResp).slice(0, 1000))
    process.exit(1)
  }

  // Parse
  let parsedStrict
  try {
    parsedStrict = JSON.parse(strictRaw)
  } catch(e) {
    console.log('❌ JSON parse FAILED. First 800 chars:')
    console.log(strictRaw.slice(0, 800))
    process.exit(1)
  }

  const ev = Array.isArray(parsedStrict.evidence) ? parsedStrict.evidence : []
  console.log(`📋 Items w production schema: ${ev.length}`)
  console.log(`   confidence_summary: ${parsedStrict.confidence_summary}`)
  if (parsedStrict.missing_data) console.log('   ⚠  missing_data: true')
  console.log()

  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    const name = e.fix_name || e.mat_name || e.dim_subject || e.sh_description || e.md_subject || e.hyp_description || '–'
    const note = e.fix_note || e.mat_note || e.inst_description || ''
    console.log(`[${i+1}] ${e.evidence_type} | conf:${e.confidence_score} | confirmed:${e.fix_confirmed ?? '–'} | room:${e.room_label ?? 'null'}`)
    console.log(`    name    : ${name}`)
    console.log(`    fix_note: ${note || '–'}`)
    console.log(`    reason  : ${e.confidence_reason}`)
    console.log(`    anchor  : ${e.source_anchor}`)
    console.log()
  }

  // Check targets
  const strictText = JSON.stringify(ev).toLowerCase()
  const sc = checkTargets(strictText)
  console.log(`✅ Słowa ZNALEZIONE w strict extraction: ${sc.found.join(', ') || '(brak)'}`)
  console.log(`❌ Słowa NIE znalezione w strict extraction: ${sc.missing.join(', ') || '(brak)'}\n`)

  // ══════════════════════════════════════════════════════════════════════════
  // KROK 3 — COMPARISON
  // ══════════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('KROK 3 — ANALIZA ROZBIEŻNOŚCI')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (freeText) {
    const fc = checkTargets(freeText)
    const sc2 = checkTargets(strictText)

    const inFreeNotStrict = fc.found.filter(t => !sc2.found.includes(t))
    const inStrictNotFree = sc2.found.filter(t => !fc.found.includes(t))
    const inNeither       = fc.missing.filter(t => sc2.missing.includes(t))

    console.log(`Widoczne w VISUAL SCAN ale NIE w extraction: ${inFreeNotStrict.join(', ') || '(brak)'}`)
    console.log(`  → JEŚLI tu jest "wanna" → problem: model widzi, ale nie enkoduje w JSON`)
    console.log()
    console.log(`W extraction ale NIE w visual scan: ${inStrictNotFree.join(', ') || '(brak)'}`)
    console.log()
    console.log(`NIE znalezione w żadnym kroku: ${inNeither.join(', ') || '(brak)'}`)
    console.log(`  → JEŚLI tu jest "wanna" → problem: model nie widzi adnotacji na pliku`)
    console.log()

    // Diagnosis
    console.log('════ DIAGNOZA ═══════════════════════════════════════')
    const wannaInFree   = freeText.toLowerCase().includes('wanna')
    const wannaInStrict = strictText.includes('wanna')
    const prysznicInFree = freeText.toLowerCase().includes('prysznic')

    if (wannaInFree && !wannaInStrict) {
      console.log('⚡ PRZYCZYNA: MODEL WIDZI WANNĘ (visual scan) ALE NIE ENKODUJE DO JSON')
      console.log('   → Diagnoza: schema constraint lub token limit wycina wanne z output')
      console.log('   → Fix: zwiększyć token limit LUB zmienić strategię schematu')
    } else if (!wannaInFree && !wannaInStrict) {
      console.log('⚡ PRZYCZYNA: MODEL NIE CZYTA "WANNA" ZE STORED FILE')
      console.log('   → Diagnoza: plik w Supabase Storage różni się od pliku który ma user')
      console.log('               ALBO adnotacje rysunkowe są tekstem wektorowym nieodczytywanym przez GPT Vision')
      if (prysznicInFree) {
        console.log('   → Model czyta "prysznic" — to jest DOSŁOWNA ADNOTACJA w pliku storage')
        console.log('   → Hipoteza: plik 1.1 B w storage = wariant z prysznicem, nie z wanną')
      }
    } else if (!wannaInFree && wannaInStrict) {
      console.log('⚡ PRZYCZYNA: SPRZECZNOŚĆ — JSON ma wannę, visual scan nie')
      console.log('   → Diagnoza: nieprawdopodobne, wymaga sprawdzenia raw JSON')
    } else {
      console.log('⚡ WANNA ZNALEZIONA W OBU KROKACH')
      console.log('   → Problem jest gdzie indziej (parser, DB persistence)')
    }
    console.log('════════════════════════════════════════════════════')
  }

  console.log(`\n💾 Pliki diagnostyczne:`)
  console.log(`   ${localPath}  ← PDF do ręcznej weryfikacji`)
  console.log(`   ${rawPath}    ← pełny raw JSON z production schema`)
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1) })
