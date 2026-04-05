// =============================================================================
// Netlify Function: composite-extract-asset  (P1 — project_vision extractor)
// =============================================================================
// Extracts EVIDENCE from a single bundle asset using the project_vision extractor.
// Returns evidence items (facts, hypotheses, missing_data), NOT a final scope.
//
// This is the first real extractor in the Composite Project Analysis stack.
// It sits between raw assets and the (future) fusion engine.
//
// Request (POST /.netlify/functions/composite-extract-asset):
//   Authorization: Bearer <supabase-jwt>
//   {
//     asset_id:      string   — ai_bundle_assets.id (required)
//     file_base64:   string   — base64 file content (required)
//     file_mime:     string   — MIME type (required)
//     source_role?:  string   — overrides db source_role for prompt variant
//     room_hint?:    string   — optional room context (e.g. "łazienka parter")
//   }
//
// On success:
//   { ok: true, asset_id, bundle_id, evidence_count, confidence_summary, missing_data,
//     questions, risks, extraction_ms }
//
// On error:
//   { ok: false, error: string, message: string }
//
// Does NOT touch P0 tables or P0 flow.
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { persistEvidenceOutput } from './shared/evidence-persist'
import type { FlatExtractionOutput, FlatEvidenceItem } from './shared/evidence-persist'
import { isRateLimitedDb } from './shared/rate-limit'
import { captureAiError, flushSentry } from './shared/sentry'
import { EVIDENCE_SYSTEM_PROMPT, buildEvidenceUserMessage } from '../../src/services/ai/prompts/evidence.prompt'

// ── Infra ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

function ok(data: Record<string, unknown>) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, ...data }) }
}

function err(statusCode: number, error: string, message: string) {
  console.error(`[composite-extract-asset] ${error}: ${message}`)
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, error, message }) }
}

// ── Auth + company resolution ─────────────────────────────────────────────────

async function resolveAuth(event: HandlerEvent): Promise<{
  userId: string
  companyId: string
} | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Dev mode — no auth check
    return { userId: 'dev', companyId: 'dev' }
  }
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(authHeader.slice(7))
    if (!user) return null

    // Resolve company_id from JWT (same pattern as P0 functions)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return { userId: user.id, companyId: 'unknown' }
    const sbAdmin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data: memberRow } = await sbAdmin
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    if (!memberRow?.company_id) return null
    return { userId: user.id, companyId: memberRow.company_id as string }
  } catch {
    return null
  }
}

// ── Rate limit ────────────────────────────────────────────────────────────────

const RATE_MAX = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

function makeRateLimitClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// ── JSON Schema for Structured Evidence Output ────────────────────────────────
// Flat schema: all evidence fields at top level, prefixed by type.
// Polymorphic content is handled by evidence-persist.ts (flatToContent).

const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const
const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] } as const
const nb = { anyOf: [{ type: 'boolean' }, { type: 'null' }] } as const

const EVIDENCE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    evidence_type: {
      type: 'string',
      enum: ['dimension', 'fixture', 'material', 'tile_spec', 'installation', 'scope_hint', 'missing_data', 'hypothesis'],
    },
    room_label:        ns,
    confidence_score:  { type: 'number' },
    confidence_reason: { type: 'string' },
    source_anchor:     ns,
    // dimension
    dim_subject:       ns,
    dim_value:         nn,
    dim_unit:          ns,
    dim_note:          ns,
    // fixture
    fix_name:          ns,
    fix_category:      ns,
    fix_confirmed:     nb,
    fix_quantity:      nn,
    fix_dims:          ns,
    fix_note:          ns,
    // material
    mat_name:          ns,
    mat_category:      ns,
    mat_format:        ns,
    mat_area_netto:    nn,
    mat_waste_multi:   nn,
    mat_zone:          ns,
    mat_note:          ns,
    // tile_spec (R-26 gold truth)
    ts_product:        ns,
    ts_format:         ns,
    ts_area_netto:     nn,
    ts_waste_multi:    nn,
    ts_zone:           ns,
    ts_source_page:    ns,
    // installation
    inst_type:         ns,
    inst_description:  ns,
    inst_layer:        ns,
    inst_question_id:  ns,
    inst_note:         ns,
    // scope_hint
    sh_description:    ns,
    sh_category:       ns,
    sh_quantity:       nn,
    sh_unit:           ns,
    sh_rule:           ns,
    sh_priority:       ns,
    // missing_data
    md_subject:        ns,
    md_impact:         ns,
    md_question:       ns,
    md_severity:       ns,
    // hypothesis
    hyp_description:   ns,
    hyp_basis:         ns,
    hyp_rule:          ns,
    hyp_confirm_with:  ns,
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
} as const

const EVIDENCE_SCHEMA = {
  type:   'json_schema',
  name:   'evidence_extraction_v1',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      evidence: {
        type:  'array',
        items: EVIDENCE_ITEM_SCHEMA,
      },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id:       { type: 'string' },
            text:     { type: 'string' },
            priority: { type: 'string', enum: ['critical', 'important', 'optional'] },
            rule:     ns,
          },
          required: ['id', 'text', 'priority', 'rule'],
          additionalProperties: false,
        },
      },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            severity:    { type: 'string', enum: ['high', 'medium', 'low'] },
            rule:        ns,
          },
          required: ['description', 'severity', 'rule'],
          additionalProperties: false,
        },
      },
      confidence_summary: { type: 'number' },
      missing_data:       { type: 'boolean' },
    },
    required: ['evidence', 'questions', 'risks', 'confidence_summary', 'missing_data'],
    additionalProperties: false,
  },
}

// ── buildStructuredAnchor ────────────────────────────────────────────────────
// Post-processes the AI-generated source_anchor to guarantee traceability.
// If the AI already included the filename, the anchor is kept (with PDF page
// enforcement for multi-page documents). Otherwise a structured fallback is built.
//
// Format guarantee after post-process:
//   Images:  {filename} | {source_role_or_type} | {ai_anchor}
//   PDFs:    {filename} | str:{N_or_?} | {drawing_nr} | {drawing_title} | {section}

function buildStructuredAnchor(
  filename:   string,
  sourceRole: string,
  layerType:  string | null,
  aiAnchor:   string | null | undefined,
): string {
  const trimmed = (aiAnchor ?? '').trim()
  const isPdf = filename.toLowerCase().endsWith('.pdf')

  if (trimmed && trimmed.includes(filename)) {
    // AI produced an anchor referencing the correct filename.
    // For PDFs: enforce that str: page reference is present.
    if (isPdf && !/\bstr:\S+/.test(trimmed)) {
      return trimmed + ' | str:?'
    }
    return trimmed
  }

  // Build structured fallback from known asset metadata
  const parts: string[] = [filename]
  if (isPdf) {
    // PDF fallback: always include page placeholder
    parts.push('str:?')
    if (layerType && layerType !== 'unknown') parts.push(layerType)
  } else {
    parts.push(sourceRole)
    if (layerType && layerType !== 'unknown') parts.push(layerType)
  }
  parts.push(trimmed.length > 0 ? trimmed : 'anchor:unresolved')
  return parts.join(' | ')
}

// ── OpenAI response type ──────────────────────────────────────────────────────

interface ResponsesAPIResult {
  output?: Array<{
    content?: Array<{ type: string; text: string }>
  }>
}

// ── Main handler ─────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return err(405, 'method_not_allowed', 'POST only')
  }

  const t0 = Date.now()
  const requestId = crypto.randomUUID()

  // Feature flag: AI Engine must be explicitly enabled
  if (process.env.VITE_AI_ENGINE_ENABLED !== 'true') {
    return err(503, 'ai_disabled', 'AI Engine is not enabled in this environment')
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const auth = await resolveAuth(event)
    if (!auth) return err(401, 'unauthorized', 'Valid session required')
    // AI requires real Supabase auth — 'dev' fallback is not permitted
    if (auth.userId === 'dev') return err(503, 'auth_not_configured', 'AI Engine requires Supabase authentication')
    const rlClient = makeRateLimitClient()
    if (rlClient) {
      const rl = await isRateLimitedDb(rlClient, auth.userId, 'composite-extract-asset', RATE_MAX, RATE_WINDOW_MS)
      if (rl.limited) return err(429, 'too_many_requests', 'Rate limit exceeded')
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return err(503, 'ai_not_configured', 'OPENAI_API_KEY not set')

    const model =
      process.env.OPENAI_MODEL_VISION?.trim() ||
      process.env.OPENAI_MODEL?.trim()        ||
      'gpt-4o'

    // ── Parse request ───────────────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
    } catch {
      return err(400, 'invalid_json', 'Request body is not valid JSON')
    }

    const assetId    = typeof body.asset_id    === 'string' ? body.asset_id.trim()    : ''
    const fileBase64 = typeof body.file_base64 === 'string' ? body.file_base64.trim() : ''
    const fileMime   = typeof body.file_mime   === 'string' ? body.file_mime.trim()   : ''
    const roomHint   = typeof body.room_hint   === 'string' ? body.room_hint.slice(0, 200) : null
    const sourceRoleOverride = typeof body.source_role === 'string' ? body.source_role : null

    if (!assetId)    return err(400, 'missing_asset_id',  'asset_id is required')
    if (!fileBase64) return err(400, 'missing_file',      'file_base64 is required')
    if (!fileMime)   return err(400, 'missing_mime',      'file_mime is required')

    // ── Resolve asset + company security check ──────────────────────────────
    const serviceUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) return err(503, 'db_not_configured', 'Supabase service role not set')

    const sbAdmin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } })

    // Fetch asset row (RLS bypassed by service role — security via company_id check below)
    const { data: assetRow, error: assetErr } = await sbAdmin
      .from('ai_bundle_assets')
      .select('id, bundle_id, company_id, project_id, source_role, room_hint, extraction_status, original_filename, layer_type')
      .eq('id', assetId)
      .single()

    if (assetErr || !assetRow) return err(404, 'asset_not_found', `Asset ${assetId} not found`)

    // Security: company_id from JWT must match asset's company_id
    if (auth.companyId !== 'dev' && assetRow.company_id !== auth.companyId) {
      return err(403, 'forbidden', 'Asset does not belong to your company')
    }

    // Idempotency: skip already-extracted assets
    if (assetRow.extraction_status === 'extracted') {
      return ok({
        asset_id:    assetId,
        bundle_id:   assetRow.bundle_id,
        skipped:     true,
        reason:      'Already extracted',
      })
    }

    const bundleId  = assetRow.bundle_id  as string
    const companyId = assetRow.company_id as string
    const projectId = assetRow.project_id as string
    const sourceRole = (sourceRoleOverride ?? assetRow.source_role ?? 'unknown') as string

    // ── Plan check: AI Engine requires Pro or Business tier ─────────────────
    const { data: companyRow, error: planErr } = await sbAdmin
      .from('companies')
      .select('plan')
      .eq('id', companyId)
      .single()

    if (planErr || !companyRow) {
      console.error('[composite-extract-asset] Plan check failed:', planErr?.message)
      return err(500, 'plan_check_failed', 'Could not verify company plan')
    }
    if (!['pro', 'business', 'admin'].includes((companyRow as { plan: string }).plan)) {
      return err(403, 'plan_insufficient', 'AI Engine requires a Pro or Business plan')
    }

    // ── Daily company limit ───────────────────────────────────────────────
    const dailyLimit = parseInt(process.env.AI_DAILY_LIMIT ?? '50', 10)
    const { count: todayCount, error: countErr } = await sbAdmin
      .from('ai_analysis_runs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

    if (!countErr && typeof todayCount === 'number' && todayCount >= dailyLimit) {
      console.warn('[composite-extract-asset] Daily limit exceeded', { companyId, todayCount, dailyLimit })
      return err(429, 'daily_limit_exceeded', `Dzienny limit analiz AI (${dailyLimit}) został wyczerpany. Spróbuj ponownie jutro.`)
    }

    // Mark as processing
    await sbAdmin.from('ai_bundle_assets').update({ extraction_status: 'processing' }).eq('id', assetId)

    // ── Payload size guard ──────────────────────────────────────────────────
    if (fileBase64.length > 20 * 1024 * 1024) {
      await sbAdmin.from('ai_bundle_assets').update({
        extraction_status: 'failed',
        processing_error:  'Plik za duży — max ~15 MB',
      }).eq('id', assetId)
      return err(413, 'file_too_large', 'Plik za duży (max ~15 MB). Skompresuj lub zmniejsz rozdzielczość.')
    }

    // ── Build OpenAI content ────────────────────────────────────────────────
    const isPdf   = fileMime === 'application/pdf'
    const isImage = fileMime.startsWith('image/')
    if (!isPdf && !isImage) {
      await sbAdmin.from('ai_bundle_assets').update({
        extraction_status: 'failed',
        processing_error:  `Unsupported MIME: ${fileMime}`,
      }).eq('id', assetId)
      return err(400, 'unsupported_type', `Unsupported MIME type: ${fileMime}`)
    }

    type ContentItem =
      | { type: 'input_text';  text: string }
      | { type: 'input_image'; image_url: string }
      | { type: 'input_file';  filename: string; file_data: string }

    const content: ContentItem[] = []

    const assetFilename = (assetRow.original_filename as string | null) ?? `asset_${assetId.slice(0, 8)}`
    const assetLayerType = assetRow.layer_type as string | null

    const userMessage = buildEvidenceUserMessage(
      sourceRole as Parameters<typeof buildEvidenceUserMessage>[0],
      (roomHint ?? (assetRow.room_hint as string | null)),
      { filename: assetFilename, layerType: assetLayerType },
    )
    content.push({ type: 'input_text', text: userMessage })

    if (isPdf) {
      content.push({ type: 'input_file', filename: assetFilename, file_data: `data:application/pdf;base64,${fileBase64}` })
    } else {
      content.push({ type: 'input_image', image_url: `data:${fileMime};base64,${fileBase64}` })
    }

    console.info('EVIDENCE_EXTRACT_START', JSON.stringify({
      endpoint:   'composite-extract-asset',
      requestId,
      companyId:  companyId.slice(0, 8),
      projectId:  projectId?.slice(0, 8) ?? null,
      assetId:    assetId.slice(0, 8),
      bundleId:   bundleId.slice(0, 8),
      sourceRole,
      isPdf,
      elapsed_ms: Date.now() - t0,
    }))

    // ── Call OpenAI (with retry) ─────────────────────────────────────────────
    let aiRaw: string
    try {
      const { callOpenAIWithRetry } = await import('./shared/openai-retry')
      const resp = await callOpenAIWithRetry({
        apiKey, model, instructions: EVIDENCE_SYSTEM_PROMPT,
        input: [{ role: 'user', content }],
        text: { format: EVIDENCE_SCHEMA },
        max_output_tokens: 10_000,
      }, 'composite-extract-asset')

      if (resp.retried) console.info('OPENAI_RETRIED', JSON.stringify({ requestId, finalStatus: resp.status, elapsed_ms: Date.now() - t0 }))

      if (!resp.ok) {
        console.error('OPENAI_ERROR', JSON.stringify({
          endpoint:   'composite-extract-asset',
          requestId,
          companyId:  companyId.slice(0, 8),
          assetId:    assetId.slice(0, 8),
          status:     resp.status,
          category:   resp.status === 429 ? 'quota' : 'provider_error',
          body:       resp.body.slice(0, 300),
          elapsed_ms: Date.now() - t0,
        }))
        await sbAdmin.from('ai_bundle_assets').update({
          extraction_status: 'failed',
          processing_error:  `OpenAI ${resp.status}: ${resp.body.slice(0, 200)}`,
        }).eq('id', assetId)
        if (resp.status === 429) return err(429, 'openai_quota', 'Quota OpenAI wyczerpana')
        return err(502, 'provider_error', `OpenAI ${resp.status}`)
      }

      const data = JSON.parse(resp.body) as ResponsesAPIResult
      aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      await sbAdmin.from('ai_bundle_assets').update({
        extraction_status: 'failed',
        processing_error:  `AI call failed: ${msg.slice(0, 200)}`,
      }).eq('id', assetId)
      return err(502, 'ai_call_failed', `Analiza AI niedostępna: ${msg.slice(0, 200)}`)
    }

    // ── Parse + validate AI response ────────────────────────────────────────
    let extracted: FlatExtractionOutput
    try {
      const parsed = JSON.parse(aiRaw) as Partial<FlatExtractionOutput>
      const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : []

      // R-08, R-19: never return empty evidence
      if (evidence.length === 0) {
        evidence.push({
          evidence_type:     'missing_data',
          room_label:        null,
          confidence_score:  0.0,
          confidence_reason: 'AI returned empty evidence — document may be unreadable or unsupported',
          source_anchor:     null,
          // all other fields null
          dim_subject: null, dim_value: null, dim_unit: null, dim_note: null,
          fix_name: null, fix_category: null, fix_confirmed: null, fix_quantity: null, fix_dims: null, fix_note: null,
          mat_name: null, mat_category: null, mat_format: null, mat_area_netto: null, mat_waste_multi: null, mat_zone: null, mat_note: null,
          ts_product: null, ts_format: null, ts_area_netto: null, ts_waste_multi: null, ts_zone: null, ts_source_page: null,
          inst_type: null, inst_description: null, inst_layer: null, inst_question_id: null, inst_note: null,
          sh_description: null, sh_category: null, sh_quantity: null, sh_unit: null, sh_rule: null, sh_priority: null,
          md_subject: 'asset_content', md_impact: 'Cannot extract evidence from this asset', md_question: null, md_severity: 'critical',
          hyp_description: null, hyp_basis: null, hyp_rule: null, hyp_confirm_with: null,
        } as FlatEvidenceItem)
      }

      extracted = {
        evidence,
        questions:          Array.isArray(parsed.questions) ? parsed.questions : [],
        risks:              Array.isArray(parsed.risks)     ? parsed.risks     : [],
        confidence_summary: typeof parsed.confidence_summary === 'number' ? parsed.confidence_summary : 0,
        missing_data:       typeof parsed.missing_data === 'boolean'      ? parsed.missing_data      : true,
      }

      // Post-process: ensure source_anchor contains filename + known metadata
      // Guards against generic anchors like "wizualizacja 3D", "zdjęcie", null.
      const _filename = assetFilename
      const _role = sourceRole
      const _layer = assetLayerType
      for (const item of extracted.evidence) {
        item.source_anchor = buildStructuredAnchor(_filename, _role, _layer, item.source_anchor)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      await sbAdmin.from('ai_bundle_assets').update({
        extraction_status: 'failed',
        processing_error:  `Parse failed: ${msg}`,
      }).eq('id', assetId)
      return err(502, 'parse_failed', `Failed to parse AI response: ${msg.slice(0, 200)}`)
    }

    // ── Persist to DB ───────────────────────────────────────────────────────
    const persistResult = await persistEvidenceOutput({
      sb:             sbAdmin,
      asset_id:       assetId,
      bundle_id:      bundleId,
      company_id:     companyId,
      project_id:     projectId,
      extractor_type: 'project_vision',
      output:         extracted,
      extraction_ms:  Date.now() - t0,
    })

    if (!persistResult.ok) {
      return err(500, 'persist_failed', persistResult.error ?? 'DB persist failed')
    }

    const extraction_ms = Date.now() - t0
    console.info('EVIDENCE_EXTRACT_DONE', JSON.stringify({
      endpoint:           'composite-extract-asset',
      requestId,
      companyId:          companyId.slice(0, 8),
      projectId:          projectId?.slice(0, 8) ?? null,
      assetId:            assetId.slice(0, 8),
      bundleId:           bundleId.slice(0, 8),
      evidence_count:     persistResult.evidence_count,
      confidence_summary: extracted.confidence_summary,
      extraction_ms,
    }))

    return ok({
      asset_id:           assetId,
      bundle_id:          bundleId,
      evidence_count:     persistResult.evidence_count,
      confidence_summary: extracted.confidence_summary,
      missing_data:       extracted.missing_data,
      questions:          extracted.questions,
      risks:              extracted.risks,
      extraction_ms,
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('EVIDENCE_EXTRACT_FATAL', JSON.stringify({
      endpoint:   'composite-extract-asset',
      requestId,
      error:      msg.slice(0, 500),
      category:   'internal',
      elapsed_ms: Date.now() - t0,
    }))
    captureAiError(e, {
      endpoint:   'composite-extract-asset',
      requestId,
      category:   'internal',
      userId:     typeof userId !== 'undefined' ? userId : undefined,
      companyId:  typeof companyId !== 'undefined' ? companyId : undefined,
      projectId:  typeof projectId !== 'undefined' ? projectId ?? undefined : undefined,
      elapsed_ms: Date.now() - t0,
    })
    await flushSentry()
    return err(500, 'internal_error', `Unexpected error: ${msg.slice(0, 200)}`)
  }
}
