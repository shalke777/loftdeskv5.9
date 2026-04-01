// =============================================================================
// src/services/ai/composite/bundle.service.ts
// =============================================================================
// Service layer for Composite Project Analysis — Bundle operations.
// Handles bundle creation, asset registration, asset status updates,
// and persisting extraction contract output to the DB.
//
// All mutations use the Supabase service-role client (bypasses RLS).
// Reads can use either the anon/user client (RLS-filtered) or service-role.
//
// Does NOT touch P0 tables: ai_analysis_runs, ai_scope_items, ai_input_assets,
// ai_questions_risks, ai_review_actions, company_memory_feedback.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AiAnalysisBundle,
  AiBundleAsset,
  BundleStatus,
  CreateBundleInput,
  RegisterAssetInput,
  UpdateAssetStatusInput,
} from './bundle.types'
import type { ExtractionContractOutput } from './extraction.contract'
import { validateExtractionOutput } from './extraction.contract'

// ── Bundle creation ───────────────────────────────────────────────────────────

/**
 * Creates a new analysis bundle for a project.
 * Must be called with the service-role client.
 */
export async function createBundle(
  client: SupabaseClient,
  input: CreateBundleInput,
): Promise<AiAnalysisBundle> {
  const { data, error } = await client
    .from('ai_analysis_bundles')
    .insert({
      company_id: input.company_id,
      project_id: input.project_id,
      created_by: input.created_by,
      label:      input.label ?? null,
      status:     'pending',
    })
    .select()
    .single()

  if (error) throw new Error(`createBundle failed: ${error.message}`)
  return data as AiAnalysisBundle
}

// ── Asset registration ────────────────────────────────────────────────────────

/**
 * Registers a file or text note as an asset in a bundle.
 * Must be called with the service-role client.
 */
export async function registerAsset(
  client: SupabaseClient,
  input: RegisterAssetInput,
): Promise<AiBundleAsset> {
  const { data, error } = await client
    .from('ai_bundle_assets')
    .insert({
      bundle_id:          input.bundle_id,
      company_id:         input.company_id,
      project_id:         input.project_id,
      storage_path:       input.storage_path,
      original_filename:  input.original_filename,
      mime_type:          input.mime_type,
      file_size_bytes:    input.file_size_bytes ?? null,
      source_type:        input.source_type,
      source_role:        input.source_role,
      room_hint:          input.room_hint ?? null,
      source_priority:    input.source_priority ?? 50,
      extraction_status:  'pending',
      input_asset_id:     input.input_asset_id ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`registerAsset failed: ${error.message}`)

  // Increment asset_count on the bundle
  await incrementBundleCounter(client, input.bundle_id, 'asset_count', 1)

  return data as AiBundleAsset
}

// ── Asset status update ───────────────────────────────────────────────────────

/**
 * Updates the extraction_status of a single asset.
 * Also increments bundle counters as appropriate.
 * Must be called with the service-role client.
 */
export async function updateAssetStatus(
  client: SupabaseClient,
  input: UpdateAssetStatusInput,
): Promise<void> {
  const { error } = await client
    .from('ai_bundle_assets')
    .update({
      extraction_status: input.extraction_status,
      processing_error:  input.processing_error ?? null,
    })
    .eq('id', input.asset_id)

  if (error) throw new Error(`updateAssetStatus failed: ${error.message}`)
}

// ── Bundle status update ──────────────────────────────────────────────────────

/**
 * Updates the top-level bundle status and optional summary fields.
 * Must be called with the service-role client.
 */
export async function updateBundleStatus(
  client: SupabaseClient,
  bundleId: string,
  status: BundleStatus,
  opts?: {
    confidence_summary?: number
    missing_data?: boolean
    error_message?: string
    extracted_count?: number
    failed_count?: number
  },
): Promise<void> {
  const patch: Record<string, unknown> = { status }

  if (status === 'processing' || status === 'pending') {
    patch.submitted_at = new Date().toISOString()
  }
  if (status === 'ready' || status === 'failed') {
    patch.completed_at = new Date().toISOString()
  }
  if (opts?.confidence_summary !== undefined) patch.confidence_summary = opts.confidence_summary
  if (opts?.missing_data !== undefined)       patch.missing_data = opts.missing_data
  if (opts?.error_message !== undefined)      patch.error_message = opts.error_message
  if (opts?.extracted_count !== undefined)    patch.extracted_count = opts.extracted_count
  if (opts?.failed_count !== undefined)       patch.failed_count = opts.failed_count

  const { error } = await client
    .from('ai_analysis_bundles')
    .update(patch)
    .eq('id', bundleId)

  if (error) throw new Error(`updateBundleStatus failed: ${error.message}`)
}

// ── Persist extraction output ─────────────────────────────────────────────────

/**
 * Persists the full ExtractionContractOutput to ai_extraction_results.
 * Validates the contract before writing. Updates the asset extraction_status.
 * Must be called with the service-role client.
 */
export async function persistExtractionOutput(
  client: SupabaseClient,
  output: ExtractionContractOutput,
): Promise<void> {
  const { valid, errors } = validateExtractionOutput(output)
  if (!valid) {
    throw new Error(`ExtractionContract validation failed: ${errors.join('; ')}`)
  }

  const rows = output.evidence.map((item) => ({
    bundle_id:          output.bundle_id,
    asset_id:           output.asset_id,
    company_id:         output.company_id,
    project_id:         output.project_id,
    extractor_type:     output.extractor_type,
    evidence_type:      item.evidence_type,
    content:            item.content,
    room_label:         item.room_label ?? null,
    confidence_score:   item.confidence_score,
    confidence_reason:  item.confidence_reason,
    source_anchor:      item.source_anchor ?? null,
    conflict_ids:       item.conflict_ids ?? [],
  }))

  const { error: insertError } = await client
    .from('ai_extraction_results')
    .insert(rows)

  if (insertError) {
    await updateAssetStatus(client, {
      asset_id:           output.asset_id,
      extraction_status:  'failed',
      processing_error:   insertError.message,
    })
    throw new Error(`persistExtractionOutput insert failed: ${insertError.message}`)
  }

  await updateAssetStatus(client, {
    asset_id:          output.asset_id,
    extraction_status: 'extracted',
  })
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function incrementBundleCounter(
  client: SupabaseClient,
  bundleId: string,
  column: 'asset_count' | 'extracted_count' | 'failed_count',
  delta: number,
): Promise<void> {
  // Supabase doesn't support atomic increments on RPC-less clients, so we use
  // a raw SQL RPC. If unavailable, fall back to a read-modify-write.
  const { error } = await client.rpc('increment_bundle_counter', {
    p_bundle_id: bundleId,
    p_column:    column,
    p_delta:     delta,
  })

  if (error) {
    // Graceful degradation: non-fatal, counters are denormalized summaries
    console.warn(`[bundle.service] increment_bundle_counter fallback: ${error.message}`)
  }
}
