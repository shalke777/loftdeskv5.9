// =============================================================================
// useAnalyzeProject — Client hook for project / design document analysis
// =============================================================================
// Calls the analyze-project Netlify function and returns a ProjectAnalysisResult.
// Supports: project PDFs, design visualizations, technical drawings.
//
// Deliberately SEPARATE from useAnalyzeRoomPhoto:
//   - Different Netlify endpoint (analyze-project)
//   - Returns ProjectAnalysisResult (not AnalysisResult envelope)
//   - Handles both PDF and image inputs

import { useMutation } from '@tanstack/react-query'
import { netlifyFn } from '@/shared/lib/functions'
import { supabase } from '@/shared/lib/supabase'
import type { ProjectAnalysisResult } from '@/services/ai/engines/project.types'

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

const MAX_FILE_SIZE   = 20 * 1024 * 1024 // 20 MB — large project PDFs use storage path
const URL_THRESHOLD   = 4 * 1024 * 1024  // 4 MB — above this, upload to storage first (Lambda body ≤6 MB)

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif',
])

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? result)
    }
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

/** Validate the file before sending to the Netlify function */
function validateProjectFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `Plik jest za duży (max 20 MB). Skompresuj PDF lub zmniejsz rozdzielczość obrazu.`
  }

  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  const isPdf   = mime === 'application/pdf' || name.endsWith('.pdf')
  const isImage = mime.startsWith('image/')

  if (!isPdf && !isImage && !ACCEPTED_TYPES.has(mime)) {
    return `Nieobsługiwany typ pliku: ${file.type || 'nieznany'}. Użyj PDF lub obrazu (JPEG/PNG/WEBP).`
  }

  return null  // valid
}

/** Upload large file to Supabase Storage for server-side download */
async function uploadToStorage(file: File, companyId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowane.')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesja wygasła — zaloguj się ponownie.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${companyId}/ai-analysis/${Date.now()}_${safeName}`
  const contentType = file.type || 'application/octet-stream'
  const { error } = await supabase.storage
    .from('company-files')
    .upload(storagePath, file, { upsert: false, contentType })
  if (error) throw new Error(`Upload do storage nie powiódł się: ${error.message}`)
  return storagePath
}

// ── Core async function ───────────────────────────────────────────────────────

export async function callAnalyzeProject(
  file: File,
  context?: string,
  projectId?: string,
  companyId?: string,
): Promise<ProjectAnalysisResult> {
  const validationError = validateProjectFile(file)
  if (validationError) {
    return {
      project_type: 'unknown',
      project_name: null,
      rooms_detected: [],
      total_area_m2: null,
      building_type: null,
      finish_materials: [],
      equipment_detected: [],
      work_scope_from_project: [],
      suggested_estimate_items: [],
      assumptions: [],
      missing_information: [],
      project_notes: [],
      confidence: 0,
      warnings: [validationError],
      comparison_ready: false,
    }
  }

  const fileType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
  const useLargeFilePath = file.size > URL_THRESHOLD

  const payload: Record<string, unknown> = {
    file_type:         fileType,
    file_name:         file.name,
    context:           context ?? undefined,
    project_type_hint: fileType === 'application/pdf' ? 'pdf' : 'visualization',
    project_id:        projectId || undefined,
  }

  if (useLargeFilePath) {
    // Large file: upload to Supabase Storage, send path to backend
    if (!companyId) throw new Error('Brak identyfikatora firmy — nie można przesłać dużego pliku.')
    const storagePath = await uploadToStorage(file, companyId)
    payload.storage_path = storagePath
  } else {
    // Small file: send as base64 inline (existing path)
    payload.file_base64 = await fileToBase64(file)
  }

  let resp: Response
  try {
    resp = await fetch(netlifyFn('analyze-project'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body:    JSON.stringify(payload),
    })
  } catch {
    throw new Error('Serwer analizy projektu niedostępny.')
  }

  const data = await resp.json().catch(() => ({})) as Record<string, unknown>

  if (!resp.ok) {
    // Surface backend message if available
    const serverMsg = typeof data.message === 'string' ? data.message : null
    const errCode = String(data.error ?? '')
    if (resp.status === 401 || errCode === 'unauthorized')
      throw new Error('Sesja wygasła — zaloguj się ponownie.')
    if (resp.status === 405 || errCode === 'method_not_allowed')
      throw new Error('Błąd konfiguracji endpointu AI (405). Odśwież stronę i spróbuj ponownie.')
    if (resp.status === 429 || errCode === 'too_many_requests')
      throw new Error('Za dużo żądań. Spróbuj za chwilę.')
    if (errCode === 'daily_limit_exceeded')
      throw new Error(serverMsg ?? 'Dzienny limit analiz AI został wyczerpany. Spróbuj ponownie jutro.')
    if (errCode === 'ai_disabled')
      throw new Error('Moduł AI nie jest włączony na tym środowisku.')
    if (errCode === 'auth_not_configured')
      throw new Error('Autentykacja Supabase nie jest skonfigurowana — AI niedostępne.')
    if (errCode === 'plan_insufficient')
      throw new Error('AI Engine wymaga planu Pro lub Business. Zaktualizuj plan w ustawieniach.')
    if (errCode === 'project_access_denied')
      throw new Error('Brak dostępu do projektu lub projekt nie istnieje.')
    if (errCode === 'missing_project_id')
      throw new Error('Nie wybrano projektu. Wróć i wybierz projekt.')
    if (resp.status === 413 || errCode === 'file_too_large')
      throw new Error(serverMsg ?? 'Plik jest za duży. Skompresuj PDF lub zmniejsz rozdzielczość.')
    if (resp.status === 422 || errCode === 'invalid_input')
      throw new Error(serverMsg ?? 'Dane wejściowe zostały odrzucone. Sprawdź format i rozmiar pliku.')
    if (resp.status === 504 || resp.status === 524)
      throw new Error(serverMsg ?? 'Analiza projektu trwa zbyt długo. Spróbuj z mniejszym plikiem lub podziel PDF na strony.')
    if (resp.status === 502 || errCode === 'ai_call_failed' || errCode === 'provider_error' || errCode === 'storage_fetch_failed')
      throw new Error(serverMsg ?? 'Serwis AI tymczasowo niedostępny. Spróbuj ponownie za chwilę.')
    if (errCode === 'ai_not_configured')
      throw new Error('AI nie jest skonfigurowane (brak OPENAI_API_KEY)')
    if (resp.status === 400)
      throw new Error(serverMsg ?? 'Błąd wejścia — sprawdź format pliku.')
    throw new Error(serverMsg ?? `HTTP ${resp.status}`)
  }

  const result = data.result as ProjectAnalysisResult
  if (!result || typeof result !== 'object') {
    throw new Error('Nieprawidłowa odpowiedź serwera analizy projektu.')
  }

  return result
}

// ── React Query mutation hook ─────────────────────────────────────────────────

export function useAnalyzeProject() {
  return useMutation({
    mutationFn: ({ file, context, projectId, companyId }: { file: File; context?: string; projectId?: string; companyId?: string }) =>
      callAnalyzeProject(file, context, projectId, companyId),
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false
      const msg = error instanceof Error ? error.message : ''
      return /502|503|504|niedostępny|network|fetch/i.test(msg)
    },
    retryDelay: 3000,
  })
}
