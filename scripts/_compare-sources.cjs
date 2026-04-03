#!/usr/bin/env node
// _compare-sources.cjs
// Compare the PDF in Supabase Storage vs what the model sees.
// Targeted questions:
//   - Does the file contain "wanna zabudowana" or "prysznic"?
//   - List exact bathroom annotations
// NO DB write.

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const eq = l.indexOf('=')
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
})
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY   = env.OPENAI_API_KEY
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const ASSET_ID = process.argv[2] || '89f5dfa5-9e13-4dbe-bcf0-66ca63af440f'

function openaiRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/responses', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let raw = ''; res.on('data', c => raw += c); res.on('end', () => { try { resolve(JSON.parse(raw)) } catch(e) { reject(e) } })
    })
    req.on('error', reject); req.write(data); req.end()
  })
}

async function main() {
  // ── 1. Storage asset metadata ────────────────────────────────────────────
  const { data: asset } = await sb.from('ai_bundle_assets')
    .select('id, original_filename, storage_path, mime_type, bundle_id, company_id, created_at, extraction_status')
    .eq('id', ASSET_ID).single()

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  PORÓWNANIE ŹRÓDEŁ — storage vs screenshot           ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  console.log('── STORAGE ASSET ──────────────────────────────────────')
  console.log(`  asset_id      : ${asset.id}`)
  console.log(`  filename      : ${asset.original_filename}`)
  console.log(`  storage_path  : ${asset.storage_path}`)
  console.log(`  bundle_id     : ${asset.bundle_id}`)
  console.log(`  company_id    : ${asset.company_id}`)
  console.log(`  created_at    : ${asset.created_at}`)
  console.log(`  status        : ${asset.extraction_status}\n`)

  // ── 2. Download + hash ────────────────────────────────────────────────────
  const spath = asset.storage_path.replace('company-files/', '')
  const { data: fileData } = await sb.storage.from('company-files').download(spath)
  const arrayBuf = await fileData.arrayBuffer()
  const buf      = Buffer.from(arrayBuf)
  const sha256   = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase()
  const md5      = crypto.createHash('md5').update(buf).digest('hex').toUpperCase()
  const base64   = buf.toString('base64')
  const dataUrl  = `data:${asset.mime_type};base64,${base64}`

  console.log('── STORAGE FILE FINGERPRINT ──────────────────────────')
  console.log(`  filename      : ${asset.original_filename}`)
  console.log(`  size_bytes    : ${buf.length}  (${(buf.length/1024).toFixed(1)} KB)`)
  console.log(`  SHA256        : ${sha256}`)
  console.log(`  MD5           : ${md5}\n`)

  // ── 3. Screenshot annotations (known facts from image) ───────────────────
  console.log('── SCREENSHOT (załącznik użytkownika) — ZNANE FAKTY ──')
  console.log('  filename      : "1.1 B - układ funkcjonalny 1 B.pdf" (z tytułu rozmowy)')
  console.log('  Widoczne literalne adnotacje:')
  console.log('    ✓ "wanna zabudowana + parawan nawannowy"')
  console.log('    ✓ "przedścianka z płyt gips-karton do ukrycia rur wodnych i utworzenia półki na kosmetyki"')
  console.log('    ✓ "stelaż typu geberit + miska wc wisząca + szafka powyżej stelaża"')
  console.log('    ✓ "długi blat, umywalka, pod blatem szafki"')
  console.log('  Wymiary widoczne: 47.2, 85.4, 170, 237.2, 206.7, 281, 200, itd.')
  console.log('  Strefa łazienki: prostokąt z wanną + parawan + WC + blat z umywalką')
  console.log('  Filename hint: "1 B" w tytule pliku może wskazywać nową wersję\n')

  // ── 4. Model targeted query on stored PDF ────────────────────────────────
  console.log('── TARGETED QUERY na stored PDF ───────────────────────')
  console.log('Pytam model: "Czy widzisz wannę czy prysznic? Cytuj DOSŁOWNIE wszystkie adnotacje strefy łazienki."')

  const q = `Przeanalizuj ten rysunek BARDZO dokładnie.

Odpowiedz na pytania:

1. Czy w strefie łazienki widzisz WANNĘ czy PRYSZNIC? 
   Odpisz dokładnie co widzisz jako symbol/kształt i co jest wpisane tekstem.

2. Wymień DOSŁOWNIE (w cudzysłowie) KAŻDĄ adnotację tekstową widoczną w strefie łazienki.
   Uwaga: mogą być wpisane poza symbolem, poniżej planu, jako opisy do wskazówek (strzałek).

3. Czy widzisz poniżej rysunku łazienki jakieś bloki tekstowe z opisami wskazującymi na:
   - "wanna zabudowana"
   - "parawan nawannowy"  
   - "stelaż geberit"
   - "przedścianka"
   - "długi blat, umywalka"

4. Ile stron ma ten plik PDF? Czy na każdej stronie jest coś innego?

5. Podaj rozmiary wymiarowe które widzisz w łazience (liczby z liniami wymiarowymi).`

  const t = Date.now()
  const resp = await openaiRequest({
    model: 'gpt-4o',
    instructions: 'Jesteś ekspertem od analizy rysunków architektonicznych. Czytasz literalne teksty z PDF z maksymalną dokładnością.',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: q },
        { type: 'input_file', filename: asset.original_filename, file_data: dataUrl }
      ]
    }],
    max_output_tokens: 3000,
  })

  const text = resp.output?.[0]?.content?.find(c => c.type === 'output_text' || c.type === 'text')?.text || null
  console.log(`⏱  ${Date.now()-t}ms\n`)

  if (!text) {
    console.log('❌ Empty response. RAW:', JSON.stringify(resp).slice(0,500))
  } else {
    console.log('=== MODEL ANSWER (stored file) ===')
    console.log(text)
    console.log('=== END ===\n')
  }

  // ── 5. List ALL storage files for this company to find potential new version ─
  console.log('── ALL PDFs w storage tej firmy ──────────────────────')
  const dirs = ['messages', 'projects', 'ai-bundles', 'documents']
  for (const dir of dirs) {
    const { data: files } = await sb.storage.from('company-files')
      .list(`${asset.company_id}/${dir}`, { limit: 100, search: '1.1' })
    if (files?.length) {
      for (const f of files) {
        console.log(`  [${dir}] ${f.name} | ${(f.metadata?.size/1024||0).toFixed(1)} KB | ${f.updated_at}`)
      }
    }
  }

  // ── 6. Also check all assets DB for similar filenames ────────────────────
  const { data: allAssets } = await sb.from('ai_bundle_assets')
    .select('id, original_filename, storage_path, created_at, extraction_status')
    .ilike('original_filename', '%uk%ad%')
    .order('created_at', { ascending: false })
    .limit(20)
  
  console.log('\n── DB: assets z "układ" w nazwie ─────────────────────')
  for (const a of allAssets || []) {
    console.log(`  ${a.id.slice(0,8)} | ${a.original_filename} | ${a.status} | ${a.created_at?.slice(0,19)}`)
  }

  // ── 7. Verdict ────────────────────────────────────────────────────────────
  if (text) {
    const lower = text.toLowerCase()
    const hasWanna    = lower.includes('wanna')
    const hasPrysznic = lower.includes('prysznic')
    const hasParawan  = lower.includes('parawan')
    const hasGeberit  = lower.includes('geberit')
    const hasBlat     = lower.includes('blat')
    const hasPrzed    = lower.includes('przedścian') || lower.includes('gips-karton') || lower.includes('karton-gips')

    console.log('\n╔══════════════════════════════════════════════════════╗')
    console.log('║  WERDYKT PORÓWNANIA                                  ║')
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log('\n  STORED FILE zwraca:')
    console.log(`    wanna:        ${hasWanna    ? '✅ TAK' : '❌ NIE'}`)
    console.log(`    parawan:      ${hasParawan  ? '✅ TAK' : '❌ NIE'}`)
    console.log(`    prysznic:     ${hasPrysznic ? '⚠️  TAK' : '✅ NIE'}`)
    console.log(`    geberit:      ${hasGeberit  ? '✅ TAK' : '❌ NIE'}`)
    console.log(`    blat:         ${hasBlat     ? '✅ TAK' : '❌ NIE'}`)
    console.log(`    przedścianka: ${hasPrzed    ? '✅ TAK' : '❌ NIE'}`)
    console.log()

    const screenshotAnnotations = ['wanna', 'parawan', 'geberit', 'blat', 'przedścian']
    const foundInStored = screenshotAnnotations.filter(a => text.toLowerCase().includes(a))
    const missingInStored = screenshotAnnotations.filter(a => !text.toLowerCase().includes(a))

    if (missingInStored.length === 0) {
      console.log('  WYNIK: ✅ PLIKI SĄ TYM SAMYM DOKUMENTEM')
      console.log('  Stored file zawiera wszystkie adnotacje ze screenshota.')
      console.log('  Root cause: extractor pomija adnotacje spoza strefy łazienki lub token limit.')
    } else if (hasPrysznic && !hasWanna) {
      console.log('  WYNIK: ❌ PLIKI SĄ RÓŻNE')
      console.log(`  Stored file: prysznic walk-in (NIE wanna)`)
      console.log(`  Screenshot:  wanna zabudowana + parawan`)
      console.log(`  BRAKUJE w stored: ${missingInStored.join(', ')}`)
      console.log()
      console.log('  ROOT CAUSE: W Supabase Storage jest STARA wersja pliku (wariant prysznic).')
      console.log('  Użytkownik ma NOWSZĄ wersję z wanną, ale nie została ona uploadowana do storage.')
      console.log()
      console.log('  MINIMALNY NASTĘPNY KROK:')
      console.log('  1. Upload nowej wersji PDF przez UI (plik z wanną)')
      console.log('  2. Sprawdź czy nowy asset_id powstaje po uploadziei')
      console.log('  3. Uruchom ekstrakcję na nowym asset_id')
    } else {
      console.log('  WYNIK: ⚠️  WYNIKI NIEJEDNOZNACZNE')
      console.log(`  Znalezione: ${foundInStored.join(', ')}`)
      console.log(`  Brakuje: ${missingInStored.join(', ')}`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1) })
