#!/usr/bin/env node
// =============================================================================
// scripts/seed-test-bundle.mjs
// =============================================================================
// DEV-ONLY script: creates a test bundle + assets for a real project,
// so extractors can be tested on actual data.
//
// Usage:
//   node scripts/seed-test-bundle.mjs                    # uses defaults below
//   node scripts/seed-test-bundle.mjs --project <id>     # specific project
//   node scripts/seed-test-bundle.mjs --dry-run          # show what would be created
//
// Pre-requisites:
//   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or .env file)
//   - Target project must exist in the database
//
// What it does:
//   1. Creates a bundle (document_type = projekt_wykonawczy)
//   2. Registers sample assets (PDF drawings, visualization, photo)
//   3. Runs assessBundleReadiness and logs the summary
//
// Does NOT: touch P0 tables, run actual AI inference, modify production data
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
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  console.error('   Set them in .env or export before running this script.')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const projectIdArg = args.includes('--project') ? args[args.indexOf('--project') + 1] : null
const dryRun = args.includes('--dry-run')
const withStubExtraction = args.includes('--with-stub')

// ── Test scenario definition ──────────────────────────────────────────────────
// Edit this section to match your real test data.

const SCENARIO = {
  // If --project not provided, the script will pick the first project it finds
  label: 'Test bundle – dev seed',
  document_type: 'projekt_wykonawczy',

  // Assets to register. storage_path should point to real Supabase Storage paths
  // if you want extractors to actually read them. For readiness testing, any
  // placeholder path works.
  assets: [
    {
      original_filename: 'rzut-funkcjonalny.pdf',
      storage_path:      'ai-inputs/test/rzut-funkcjonalny.pdf',
      mime_type:         'application/pdf',
      source_type:       'pdf',
      layer_type:        'functional_layout',
      room_hint:         null,
    },
    {
      original_filename: 'elektryka-oswietlenie.pdf',
      storage_path:      'ai-inputs/test/elektryka-oswietlenie.pdf',
      mime_type:         'application/pdf',
      source_type:       'pdf',
      layer_type:        'electrical_lighting',
      room_hint:         null,
    },
    {
      original_filename: 'okladziny-podlogowe.pdf',
      storage_path:      'ai-inputs/test/okladziny-podlogowe.pdf',
      mime_type:         'application/pdf',
      source_type:       'pdf',
      layer_type:        'floor_coverings',
      room_hint:         null,
    },
    {
      original_filename: 'widoki-scian.pdf',
      storage_path:      'ai-inputs/test/widoki-scian.pdf',
      mime_type:         'application/pdf',
      source_type:       'pdf',
      layer_type:        'wall_elevations',
      room_hint:         'łazienka',
    },
    {
      original_filename: 'meble-kuchnia.pdf',
      storage_path:      'ai-inputs/test/meble-kuchnia.pdf',
      mime_type:         'application/pdf',
      source_type:       'pdf',
      layer_type:        'furniture_drawing',
      room_hint:         'kuchnia',
    },
    {
      original_filename: 'wizualizacja-salon.jpg',
      storage_path:      'ai-inputs/test/wizualizacja-salon.jpg',
      mime_type:         'image/jpeg',
      source_type:       'render',
      layer_type:        'visualization_3d',
      room_hint:         'salon',
    },
    {
      original_filename: 'zdjecie-budowa.jpg',
      storage_path:      'ai-inputs/test/zdjecie-budowa.jpg',
      mime_type:         'image/jpeg',
      source_type:       'photo',
      layer_type:        null,
      room_hint:         null,
      source_role:       'site_photo',
    },
  ],
}

// ── DOCUMENT_LAYER_META (inline copy for scripts — no import.meta.env needed) ─
// Kept minimal: just enough to auto-derive source_role and source_priority.

const LAYER_META = {
  title_page:            { sourceRole: 'text_note',            sourcePriority: 50 },
  visualization_3d:      { sourceRole: 'design_visualization', sourcePriority: 20 },
  survey_existing:       { sourceRole: 'architectural_drawing',sourcePriority: 5  },
  functional_layout:     { sourceRole: 'architectural_drawing',sourcePriority: 8  },
  structural_guidelines: { sourceRole: 'architectural_drawing',sourcePriority: 6  },
  electrical_legend:     { sourceRole: 'technical_spec',       sourcePriority: 3  },
  electrical_lighting:   { sourceRole: 'installation_drawing', sourcePriority: 7  },
  electrical_sockets:    { sourceRole: 'installation_drawing', sourcePriority: 7  },
  plumbing_wod_kan:      { sourceRole: 'installation_drawing', sourcePriority: 7  },
  floor_coverings:       { sourceRole: 'technical_spec',       sourcePriority: 5  },
  wall_coverings:        { sourceRole: 'technical_spec',       sourcePriority: 8  },
  wall_elevations:       { sourceRole: 'installation_drawing', sourcePriority: 6  },
  tile_layout:           { sourceRole: 'technical_spec',       sourcePriority: 5  },
  ceiling_plan:          { sourceRole: 'architectural_drawing',sourcePriority: 8  },
  furniture_drawing:     { sourceRole: 'technical_spec',       sourcePriority: 4  },
  staircase_design:      { sourceRole: 'technical_spec',       sourcePriority: 7  },
  glazing_door_detail:   { sourceRole: 'technical_spec',       sourcePriority: 6  },
  construction_detail:   { sourceRole: 'technical_spec',       sourcePriority: 10 },
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  LoftDesk P1 — seed-test-bundle')
  console.log(`  mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════════')

  // 1. Resolve project
  const projectId = await resolveProjectId(projectIdArg)
  console.log(`\n📁 Project: ${projectId}`)

  // 2. Resolve company_id + created_by from project
  const { company_id, created_by } = await getProjectOwner(projectId)
  console.log(`   company: ${company_id}`)
  console.log(`   creator: ${created_by}`)

  // 3. Create bundle
  console.log(`\n📦 Creating bundle: "${SCENARIO.label}" (${SCENARIO.document_type})`)
  const bundle = await createBundle({
    company_id,
    project_id: projectId,
    created_by,
    label: SCENARIO.label,
    document_type: SCENARIO.document_type,
  })
  console.log(`   ✅ bundle_id: ${bundle.id}`)

  // 4. Register assets
  console.log(`\n📄 Registering ${SCENARIO.assets.length} assets...`)
  const registeredAssets = []
  for (const asset of SCENARIO.assets) {
    const layerMeta = asset.layer_type ? LAYER_META[asset.layer_type] : null
    const row = await registerAsset({
      bundle_id: bundle.id,
      company_id,
      project_id: projectId,
      storage_path: asset.storage_path,
      original_filename: asset.original_filename,
      mime_type: asset.mime_type,
      source_type: asset.source_type,
      source_role: asset.source_role ?? layerMeta?.sourceRole ?? 'unknown',
      layer_type: asset.layer_type ?? null,
      room_hint: asset.room_hint ?? null,
      source_priority: layerMeta?.sourcePriority ?? 50,
    })
    registeredAssets.push(row)
    console.log(`   ✅ ${asset.original_filename}  →  layer=${asset.layer_type ?? '–'}  role=${row.source_role}  priority=${row.source_priority}`)
  }

  // 5. Optionally insert stub extraction output for the first technical asset
  if (withStubExtraction) {
    const techAsset = registeredAssets.find(a => a.source_type === 'pdf')
    if (techAsset) {
      console.log(`\n🔬 Writing stub extraction for: ${techAsset.original_filename}`)
      await writeStubExtraction(techAsset, bundle.id, company_id, projectId)
      console.log('   ✅ extraction_status → extracted, 2 evidence items written')
    }
  }

  // 6. Assess readiness
  console.log('\n📊 Bundle Readiness Assessment:')
  const readiness = await assessReadiness(bundle.id)
  console.log(JSON.stringify(readiness, null, 2))

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  Done. Bundle: ${bundle.id}`)
  console.log('  Next steps:')
  console.log('    1. Open project in UI → AI tab → see BundleReadinessCard')
  console.log('    2. Upload real files to Supabase Storage at the storage_path above')
  console.log('    3. Run extractor on an asset:')
  console.log(`       import { persistExtractionOutput } from '@/services/ai/composite/bundle.service'`)
  console.log('═══════════════════════════════════════════════════════════')
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function resolveProjectId(explicit) {
  if (explicit) return explicit
  // Pick the most recently created project
  const { data, error } = await client
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) {
    console.error('❌ Cannot find any project. Pass --project <id>')
    process.exit(1)
  }
  console.log(`   auto-selected project: "${data.name}" (${data.id})`)
  return data.id
}

async function getProjectOwner(projectId) {
  const { data, error } = await client
    .from('projects')
    .select('company_id, created_by')
    .eq('id', projectId)
    .single()
  if (error || !data) {
    console.error(`❌ Project ${projectId} not found: ${error?.message ?? 'no data'}`)
    process.exit(1)
  }
  return { company_id: data.company_id, created_by: data.created_by }
}

async function createBundle(input) {
  if (dryRun) return { id: '<dry-run-bundle-id>' }
  const { data, error } = await client
    .from('ai_analysis_bundles')
    .insert({
      company_id:    input.company_id,
      project_id:    input.project_id,
      created_by:    input.created_by,
      label:         input.label ?? null,
      document_type: input.document_type ?? null,
      status:        'pending',
    })
    .select()
    .single()
  if (error) { console.error('❌ createBundle:', error.message); process.exit(1) }
  return data
}

async function registerAsset(input) {
  if (dryRun) return { ...input, id: '<dry-run-asset-id>' }
  const { data, error } = await client
    .from('ai_bundle_assets')
    .insert({
      bundle_id:         input.bundle_id,
      company_id:        input.company_id,
      project_id:        input.project_id,
      storage_path:      input.storage_path,
      original_filename: input.original_filename,
      mime_type:         input.mime_type,
      source_type:       input.source_type,
      source_role:       input.source_role,
      layer_type:        input.layer_type,
      room_hint:         input.room_hint,
      source_priority:   input.source_priority,
      extraction_status: 'pending',
    })
    .select()
    .single()
  if (error) { console.error('❌ registerAsset:', error.message); process.exit(1) }

  // Increment asset_count on bundle
  await client.rpc('increment_bundle_counter', {
    p_bundle_id: input.bundle_id,
    p_column:    'asset_count',
    p_delta:     1,
  })

  return data
}

// ── Stub extraction (--with-stub) ─────────────────────────────────────────────

async function writeStubExtraction(asset, bundleId, companyId, projectId) {
  if (dryRun) return

  const evidence = [
    {
      bundle_id:         bundleId,
      asset_id:          asset.id,
      company_id:        companyId,
      project_id:        projectId,
      extractor_type:    'document_ai',
      evidence_type:     'dimension',
      content:           { subject: 'floor_area', value: 24.5, unit: 'm2', room_label: 'łazienka', note: 'stub – dev seed' },
      room_label:        'łazienka',
      confidence_score:  0.75,
      confidence_reason: 'Stub extraction from seed script — not real AI output',
      source_anchor:     'seed-test-bundle.mjs',
      conflict_ids:      [],
    },
    {
      bundle_id:         bundleId,
      asset_id:          asset.id,
      company_id:        companyId,
      project_id:        projectId,
      extractor_type:    'document_ai',
      evidence_type:     'missing_data',
      content:           { subject: 'rzut_wod-kan', impact: 'Stub – brak rzutu hydrauliki', severity: 'important' },
      room_label:        null,
      confidence_score:  1.0,
      confidence_reason: 'Missing data signal — always confidence 1.0',
      source_anchor:     null,
      conflict_ids:      [],
    },
  ]

  const { error: insertErr } = await client
    .from('ai_extraction_results')
    .insert(evidence)
  if (insertErr) { console.error('❌ stub extraction insert:', insertErr.message); return }

  // Mark asset as extracted
  await client
    .from('ai_bundle_assets')
    .update({ extraction_status: 'extracted' })
    .eq('id', asset.id)

  // Increment extracted_count
  await client.rpc('increment_bundle_counter', {
    p_bundle_id: bundleId,
    p_column:    'extracted_count',
    p_delta:     1,
  })
}

// ── Readiness assessment (mirrors bundle-readiness.ts logic) ──────────────────

async function assessReadiness(bundleId) {
  if (dryRun) return { note: 'dry-run — skipping DB readiness check' }

  const { data: bundle } = await client
    .from('ai_analysis_bundles')
    .select('*')
    .eq('id', bundleId)
    .single()

  const { data: assets } = await client
    .from('ai_bundle_assets')
    .select('*')
    .eq('bundle_id', bundleId)
    .order('source_priority', { ascending: true })

  if (!bundle || !assets) return { error: 'bundle or assets not found' }

  const layerCounts = {}
  const roleCounts = {}
  for (const a of assets) {
    if (a.layer_type) layerCounts[a.layer_type] = (layerCounts[a.layer_type] ?? 0) + 1
    if (a.source_role) roleCounts[a.source_role] = (roleCounts[a.source_role] ?? 0) + 1
  }

  const expectedMustUse = [
    'functional_layout', 'electrical_lighting', 'electrical_sockets',
    'plumbing_wod_kan', 'floor_coverings', 'wall_elevations', 'furniture_drawing',
  ]
  const mustUsePresent = expectedMustUse.filter(l => (layerCounts[l] ?? 0) > 0)
  const mustUseMissing = expectedMustUse.filter(l => (layerCounts[l] ?? 0) === 0)

  const docType = bundle.document_type ?? 'unknown'
  const eligible = docType === 'projekt_wykonawczy' && assets.length >= 2
  const hasPending = assets.some(a => a.extraction_status === 'pending')

  const warnings = []
  if (mustUseMissing.length > 0) warnings.push(`Brakujące MUST USE: ${mustUseMissing.join(', ')}`)
  if (docType === 'visualization_pack') warnings.push('Tylko wizualizacje — composite niedostępne')
  if (docType === 'unknown') warnings.push('document_type nie ustawiony')

  return {
    bundle_id:              bundleId,
    document_type:          docType,
    eligible_for_composite: eligible,
    asset_count:            assets.length,
    layer_counts:           layerCounts,
    source_role_counts:     roleCounts,
    must_use_present:       mustUsePresent,
    must_use_missing:       mustUseMissing,
    warnings,
    ready_for_extraction:   eligible && hasPending,
    ready_for_fusion:       false,
    extraction_summary: {
      pending:   assets.filter(a => a.extraction_status === 'pending').length,
      extracted: assets.filter(a => a.extraction_status === 'extracted').length,
      failed:    assets.filter(a => a.extraction_status === 'failed').length,
      skipped:   assets.filter(a => a.extraction_status === 'skipped').length,
    },
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
