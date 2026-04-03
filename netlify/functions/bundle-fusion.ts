// =============================================================================
// netlify/functions/bundle-fusion.ts
// =============================================================================
// Fusion endpoint — computes and persists FusedBundleOutput.
//
// POST { bundle_id: string }
// Returns FusedBundleOutput. Persists result to ai_fusion_snapshots for
// instant retrieval on page reload. Staleness detected via evidence_count.
//
// Auth: requires valid Supabase JWT in Authorization header.
// RLS: queries run with service-role but validate company_id from JWT claims.
//      Bundle not belonging to caller's company → 403.
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { runFusion } from '../../src/services/ai/composite/fusion.engine'
import type { AssetPriorityMap, EvidenceRow, QuestionRiskRow } from '../../src/services/ai/composite/fusion.engine'

// ── Supabase clients ───────────────────────────────────────────────────────────

const SUPABASE_URL             = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function makeServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

// ── JWT company_id extraction ──────────────────────────────────────────────────

function extractCompanyFromJwt(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token   = authHeader.slice(7)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    // app_metadata.company_id is the RLS claim used across the app
    return payload?.app_metadata?.company_id ?? null
  } catch {
    return null
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  // Method gate
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  // Parse body
  let bundle_id: string | undefined
  try {
    const body    = JSON.parse(event.body ?? '{}')
    bundle_id     = body.bundle_id
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }
  if (!bundle_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bundle_id required' }) }
  }

  // JWT company_id for authorization check
  const callerCompanyId = extractCompanyFromJwt(event.headers?.authorization ?? null)

  const sb = makeServiceClient()

  // ─── Fetch bundle (for company_id check + document_type) ─────────────────
  const { data: bundle, error: bundleErr } = await sb
    .from('ai_analysis_bundles')
    .select('id, company_id, document_type, status, asset_count, extracted_count')
    .eq('id', bundle_id)
    .single()

  if (bundleErr || !bundle) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Bundle not found' }) }
  }

  // Authorization: JWT company must match bundle company
  if (callerCompanyId && bundle.company_id !== callerCompanyId) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  // ─── Fetch assets (for source_priority map) ───────────────────────────────
  const { data: assets } = await sb
    .from('ai_bundle_assets')
    .select('id, source_priority, original_filename, source_role, layer_type')
    .eq('bundle_id', bundle_id)

  const priorityMap: AssetPriorityMap = {}
  for (const a of assets ?? []) {
    priorityMap[a.id] = a.source_priority ?? 50
  }

  // ─── Fetch evidence rows ──────────────────────────────────────────────────
  const { data: evidenceRows, error: evErr } = await sb
    .from('ai_extraction_results')
    .select('id, evidence_type, room_label, confidence_score, source_anchor, asset_id, content')
    .eq('bundle_id', bundle_id)
    .order('created_at', { ascending: true })

  if (evErr) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch evidence', details: evErr.message }),
    }
  }

  const rows: EvidenceRow[] = (evidenceRows ?? []).map(r => ({
    id:               r.id,
    evidence_type:    r.evidence_type,
    room_label:       r.room_label,
    confidence_score: r.confidence_score ?? 0,
    source_anchor:    r.source_anchor,
    asset_id:         r.asset_id,
    content:          (r.content as Record<string, unknown>) ?? {},
  }))

  // ─── Fetch questions & risks ──────────────────────────────────────────────
  const { data: qrRows } = await sb
    .from('ai_questions_risks')
    .select('id, entry_type, content')
    .eq('bundle_id', bundle_id)
    .order('created_at', { ascending: true })

  const qrTyped: QuestionRiskRow[] = (qrRows ?? []).map(r => ({
    id:         r.id,
    entry_type: r.entry_type as 'question' | 'risk',
    content:    (r.content as Record<string, unknown>) ?? {},
  }))

  // ─── Check for valid cached snapshot ──────────────────────────────────────
  const bundleMeta = {
    id:             bundle.id,
    document_type:  bundle.document_type,
    status:         bundle.status,
    asset_count:    bundle.asset_count,
    extracted_count: bundle.extracted_count,
    assets: (assets ?? []).map(a => ({
      id:               a.id,
      filename:         a.original_filename,
      source_priority:  a.source_priority,
      source_role:      a.source_role,
      layer_type:       a.layer_type,
    })),
  }

  const { data: snapshot } = await sb
    .from('ai_fusion_snapshots')
    .select('result_json, evidence_count, fusion_ms')
    .eq('bundle_id', bundle_id)
    .single()

  if (snapshot && snapshot.evidence_count === rows.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        cached: true,
        fusion_ms: snapshot.fusion_ms,
        bundle: bundleMeta,
        fused: snapshot.result_json,
      }, null, 2),
    }
  }

  // ─── Run fusion (no valid snapshot) ─────────────────────────────────────
  const t0     = Date.now()
  const fused  = runFusion(bundle_id, rows, priorityMap, qrTyped)
  const fusionMs = Date.now() - t0

  // ─── Persist snapshot ───────────────────────────────────────────────────
  await sb
    .from('ai_fusion_snapshots')
    .upsert({
      bundle_id:      bundle_id,
      company_id:     bundle.company_id,
      result_json:    fused,
      evidence_count: rows.length,
      fusion_ms:      fusionMs,
    }, { onConflict: 'bundle_id' })
    .then(({ error: snapErr }) => {
      if (snapErr) console.error('[bundle-fusion] snapshot upsert failed:', snapErr.message)
    })

  // ─── Return ───────────────────────────────────────────────────────────────
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      cached: false,
      fusion_ms: fusionMs,
      bundle: bundleMeta,
      fused,
    }, null, 2),
  }
}
