// =============================================================================
// src/services/ai/composite/call-extract-asset.ts
// =============================================================================
// Client-side helper: calls the REAL composite-extract-asset Netlify function.
//
// Takes a registered asset_id, fetches the file from Supabase Storage,
// converts it to base64, and calls the real extractor endpoint.
//
// Usage (browser console):
//   import { callExtractAsset } from '@/services/ai/composite/call-extract-asset'
//   const result = await callExtractAsset(supabase, 'asset-uuid-here')
//
// Does NOT touch P0. Uses the existing Netlify function + persistence pipeline.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { netlifyFn } from '@/shared/lib/functions'
import type { AiBundleAsset } from './bundle.types'

/** Result returned by callExtractAsset. */
export interface ExtractAssetResult {
  ok: boolean
  asset_id: string
  bundle_id: string
  evidence_count?: number
  confidence_summary?: number
  missing_data?: boolean
  skipped?: boolean
  error?: string
  message?: string
  extraction_ms: number
}

/**
 * Fetch a registered asset's file from Storage and call the real
 * composite-extract-asset Netlify function to extract evidence.
 *
 * Prerequisites:
 *   - Asset must exist in ai_bundle_assets with a valid storage_path
 *   - File must exist in Supabase Storage at storage_path
 *   - User must be authenticated (JWT is sent automatically)
 */
export async function callExtractAsset(
  client: SupabaseClient,
  assetId: string,
): Promise<ExtractAssetResult> {
  const t0 = performance.now()

  // 1. Load asset from DB
  const { data: asset, error: assetErr } = await client
    .from('ai_bundle_assets')
    .select('*')
    .eq('id', assetId)
    .single()

  if (assetErr || !asset) {
    return {
      ok: false, asset_id: assetId, bundle_id: '',
      error: 'asset_not_found',
      message: assetErr?.message ?? 'No data returned',
      extraction_ms: Math.round(performance.now() - t0),
    }
  }

  const a = asset as AiBundleAsset

  // 2. Download file from Supabase Storage → base64
  const fileBase64 = await downloadAsBase64(client, a.storage_path)
  if (!fileBase64) {
    return {
      ok: false, asset_id: assetId, bundle_id: a.bundle_id,
      error: 'storage_download_failed',
      message: `Cannot download file from storage: ${a.storage_path}`,
      extraction_ms: Math.round(performance.now() - t0),
    }
  }

  // 3. Get auth token
  const authHeader = await getAuthHeader(client)

  // 4. Call the Netlify function
  const url = netlifyFn('composite-extract-asset')

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: JSON.stringify({
      asset_id:    a.id,
      file_base64: fileBase64,
      file_mime:   a.mime_type,
      source_role: a.source_role ?? undefined,
      room_hint:   a.room_hint ?? undefined,
    }),
  })

  const elapsed = Math.round(performance.now() - t0)

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    return {
      ok: false, asset_id: assetId, bundle_id: a.bundle_id,
      error: `http_${resp.status}`,
      message: text.slice(0, 300),
      extraction_ms: elapsed,
    }
  }

  const body = await resp.json()

  return {
    ...body,
    asset_id: assetId,
    bundle_id: a.bundle_id,
    extraction_ms: elapsed,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function downloadAsBase64(
  client: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  // storage_path format: "bucket/path/file.pdf" — split into bucket + key
  const parts = storagePath.split('/')
  if (parts.length < 2) return null

  const bucket = parts[0]
  const filePath = parts.slice(1).join('/')

  const { data, error } = await client.storage.from(bucket).download(filePath)

  if (error || !data) {
    // Fallback: try "project-files" bucket with full path
    const { data: d2, error: e2 } = await client.storage
      .from('project-files')
      .download(storagePath)

    if (e2 || !d2) return null
    return await blobToBase64(d2)
  }

  return await blobToBase64(data)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Strip the data URL prefix "data:...;base64,"
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function getAuthHeader(
  client: SupabaseClient,
): Promise<Record<string, string>> {
  const { data: { session } } = await client.auth.getSession()
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` }
  }
  return {}
}
