// =============================================================================
// src/features/ai-review/lib/uploadAiInput.ts
// =============================================================================
// Upload a photo to the private ai-inputs bucket before triggering analysis.
// Returns the storage path and metadata to include in the POST request body
// as image_references — used by the backend to record ai_input_assets rows.
//
// Sprint 3 dual flow:
//   - images:{base64,type} is sent alongside image_references for OpenAI inference.
//   - image_references (storage paths) are for the mandatory audit trail only.
//   - The backend does NOT analyse storage objects directly.
//
// Path convention: {companyId}/{projectId}/ai-inputs/{uuid}_{safeFilename}
// The first path segment must match my_company_id() — required by bucket RLS.
// P0 limit: max 5 photos per analysis run.
// =============================================================================

import { supabase } from '@/shared/lib/supabase'

/** Bucket hard limit: 10 MB */
export const AI_INPUT_MAX_BYTES = 10 * 1024 * 1024

export const AI_INPUT_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export interface AiInputRef {
  storage_path:      string
  original_filename: string
  mime_type:         string
  file_size:         number
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Upload a single photo to the ai-inputs bucket.
 * Throws a user-facing Polish error string on validation failure.
 * Throws a Supabase error object on storage failure.
 */
export async function uploadAiInput(
  file:      File,
  companyId: string,
  projectId: string,
): Promise<AiInputRef> {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany.')

  if (file.size > AI_INPUT_MAX_BYTES) {
    throw new Error(
      `Plik ${file.name} jest za duży (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit: 10 MB.`,
    )
  }

  const mimeType = file.type || 'image/jpeg'
  if (!AI_INPUT_ALLOWED_TYPES.has(mimeType)) {
    throw new Error(
      `Nieobsługiwany format ${mimeType}. Dozwolone: JPG, PNG, WEBP, HEIC.`,
    )
  }

  const safeName    = sanitizeFilename(file.name)
  const uuid        = crypto.randomUUID()
  const storagePath = `${companyId}/${projectId}/ai-inputs/${uuid}_${safeName}`

  const { error } = await supabase.storage
    .from('ai-inputs')
    .upload(storagePath, file, { upsert: false, contentType: mimeType })

  if (error) throw error

  return {
    storage_path:      storagePath,
    original_filename: file.name,
    mime_type:         mimeType,
    file_size:         file.size,
  }
}
