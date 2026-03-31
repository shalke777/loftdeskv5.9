// =============================================================================
// netlify/functions/shared/ai-persist.ts
// =============================================================================
// Persists an AI analysis bundle to the database after a successful run.
// Called from analyze-room-photo.ts using the Supabase service role client.
//
// contract:
//   - company_id is always derived from the JWT (resolved by the caller),
//     never from request payload.
//   - Uses service role client — bypasses RLS to write run status updates.
//   - Returns run_id on success so the caller can include it in the API response.
//   - Failures ARE fatal: caller must not return a success response if persist fails.
//
// No imports from src/ — all types are defined locally to match the shape
// of what analyze-room-photo.ts produces.

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Local types (mirror src/services/ai/engines/room.types.ts) ───────────────

interface ScopeItem {
  library_id:   string | null
  description:  string
  category:     string
  unit:         string | null
  quantity:     number | null
  priority:     'required' | 'likely' | 'optional'
  confidence:   number
  notes:        string | null
  dependencies: string[]
  // fields injected by dependency engine (optional)
  source?:      string
  provenance?:  string
}

interface ClarificationQuestion {
  id:          string
  text:        string
  severity?:   string
  category?:   string
  answer_type?: string
  options?:    Array<{ value: string; label: string }>
}

interface RoomAnalysisResult {
  space_type:               string | null
  stage_of_work:            string
  observed_elements:        unknown[]
  detected_installations:   unknown[]
  detected_materials:       unknown[]
  required_work_scope:      ScopeItem[]
  likely_work_scope:        ScopeItem[]
  optional_work_scope:      ScopeItem[]
  missing_information:      string[]
  assumptions:              string[]
  quantity_hints:           unknown[]
  suggested_estimate_items: unknown[]
  coverage:                 unknown
  warnings:                 string[]
  confidence:               number
  notes:                    string | null
  clarification_questions?: ClarificationQuestion[]
}

export interface PersistBundleInput {
  sb:             SupabaseClient
  userId:         string
  companyId:      string
  projectId:      string
  roomType:       string         // 'bathroom' | 'wc'
  textDescription?: string
  clarification?: Record<string, unknown>
  dimensionsJson?: Record<string, unknown>
  notes?:         string
  modelName?:     string
  /** Sprint 3: storage paths for uploaded photos — persisted to ai_input_assets after run creation */
  imageRefs?:     Array<{ storage_path: string; original_filename: string; mime_type: string; file_size: number }>
  result:         RoomAnalysisResult
}

export interface PersistBundleResult {
  run_id:  string
  ok:      boolean
  error?:  string
}

// ── Source kind mapping ───────────────────────────────────────────────────────

function toSourceKind(item: ScopeItem): 'direct_detected' | 'dependency_inferred' | 'confirmation_needed' {
  const src = item.source ?? item.provenance ?? ''
  if (src === 'dependency_inferred') return 'dependency_inferred'
  if (src === 'confirmation_needed') return 'confirmation_needed'
  return 'direct_detected'
}

function toScopeLayer(priority: string): 'EXECUTION_SCOPE' | 'HIDDEN_PROBABLE_SCOPE' {
  return priority === 'required' ? 'EXECUTION_SCOPE' : 'HIDDEN_PROBABLE_SCOPE'
}

// ── Risk derivation from warnings ────────────────────────────────────────────
// Converts AI warnings[] into structured ai_risks rows.

interface DerivedRisk {
  title:       string
  description: string
  severity:    'high' | 'medium' | 'low'
  risk_type:   'scope' | 'technical' | 'timeline' | 'compliance'
  sort_order:  number
}

function deriveRisksFromWarnings(warnings: string[]): DerivedRisk[] {
  return warnings.map((w, i) => {
    const lower = w.toLowerCase()
    let severity: DerivedRisk['severity'] = 'medium'
    let risk_type: DerivedRisk['risk_type'] = 'scope'

    if (lower.includes('niewyraź') || lower.includes('ciemn') || lower.includes('rozmazany')) {
      severity = 'low'
      risk_type = 'scope'
    } else if (lower.includes('woda') || lower.includes('grzyb') || lower.includes('wilgoć')) {
      severity = 'high'
      risk_type = 'technical'
    } else if (lower.includes('instal') || lower.includes('elektryczn') || lower.includes('hydraul')) {
      severity = 'high'
      risk_type = 'technical'
    } else if (lower.includes('pozwolenie') || lower.includes('normę') || lower.includes('przepis')) {
      severity = 'high'
      risk_type = 'compliance'
    }

    return {
      title:       w.slice(0, 120),
      description: w,
      severity,
      risk_type,
      sort_order:  i,
    }
  })
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function markRunFailed(sb: SupabaseClient, runId: string, errorCode: string, errorMessage: string): Promise<void> {
  await sb
    .from('ai_analysis_runs')
    .update({ status: 'failed', error_code: errorCode, error_message: errorMessage.slice(0, 500) })
    .eq('id', runId)
    .then(() => undefined)
}

// ── Main persist function ─────────────────────────────────────────────────────

export async function persistAnalysisBundle(input: PersistBundleInput): Promise<PersistBundleResult> {
  const {
    sb, userId, companyId, projectId, roomType,
    textDescription, clarification, dimensionsJson, notes, modelName,
    imageRefs,
    result,
  } = input

  const startedAt = new Date().toISOString()

  // 1. Create the run record (status = 'processing')
  const { data: run, error: runErr } = await sb
    .from('ai_analysis_runs')
    .insert({
      company_id:       companyId,
      project_id:       projectId,
      created_by:       userId,
      status:           'processing',
      room_type:        roomType,
      text_description: textDescription ?? null,
      clarification:    clarification ?? null,
      dimensions_json:  dimensionsJson ?? null,
      notes:            notes ?? null,
      model_name:       modelName ?? null,
      started_at:       startedAt,
      missing_data:     result.missing_information.length > 0,
      confidence_summary: result.confidence,
    })
    .select('id')
    .single()

  if (runErr || !run) {
    const msg = runErr?.message ?? 'unknown error creating run'
    console.error('[ai-persist] Failed to create ai_analysis_runs record:', msg)
    return { run_id: '', ok: false, error: msg }
  }

  const runId = run.id as string

  try {
    // 2. Insert scope items
    const allScopeItems: ScopeItem[] = [
      ...result.required_work_scope,
      ...result.likely_work_scope,
      ...result.optional_work_scope,
    ]

    if (allScopeItems.length > 0) {
      const scopeRows = allScopeItems.map((item, i) => ({
        run_id:               runId,
        company_id:           companyId,
        project_id:           projectId,
        library_id:           item.library_id ?? null,
        title:                item.description.slice(0, 120),
        description:          item.description,
        category:             item.category,
        unit:                 item.unit ?? null,
        quantity_suggested:   item.quantity ?? null,
        price_suggested_by_ai: null,           // always null — AI never provides prices
        confidence:           item.confidence,
        sort_order:           i,
        source_kind:          toSourceKind(item),
        scope_layer:          toScopeLayer(item.priority),
        review_status:        'pending',
        missing_price:        true,
      }))

      const { error: scopeErr } = await sb.from('ai_scope_items').insert(scopeRows)
      if (scopeErr) {
        console.error('[ai-persist] Failed to insert ai_scope_items:', scopeErr.message)
        await markRunFailed(sb, runId, 'scope_items_insert_failed', scopeErr.message)
        return { run_id: runId, ok: false, error: `scope_items: ${scopeErr.message}` }
      }
    }

    // 3. Insert structured questions (from clarification_questions)
    const questions = result.clarification_questions ?? []
    if (questions.length > 0) {
      const questionRows = questions.map((q, i) => ({
        run_id:      runId,
        company_id:  companyId,
        project_id:  projectId,
        text:        q.text,
        severity:    q.severity ?? 'important_for_accuracy',
        category:    q.category ?? null,
        answer_type: q.answer_type ?? 'text',
        options:     q.options ?? null,
        status:      'unanswered',
        sort_order:  i,
      }))

      const { error: qErr } = await sb.from('ai_questions').insert(questionRows)
      if (qErr) {
        console.error('[ai-persist] Failed to insert ai_questions:', qErr.message)
        await markRunFailed(sb, runId, 'questions_insert_failed', qErr.message)
        return { run_id: runId, ok: false, error: `ai_questions: ${qErr.message}` }
      }
    }

    // 4. Insert risks (derived from warnings)
    const risks = deriveRisksFromWarnings(result.warnings)
    if (risks.length > 0) {
      const riskRows = risks.map(r => ({
        run_id:      runId,
        company_id:  companyId,
        project_id:  projectId,
        ...r,
        status:      'open',
      }))

      const { error: riskErr } = await sb.from('ai_risks').insert(riskRows)
      if (riskErr) {
        console.error('[ai-persist] Failed to insert ai_risks:', riskErr.message)
        await markRunFailed(sb, runId, 'risks_insert_failed', riskErr.message)
        return { run_id: runId, ok: false, error: `ai_risks: ${riskErr.message}` }
      }
    }

    // 5. Record input assets — Sprint 3 audit trail (REQUIRED before marking completed).
    //    Dual flow: images:{base64,type} feeds OpenAI inference; image_references record
    //    what was seen for full auditability. If refs were provided and the insert fails,
    //    the run is NOT marked completed — silent success without a full audit trail is
    //    not acceptable for Sprint 3.
    if (imageRefs && imageRefs.length > 0) {
      const assetRows = imageRefs.map(ref => ({
        run_id:            runId,
        company_id:        companyId,
        project_id:        projectId,
        storage_path:      ref.storage_path,
        original_filename: ref.original_filename,
        mime_type:         ref.mime_type,
        file_size:         ref.file_size,
        status:            'uploaded',
      }))
      const { error: assetErr } = await sb.from('ai_input_assets').insert(assetRows)
      if (assetErr) {
        console.error('[ai-persist] Failed to insert ai_input_assets:', assetErr.message)
        await markRunFailed(sb, runId, 'input_assets_insert_failed', assetErr.message)
        return { run_id: runId, ok: false, error: `ai_input_assets: ${assetErr.message}` }
      }
    }

    // 6. Mark run as completed — only after full bundle (including assets) is persisted.
    const completedAt = new Date().toISOString()
    const { error: updateErr } = await sb
      .from('ai_analysis_runs')
      .update({
        status:           'completed',
        completed_at:     completedAt,
        input_summary:    buildInputSummary(result),
        missing_data:     result.missing_information.length > 0,
        confidence_summary: result.confidence,
      })
      .eq('id', runId)

    if (updateErr) {
      console.error('[ai-persist] Failed to mark run as completed:', updateErr.message)
      return { run_id: runId, ok: false, error: `run_status_update: ${updateErr.message}` }
    }

    console.info('[ai-persist] Bundle persisted', {
      run_id:      runId,
      scopeItems:  allScopeItems.length,
      questions:   questions.length,
      risks:       risks.length,
      assets:      imageRefs?.length ?? 0,
    })

    return { run_id: runId, ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ai-persist] Unexpected error during persist:', msg)
    await markRunFailed(sb, runId, 'persist_error', msg)
    return { run_id: runId, ok: false, error: msg }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInputSummary(result: RoomAnalysisResult): string {
  const parts: string[] = []
  if (result.space_type) parts.push(result.space_type)
  if (result.stage_of_work && result.stage_of_work !== 'unknown') parts.push(result.stage_of_work)
  const total = result.required_work_scope.length + result.likely_work_scope.length + result.optional_work_scope.length
  parts.push(`${total} pozycji`)
  if (result.confidence) parts.push(`pewność ${Math.round(result.confidence)}%`)
  return parts.join(', ')
}
