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

const MAX_FILE_SIZE = 15 * 1024 * 1024  // 15 MB — project PDFs can be large

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
    return `Plik jest za duży (max 15 MB). Skompresuj PDF lub zmniejsz rozdzielczość obrazu.`
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

// ── Core async function ───────────────────────────────────────────────────────

export async function callAnalyzeProject(
  file: File,
  context?: string,
  projectId?: string,
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

  const base64    = await fileToBase64(file)
  const fileType  = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')

  let resp: Response
  try {
    resp = await fetch(netlifyFn('analyze-project'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body:    JSON.stringify({
        file_base64:       base64,
        file_type:         fileType,
        file_name:         file.name,
        context:           context ?? undefined,
        project_type_hint: fileType === 'application/pdf' ? 'pdf' : 'visualization',
        project_id:        projectId || undefined,
      }),
    })
  } catch {
    throw new Error('Serwer analizy projektu niedostępny.')
  }

  const data = await resp.json().catch(() => ({})) as Record<string, unknown>

  if (!resp.ok) {
    const errCode = String(data.error ?? '')
    if (resp.status === 401 || errCode === 'unauthorized')
      throw new Error('Sesja wygasła — zaloguj się ponownie.')
    if (resp.status === 405 || errCode === 'method_not_allowed')
      throw new Error('Błąd konfiguracji endpointu AI (405). Odśwież stronę i spróbuj ponownie.')
    if (resp.status === 429 || errCode === 'too_many_requests')
      throw new Error('Za dużo żądań. Spróbuj za chwilę.')
    if (errCode === 'daily_limit_exceeded')
      throw new Error('Dzienny limit analiz AI został wyczerpany. Spróbuj ponownie jutro.')
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
      throw new Error('Plik jest za duży. Skompresuj PDF lub zmniejsz rozdzielczość.')
    if (resp.status === 422 || errCode === 'invalid_input')
      throw new Error(String(data.message ?? 'Dane wejściowe zostały odrzucone. Sprawdź format i rozmiar pliku.'))
    if (resp.status === 504 || resp.status === 524)
      throw new Error('Analiza projektu trwa zbyt długo. Spróbuj z mniejszym plikiem lub podziel PDF na strony.')
    if (resp.status === 502 || errCode === 'ai_call_failed' || errCode === 'provider_error')
      throw new Error(String(data.message ?? 'Serwis AI tymczasowo niedostępny. Spróbuj ponownie za chwilę.'))
    if (errCode === 'ai_not_configured')
      throw new Error('AI nie jest skonfigurowane (brak OPENAI_API_KEY)')
    if (resp.status === 400)
      throw new Error(String(data.message ?? 'Błąd wejścia — sprawdź format pliku.'))
    throw new Error(String(data.message ?? `HTTP ${resp.status}`))
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
    mutationFn: ({ file, context, projectId }: { file: File; context?: string; projectId?: string }) =>
      callAnalyzeProject(file, context, projectId),
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false
      const msg = error instanceof Error ? error.message : ''
      return /502|503|504|niedostępny|network|fetch/i.test(msg)
    },
    retryDelay: 3000,
  })
}
