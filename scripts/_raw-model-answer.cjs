#!/usr/bin/env node
// _raw-model-answer.cjs
// Ask the model what it sees on the stored file — targeted question for bathroom annotations.
// Prints model answer verbatim with no string-matching post-processing.

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')
const https = require('https')

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
      let raw = ''; res.on('data', c => raw += c)
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch(e) { reject(e) } })
    })
    req.on('error', reject); req.write(data); req.end()
  })
}

async function main() {
  const { data: asset } = await sb.from('ai_bundle_assets')
    .select('original_filename, storage_path, mime_type')
    .eq('id', ASSET_ID).single()

  const spath = asset.storage_path.replace('company-files/', '')
  const { data: fileData } = await sb.storage.from('company-files').download(spath)
  const buf    = Buffer.from(await fileData.arrayBuffer())
  const base64 = buf.toString('base64')
  const dataUrl = `data:${asset.mime_type};base64,${base64}`

  console.log(`Plik: ${asset.original_filename}  (${(buf.length/1024).toFixed(1)} KB)\n`)

  const q = `Przeanalizuj ten plik PDF.

KROK 1 — Wymień dosłownie WSZYSTKIE teksty/adnotacje widoczne na rysunku łazienki, cytując każdą w osobnej linii.

KROK 2 — Czy na dole rysunku, poza prostokątem łazienki, widać bloki opisowe ze strzałkami wskazującymi elementy?
Jeśli TAK — podaj je dosłownie.

KROK 3 — Odpowiedz TAK lub NIE na każde pytanie:
a) Czy w pliku jest "wanna zabudowana"?
b) Czy w pliku jest "parawan nawannowy"?  
c) Czy w pliku jest "prysznic walk-in"?
d) Czy w pliku jest "przedścianka z płyt gips-karton"?
e) Czy w pliku jest "długi blat, umywalka"?
f) Ile stron ma PDF?`

  const t = Date.now()
  const resp = await openaiRequest({
    model: 'gpt-4o',
    instructions: 'Jesteś ekspertem od analizy rysunków budowlanych. Czytasz LITERALNIE każdy tekst na rysunku.',
    input: [{ role: 'user', content: [
      { type: 'input_text',  text: q },
      { type: 'input_file', filename: asset.original_filename, file_data: dataUrl }
    ]}],
    max_output_tokens: 2000,
  })

  const text = resp.output?.[0]?.content?.find(c => c.type === 'output_text' || c.type === 'text')?.text || '(empty)'
  console.log(`⏱  ${Date.now()-t}ms\n`)
  console.log('═══ VERBATIM MODEL ANSWER ═══════════════════════════')
  console.log(text)
  console.log('═══════════════════════════════════════════════════════')
}

main().catch(e => { console.error(e.message); process.exit(1) })
