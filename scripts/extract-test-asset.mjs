#!/usr/bin/env node
// =============================================================================
// scripts/extract-test-asset.mjs
// =============================================================================
// DEV-ONLY script: runs the REAL project_vision extractor on a registered
// bundle asset by calling the composite-extract-asset Netlify function.
//
// Usage:
//   node scripts/extract-test-asset.mjs --asset <asset_id>
//   node scripts/extract-test-asset.mjs --asset <asset_id> --local
//   node scripts/extract-test-asset.mjs --bundle <bundle_id>          # all pending
//   node scripts/extract-test-asset.mjs --asset <asset_id> --dry-run
//
// Flags:
//   --asset <id>    Extract a single asset by its ai_bundle_assets.id
//   --bundle <id>   Extract ALL pending assets in a bundle (sequential)
//   --local         Skip Netlify function call, use direct OpenAI API call
//                   (requires OPENAI_API_KEY in env)
//   --dry-run       Show what would be extracted, don't call AI
//
// Pre-requisites:
//   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (or .env)
//   - Asset must exist in ai_bundle_assets with a valid storage_path
//   - File must exist in Supabase Storage at that storage_path
//   - For --local: OPENAI_API_KEY in env
//   - For non-local: Netlify function deployed or running locally (netlify dev)
//
// Does NOT: touch P0, modify extractors, change production data flow
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ── Env setup ─────────────────────────────────────────────────────────────────

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadDotEnv()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const FUNCTION_BASE = process.env.NETLIFY_FUNCTION_BASE || 'http://localhost:8888/.netlify/functions'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const assetIdArg  = args.includes('--asset')  ? args[args.indexOf('--asset')  + 1] : null
const bundleIdArg = args.includes('--bundle') ? args[args.indexOf('--bundle') + 1] : null
const useLocal    = args.includes('--local')
const dryRun      = args.includes('--dry-run')

if (!assetIdArg && !bundleIdArg) {
  console.error('Usage: node scripts/extract-test-asset.mjs --asset <id> [--local] [--dry-run]')
  console.error('       node scripts/extract-test-asset.mjs --bundle <id> [--local] [--dry-run]')
  process.exit(1)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  LoftDesk P1 — extract-test-asset')
  console.log(`  mode: ${dryRun ? 'DRY RUN' : useLocal ? 'LOCAL (direct OpenAI)' : 'NETLIFY FUNCTION'}`)
  console.log('═══════════════════════════════════════════════════════════')

  const assetIds = await resolveAssetIds()
  console.log(`\n🎯 Assets to extract: ${assetIds.length}`)

  for (const assetId of assetIds) {
    console.log(`\n──────────────────────────────────────────────`)
    await extractSingleAsset(assetId)
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Done.')
  console.log('═══════════════════════════════════════════════════════════')
}

// ── Resolve target assets ─────────────────────────────────────────────────────

async function resolveAssetIds() {
  if (assetIdArg) return [assetIdArg]

  // --bundle mode: get all pending assets
  const { data, error } = await sb
    .from('ai_bundle_assets')
    .select('id, original_filename, extraction_status')
    .eq('bundle_id', bundleIdArg)
    .order('source_priority', { ascending: true })

  if (error) { console.error('❌ Cannot list assets:', error.message); process.exit(1) }
  if (!data || data.length === 0) { console.error('❌ No assets in bundle', bundleIdArg); process.exit(1) }

  const pending = data.filter(a => a.extraction_status === 'pending')
  console.log(`   Bundle ${bundleIdArg}: ${data.length} total assets, ${pending.length} pending`)
  for (const a of data) {
    const mark = a.extraction_status === 'pending' ? '⏳' : a.extraction_status === 'extracted' ? '✅' : '❌'
    console.log(`   ${mark} ${a.original_filename} (${a.extraction_status})`)
  }

  if (pending.length === 0) {
    console.log('   All assets already processed. Use --asset <id> to re-extract a specific one.')
    process.exit(0)
  }

  return pending.map(a => a.id)
}

// ── Extract a single asset ────────────────────────────────────────────────────

async function extractSingleAsset(assetId) {
  // 1. Load asset metadata
  const { data: asset, error: assetErr } = await sb
    .from('ai_bundle_assets')
    .select('*')
    .eq('id', assetId)
    .single()

  if (assetErr || !asset) {
    console.error(`❌ Asset ${assetId} not found:`, assetErr?.message)
    return
  }

  console.log(`📄 Asset: ${asset.original_filename}`)
  console.log(`   id:           ${asset.id}`)
  console.log(`   bundle_id:    ${asset.bundle_id}`)
  console.log(`   layer_type:   ${asset.layer_type ?? '–'}`)
  console.log(`   source_role:  ${asset.source_role}`)
  console.log(`   mime_type:    ${asset.mime_type}`)
  console.log(`   storage_path: ${asset.storage_path}`)
  console.log(`   status:       ${asset.extraction_status}`)

  if (asset.extraction_status === 'extracted') {
    console.log(`   ⚠ Already extracted. Extracting again will add duplicate evidence.`)
  }

  if (dryRun) {
    console.log('   [DRY RUN] Would fetch file and call extractor.')
    return
  }

  // 2. Download file from Supabase Storage
  console.log(`   📥 Downloading from storage...`)
  const fileBase64 = await downloadAsBase64(asset.storage_path)
  if (!fileBase64) {
    console.error(`   ❌ Failed to download file from storage.`)
    return
  }
  console.log(`   ✅ Downloaded: ${Math.round(fileBase64.length / 1024)} KB (base64)`)

  // 3. Call extractor
  const t0 = Date.now()
  let result

  if (useLocal) {
    result = await callLocalExtractor(asset, fileBase64)
  } else {
    result = await callNetlifyFunction(asset, fileBase64)
  }

  const elapsed = Date.now() - t0

  // 4. Report
  if (result?.ok) {
    console.log(`\n   ✅ Extraction successful (${elapsed}ms)`)
    console.log(`   evidence_count:     ${result.evidence_count}`)
    console.log(`   confidence_summary: ${result.confidence_summary}`)
    console.log(`   missing_data:       ${result.missing_data}`)
    if (result.questions?.length) {
      console.log(`   questions:`)
      for (const q of result.questions) console.log(`     [${q.priority}] ${q.id}: ${q.text}`)
    }
    if (result.risks?.length) {
      console.log(`   risks:`)
      for (const r of result.risks) console.log(`     [${r.severity}] ${r.description}`)
    }
  } else {
    console.error(`   ❌ Extraction failed (${elapsed}ms):`, result?.error ?? result?.message ?? 'unknown')
  }

  // 5. Show evidence detail from DB
  await showEvidenceDetail(assetId)
}

// ── Download file from Supabase Storage ────────────────────────────────────────

async function downloadAsBase64(storagePath) {
  // Determine bucket from path: first segment is bucket, rest is path
  // Standard pattern: "ai-inputs/test/file.pdf" → bucket="ai-inputs", path="test/file.pdf"
  // Or it could be a flat path in a default bucket
  const parts = storagePath.split('/')
  let bucket, filePath

  if (parts.length >= 2) {
    bucket = parts[0]
    filePath = parts.slice(1).join('/')
  } else {
    bucket = 'ai-inputs'
    filePath = storagePath
  }

  const { data, error } = await sb.storage.from(bucket).download(filePath)

  if (error) {
    // Try alternative: maybe the whole path is in a single default bucket
    console.warn(`   ⚠ Bucket "${bucket}" / "${filePath}" failed: ${error.message}`)
    console.warn(`   Trying "project-files" bucket with full path...`)

    const { data: data2, error: error2 } = await sb.storage.from('project-files').download(storagePath)
    if (error2) {
      console.error(`   ❌ Also failed with "project-files": ${error2.message}`)
      return null
    }
    if (!data2) return null
    const buffer2 = Buffer.from(await data2.arrayBuffer())
    return buffer2.toString('base64')
  }

  if (!data) return null
  const buffer = Buffer.from(await data.arrayBuffer())
  return buffer.toString('base64')
}

// ── Call Netlify function ──────────────────────────────────────────────────────

async function callNetlifyFunction(asset, fileBase64) {
  const url = `${FUNCTION_BASE}/composite-extract-asset`
  console.log(`   🌐 Calling: ${url}`)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Dev mode — function accepts requests without auth when SUPABASE_ANON_KEY not set
        'Authorization': 'Bearer dev-test-token',
      },
      body: JSON.stringify({
        asset_id:    asset.id,
        file_base64: fileBase64,
        file_mime:   asset.mime_type,
        source_role: asset.source_role ?? undefined,
        room_hint:   asset.room_hint ?? undefined,
      }),
    })

    const body = await resp.json()
    return body
  } catch (e) {
    return { ok: false, error: 'network_error', message: e.message }
  }
}

// ── Direct OpenAI call (--local mode) ─────────────────────────────────────────

async function callLocalExtractor(asset, fileBase64) {
  if (!OPENAI_API_KEY) {
    console.error('   ❌ --local requires OPENAI_API_KEY in env')
    return { ok: false, error: 'no_api_key' }
  }

  const model = process.env.OPENAI_MODEL_VISION || process.env.OPENAI_MODEL || 'gpt-4o'
  console.log(`   🤖 Direct OpenAI call (model: ${model})`)

  // Build prompt — inline version of evidence.prompt.ts buildEvidenceUserMessage
  const sourceRole = asset.source_role ?? 'unknown'
  const roomHint = asset.room_hint ?? null
  const userMessage = buildUserMessage(sourceRole, roomHint, asset)

  const isPdf = asset.mime_type === 'application/pdf'
  const isImage = asset.mime_type?.startsWith('image/')

  const content = [{ type: 'input_text', text: userMessage }]

  if (isPdf) {
    content.push({ type: 'input_file', filename: asset.original_filename, file_data: `data:application/pdf;base64,${fileBase64}` })
  } else if (isImage) {
    content.push({ type: 'input_image', image_url: `data:${asset.mime_type};base64,${fileBase64}` })
  } else {
    return { ok: false, error: 'unsupported_type', message: `Unsupported MIME: ${asset.mime_type}` }
  }

  // System prompt — inline copy of the core portion
  const systemPrompt = getSystemPromptSummary()

  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: [{ role: 'user', content }],
        text: { format: buildResponseFormat() },
        max_output_tokens: 5_000,
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text()
      console.error(`   OpenAI HTTP ${resp.status}:`, errBody.slice(0, 300))
      await markAssetFailed(asset.id, asset.bundle_id, `OpenAI ${resp.status}`)
      return { ok: false, error: `openai_${resp.status}`, message: errBody.slice(0, 200) }
    }

    const data = await resp.json()
    const aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
    const parsed = JSON.parse(aiRaw)

    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : []
    const confidence_summary = typeof parsed.confidence_summary === 'number' ? parsed.confidence_summary : 0
    const missing_data = typeof parsed.missing_data === 'boolean' ? parsed.missing_data : true

    // Persist through evidence-persist logic (inline for script context)
    const persistResult = await persistLocally(asset, evidence, parsed, confidence_summary, missing_data)

    return {
      ok: true,
      asset_id: asset.id,
      bundle_id: asset.bundle_id,
      evidence_count: persistResult.evidence_count,
      confidence_summary,
      missing_data,
      questions: parsed.questions ?? [],
      risks: parsed.risks ?? [],
    }
  } catch (e) {
    await markAssetFailed(asset.id, asset.bundle_id, e.message)
    return { ok: false, error: 'ai_call_failed', message: e.message }
  }
}

// ── Persist locally (--local mode) ────────────────────────────────────────────

async function persistLocally(asset, evidence, parsed, confidence_summary, missing_data) {
  // Mark as processing
  await sb.from('ai_bundle_assets').update({ extraction_status: 'processing' }).eq('id', asset.id)

  // Map flat evidence to DB rows
  // FIX: apply buildStructuredAnchor before persist — mirrors composite-extract-asset.ts
  const filename = asset.original_filename ?? `asset_${asset.id.slice(0, 8)}`
  const rows = evidence.map(item => ({
    bundle_id:         asset.bundle_id,
    asset_id:          asset.id,
    company_id:        asset.company_id,
    project_id:        asset.project_id,
    extractor_type:    'project_vision',
    evidence_type:     item.evidence_type,
    content:           flatToContent(item),
    room_label:        item.room_label ?? null,
    confidence_score:  typeof item.confidence_score === 'number' ? Math.max(0, Math.min(1, item.confidence_score)) : null,
    confidence_reason: item.confidence_reason ?? '',
    source_anchor:     buildStructuredAnchor(filename, asset.source_role ?? 'unknown', asset.layer_type ?? null, item.source_anchor),
    conflict_ids:      [],
    fused:             false,
  }))

  if (rows.length === 0) {
    rows.push({
      bundle_id:         asset.bundle_id,
      asset_id:          asset.id,
      company_id:        asset.company_id,
      project_id:        asset.project_id,
      extractor_type:    'project_vision',
      evidence_type:     'missing_data',
      content:           { subject: 'asset_content', impact: 'Cannot extract evidence from this asset', severity: 'critical' },
      room_label:        null,
      confidence_score:  0,
      confidence_reason: 'AI returned empty evidence',
      // FIX: apply buildStructuredAnchor even on fallback row
      source_anchor:     buildStructuredAnchor(filename, asset.source_role ?? 'unknown', asset.layer_type ?? null, null),
      conflict_ids:      [],
      fused:             false,
    })
  }

  const { error: insertErr } = await sb.from('ai_extraction_results').insert(rows)
  if (insertErr) {
    await sb.from('ai_bundle_assets').update({
      extraction_status: 'failed',
      processing_error:  insertErr.message,
    }).eq('id', asset.id)
    return { ok: false, evidence_count: 0 }
  }

  await sb.from('ai_bundle_assets').update({
    extraction_status: 'extracted',
    processing_error:  null,
  }).eq('id', asset.id)

  try {
    await sb.rpc('increment_bundle_counter', {
      p_bundle_id: asset.bundle_id,
      p_column: 'extracted_count',
      p_delta: 1,
    })
  } catch { /* non-fatal */ }

  return { ok: true, evidence_count: rows.length }
}

async function markAssetFailed(assetId, bundleId, message) {
  await sb.from('ai_bundle_assets').update({
    extraction_status: 'failed',
    processing_error:  message?.slice(0, 500),
  }).eq('id', assetId)
}

// ── Show evidence from DB ─────────────────────────────────────────────────────

async function showEvidenceDetail(assetId) {
  const { data: rows } = await sb
    .from('ai_extraction_results')
    .select('evidence_type, content, room_label, confidence_score, confidence_reason, source_anchor')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: true })

  if (!rows || rows.length === 0) {
    console.log('   📋 No evidence in DB for this asset.')
    return
  }

  console.log(`\n   📋 Evidence in DB (${rows.length} items):`)
  for (const r of rows) {
    const score = r.confidence_score != null ? `${(r.confidence_score * 100).toFixed(0)}%` : '–'
    const room = r.room_label ?? '–'
    const anchor = r.source_anchor ?? '–'
    console.log(`     [${r.evidence_type}] room=${room} conf=${score} anchor="${anchor}"`)
    console.log(`       reason: ${r.confidence_reason}`)
    // Show key content fields
    const c = r.content
    if (c && typeof c === 'object') {
      const keys = Object.keys(c).filter(k => c[k] != null).slice(0, 5)
      if (keys.length > 0) {
        console.log(`       content: ${keys.map(k => `${k}=${JSON.stringify(c[k])}`).join(', ')}`)
      }
    }
  }
}

// ── Flat → typed content mapper (mirrors evidence-persist.ts) ─────────────────

function flatToContent(item) {
  switch (item.evidence_type) {
    case 'dimension':
      return clean({ subject: item.dim_subject ?? 'other', value: item.dim_value ?? 0, unit: item.dim_unit ?? 'm2', room_label: item.room_label, note: item.dim_note })
    case 'fixture':
      return clean({ name: item.fix_name ?? '', category: item.fix_category ?? 'other', confirmed: item.fix_confirmed ?? false, quantity: item.fix_quantity ?? 1, dims: item.fix_dims, note: item.fix_note })
    case 'material':
      return clean({ name: item.mat_name ?? '', category: item.mat_category ?? 'other', format: item.mat_format, area_netto: item.mat_area_netto, waste_multi: item.mat_waste_multi, zone: item.mat_zone, note: item.mat_note })
    case 'tile_spec':
      return clean({ product: item.ts_product ?? '', format: item.ts_format ?? '', area_netto: item.ts_area_netto ?? 0, waste_multi: item.ts_waste_multi ?? 1.10, zone: item.ts_zone ?? '', source_page: item.ts_source_page })
    case 'installation':
      return clean({ type: item.inst_type ?? 'other', description: item.inst_description ?? '', layer: item.inst_layer ?? 'unknown', question_id: item.inst_question_id, note: item.inst_note })
    case 'scope_hint':
      return clean({ description: item.sh_description ?? '', category: item.sh_category ?? 'other', priority: item.sh_priority ?? 'likely', quantity: item.sh_quantity, unit: item.sh_unit, rule: item.sh_rule })
    case 'missing_data':
      return clean({ subject: item.md_subject ?? '', impact: item.md_impact ?? '', severity: item.md_severity ?? 'important', required_question: item.md_question })
    case 'hypothesis':
      return clean({ description: item.hyp_description ?? '', basis: item.hyp_basis ?? '', rule: item.hyp_rule, confirm_with: item.hyp_confirm_with })
    default:
      return {}
  }
}

function clean(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v != null) out[k] = v
  }
  return out
}

// ── buildStructuredAnchor (mirrors composite-extract-asset.ts) ───────────────
// Same logic as the Netlify function — guarantees filename in every anchor.

function buildStructuredAnchor(filename, sourceRole, layerType, aiAnchor) {
  const trimmed = (aiAnchor ?? '').trim()
  if (trimmed && trimmed.includes(filename)) return trimmed
  const parts = [filename, sourceRole]
  if (layerType && layerType !== 'unknown') parts.push(layerType)
  parts.push(trimmed.length > 0 ? trimmed : 'anchor:unresolved')
  return parts.join(' | ')
}

// ── Inline prompt builder (mirrors evidence.prompt.ts) ────────────────────────
// Updated: accepts asset for filename + anchor template injection (FIX).

function buildUserMessage(sourceRole, roomHint, asset) {
  const lines = []
  const filename = asset?.original_filename ?? null
  const layerType = asset?.layer_type ?? null

  // FIX: inject filename + anchor template so AI uses structured format
  if (filename) {
    lines.push(`[PLIK: "${filename}"]`)
  }
  if (layerType && layerType !== 'unknown') {
    lines.push(`[LAYER: layer_type="${layerType}"]`)
  }
  if (filename) {
    const isPdf = filename.toLowerCase().endsWith('.pdf')
    const isRender = sourceRole === 'design_visualization'
    const isPhoto = sourceRole === 'site_photo' || sourceRole === 'progress_photo'
    if (isPdf) {
      lines.push(`[ANCHOR_TEMPLATE: "${filename} | str:{N} | {nazwa_sekcji_lub_tabeli}"]`)
    } else if (isRender) {
      lines.push(`[ANCHOR_TEMPLATE: "${filename} | render | {widoczne_elementy} | {widok}"]`)
    } else if (isPhoto) {
      lines.push(`[ANCHOR_TEMPLATE: "${filename} | photo | {widoczny_stan} | {obszar_lub_faza}"]`)
    } else {
      lines.push(`[ANCHOR_TEMPLATE: "${filename} | {typ} | {lokalizacja}"]`)
    }
  }

  switch (sourceRole) {
    case 'architectural_drawing':
      lines.push('[TYP ASSETU: Rysunek architektoniczny — rzut techniczny z wymiarami]')
      lines.push('Szukaj: wymiarów pomieszczeń, wysokości ścian/sufitu, legendy, opisu materiałów, armatury na rzucie.')
      break
    case 'design_visualization':
      lines.push('[TYP ASSETU: Wizualizacja 3D / render wnętrza]')
      lines.push('Szukaj: armatury, materiałów, instalacji widocznych. Confidence max 0.65 bez skali.')
      break
    case 'technical_spec':
      lines.push('[TYP ASSETU: Specyfikacja techniczna / zestawienie materiałów]')
      lines.push('Szukaj: ZESTAWIENIE OKŁADZIN. Gold truth R-26. Confidence 0.95.')
      break
    case 'installation_drawing':
      lines.push('[TYP ASSETU: Schemat instalacji — wod-kan lub elektryka]')
      lines.push('Szukaj: punktów wod-kan, grzejników, gniazd. Elektryka: separate_layer R-18.')
      break
    case 'site_photo': case 'progress_photo':
      lines.push('[TYP ASSETU: Zdjęcie budowy / postęp prac]')
      lines.push('Confidence max 0.70. Szukaj widocznych instalacji, stanu ścian.')
      break
    default:
      lines.push('[TYP ASSETU: Nieznany — analizuj jako ogólny materiał projektowy]')
      break
  }
  if (roomHint) {
    lines.push(`\nKONTEKST POMIESZCZENIA: "${roomHint}".`)
  }
  if (filename) {
    lines.push('\nUżyj source_anchor w formacie z podanego ANCHOR_TEMPLATE dla każdego evidence item.')
  }
  lines.push('\nZanalizuj ten asset i zwróć evidence[] zgodnie ze schematem JSON.')
  return lines.join('\n')
}

function getSystemPromptSummary() {
  // Core prompt for direct calls — mirrors EVIDENCE_SYSTEM_PROMPT in evidence.prompt.ts
  return `Jesteś ekspertem od analizy dokumentów projektowych dla polskich firm remontowo-wykończeniowych.
ZADANIE: Ekstrakcja dowodów (evidence) z JEDNEGO ASSETU.
NIE tworzysz finalnego zakresu ani wyceny. Wydobywasz fakty, hipotezy, braki.

RODZAJE EVIDENCE: dimension, fixture, material, tile_spec, installation, scope_hint, missing_data, hypothesis.

REGUŁY: R-12 (hierarchia confidence), R-14 (czytaj legendę pierwsza), R-17 (walk-in ≠ kabina),
R-18 (elektryka = separate_layer), R-19 (zawsze generuj output), R-21 (2 strefy = 2 items),
R-26 (ZESTAWIENIE OKŁADZIN = gold truth, confidence 0.95).

confidence_score: 0.00-1.00. confidence_reason: OBOWIĄZKOWY.

SOURCE_ANCHOR — wymagany format strukturalny (separator: " | "):
  Cel: precyzyjna identyfikacja miejsca w dokumencie dla traceability.
  ZAWSZE zaczynaj od nazwy pliku podanej w [PLIK:]. Nigdy nie używaj ogólników.

  Dla PDF / specyfikacji:
    Format:  {filename} | str:{N} | {nazwa_sekcji_lub_tabeli}
    Przykład: projekt_łazienki.pdf | str:2 | Zestawienie okładzin ceramicznych

  Dla wizualizacji 3D / renderu:
    Format:  {filename} | render | {widoczne_elementy} | {widok_lub_kąt}
    Przykład: wizualizacja_8.jpg | render | umywalka+armatura | widok_frontowy

  Dla zdjęcia budowy:
    Format:  {filename} | photo | {widoczny_stan_lub_element} | {obszar_lub_faza}
    Przykład: budowa_3.jpg | photo | gołe_ściany_murowane | stan_surowy

  Nigdy: "wizualizacja 3D", "zdjęcie", "dokument", "Obiekt i Pomieszczenia".

evidence[] MUSI mieć ≥1 element. Jeśli nic pewnego → minimum 1 missing_data.`
}

function buildResponseFormat() {
  const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] }
  const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] }
  const nb = { anyOf: [{ type: 'boolean' }, { type: 'null' }] }
  return {
    type: 'json_schema',
    name: 'evidence_extraction_v1',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        evidence: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              evidence_type: { type: 'string', enum: ['dimension', 'fixture', 'material', 'tile_spec', 'installation', 'scope_hint', 'missing_data', 'hypothesis'] },
              room_label: ns, confidence_score: { type: 'number' }, confidence_reason: { type: 'string' }, source_anchor: ns,
              dim_subject: ns, dim_value: nn, dim_unit: ns, dim_note: ns,
              fix_name: ns, fix_category: ns, fix_confirmed: nb, fix_quantity: nn, fix_dims: ns, fix_note: ns,
              mat_name: ns, mat_category: ns, mat_format: ns, mat_area_netto: nn, mat_waste_multi: nn, mat_zone: ns, mat_note: ns,
              ts_product: ns, ts_format: ns, ts_area_netto: nn, ts_waste_multi: nn, ts_zone: ns, ts_source_page: ns,
              inst_type: ns, inst_description: ns, inst_layer: ns, inst_question_id: ns, inst_note: ns,
              sh_description: ns, sh_category: ns, sh_quantity: nn, sh_unit: ns, sh_rule: ns, sh_priority: ns,
              md_subject: ns, md_impact: ns, md_question: ns, md_severity: ns,
              hyp_description: ns, hyp_basis: ns, hyp_rule: ns, hyp_confirm_with: ns,
            },
            required: [
              'evidence_type', 'room_label', 'confidence_score', 'confidence_reason', 'source_anchor',
              'dim_subject', 'dim_value', 'dim_unit', 'dim_note',
              'fix_name', 'fix_category', 'fix_confirmed', 'fix_quantity', 'fix_dims', 'fix_note',
              'mat_name', 'mat_category', 'mat_format', 'mat_area_netto', 'mat_waste_multi', 'mat_zone', 'mat_note',
              'ts_product', 'ts_format', 'ts_area_netto', 'ts_waste_multi', 'ts_zone', 'ts_source_page',
              'inst_type', 'inst_description', 'inst_layer', 'inst_question_id', 'inst_note',
              'sh_description', 'sh_category', 'sh_quantity', 'sh_unit', 'sh_rule', 'sh_priority',
              'md_subject', 'md_impact', 'md_question', 'md_severity',
              'hyp_description', 'hyp_basis', 'hyp_rule', 'hyp_confirm_with',
            ],
            additionalProperties: false,
          },
        },
        questions: { type: 'array', items: {
          type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, priority: { type: 'string', enum: ['critical', 'important', 'optional'] }, rule: ns },
          required: ['id', 'text', 'priority', 'rule'], additionalProperties: false,
        }},
        risks: { type: 'array', items: {
          type: 'object', properties: { description: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, rule: ns },
          required: ['description', 'severity', 'rule'], additionalProperties: false,
        }},
        confidence_summary: { type: 'number' },
        missing_data: { type: 'boolean' },
      },
      required: ['evidence', 'questions', 'risks', 'confidence_summary', 'missing_data'],
      additionalProperties: false,
    },
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
