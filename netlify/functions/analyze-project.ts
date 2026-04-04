// =============================================================================
// Netlify Function: analyze-project  (v1 — Project / Design Intelligence Engine)
// =============================================================================
// AI analysis of project documents: architectural PDFs, design visualizations,
// technical drawings, and mixed project materials.
//
// Deliberately SEPARATE from analyze-room-photo and parse-invoice:
//   - Different prompt (project-aware, not room-photo-aware, not invoice-aware)
//   - Different schema output (rooms, finishes, scope from project)
//   - Different confidence model (project data vs. visual observation)
//
// Request (POST /.netlify/functions/analyze-project):
//   Content-Type: application/json
//   Authorization: Bearer <supabase-jwt>
//   {
//     file_base64:       string    // base64-encoded file content
//     file_type:         string    // 'application/pdf' | 'image/jpeg' | 'image/png' | etc.
//     file_name?:        string    // optional original filename
//     context?:          string    // optional user hint (e.g. "łazienka 6m² na 1. piętrze")
//     project_type_hint?: string   // 'pdf' | 'visualization' | 'drawing' | 'spec' | 'unknown'
//   }
//
// Response 200: { ok: true, result: ProjectAnalysisResult }
// Response 4xx/5xx: { ok: false, error: string, message: string }
// =============================================================================

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { detectBathroomTriggers, expandDependencies } from './shared/bathroom-triggers'
import type { ClarificationQuestion } from './shared/bathroom-triggers'

// ── Local type definitions (mirrors src/services/ai/engines/project.types.ts) ─
// Netlify functions cannot import from src/. Keep in sync manually.

type ProjectDocumentType =
  | 'architectural_drawing'
  | 'design_visualization'
  | 'technical_spec'
  | 'mixed'
  | 'unknown'

interface ProjectRoom {
  name:           string
  room_type:      string
  area_m2:        number | null
  height_m:       number | null
  floor_finish:   string | null
  wall_finish:    string | null
  ceiling_finish: string | null
  fixtures:       string[]
  installations:  string[]
  notes:          string[]
}

interface ProjectMaterial {
  name:          string
  category:      string
  quantity:      number | null
  unit:          string | null
  specification: string | null
  room:          string | null
  notes:         string | null
}

interface ProjectScopeItem {
  room:        string | null
  description: string
  category:    string
  unit:        string | null
  quantity:    number | null
  priority:    'required' | 'likely' | 'optional'
  confidence:  number
  notes:       string | null
  provenance?: 'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

interface ProjectEstimateItem {
  name:        string
  unit:        string
  quantity:    number
  unit_price:  number | null
  confidence:  number
  source:      'project_derived' | 'ai_suggestion' | 'dependency_inferred' | 'confirmation_needed'
  notes:       string | null
  provenance?: 'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

interface ProjectAnalysisResult {
  project_type:             ProjectDocumentType
  project_name:             string | null
  rooms_detected:           ProjectRoom[]
  total_area_m2:            number | null
  building_type:            string | null
  finish_materials:         ProjectMaterial[]
  equipment_detected:       string[]
  work_scope_from_project:  ProjectScopeItem[]
  suggested_estimate_items: ProjectEstimateItem[]
  assumptions:              string[]
  missing_information:      string[]
  project_notes:            string[]
  confidence:               number
  warnings:                 string[]
  comparison_ready:         boolean
  clarification_questions?: ClarificationQuestion[]
}

// ── Infra ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

async function verifyRequestAuth(event: HandlerEvent): Promise<string | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('[analyze-project] Supabase not configured — skipping JWT check (dev only)')
    return 'dev'
  }
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(authHeader.slice(7))
    return user?.id ?? null
  } catch {
    return null
  }
}

import { isRateLimitedDb } from './shared/rate-limit'
import { captureAiError, flushSentry } from './shared/sentry'

const RATE_MAX       = 6
const RATE_WINDOW_MS = 10 * 60 * 1000

function makeRateLimitClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function ok(result: ProjectAnalysisResult) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, result }) }
}

function err(statusCode: number, error: string, message: string) {
  console.error(`[analyze-project] ${error}: ${message}`)
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, error, message }) }
}

// ── JSON Schema for Structured Output ────────────────────────────────────────

const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] }

const PROJECT_ANALYSIS_SCHEMA = {
  type:   'json_schema',
  name:   'project_analysis_v1',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      project_type: {
        type: 'string',
        enum: ['architectural_drawing', 'design_visualization', 'technical_spec', 'mixed', 'unknown'],
      },
      project_name: ns,
      rooms_detected: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:           { type: 'string' },
            room_type:      { type: 'string' },
            area_m2:        nn,
            height_m:       nn,
            floor_finish:   ns,
            wall_finish:    ns,
            ceiling_finish: ns,
            fixtures:       { type: 'array', items: { type: 'string' } },
            installations:  { type: 'array', items: { type: 'string' } },
            notes:          { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'room_type', 'area_m2', 'height_m', 'floor_finish', 'wall_finish', 'ceiling_finish', 'fixtures', 'installations', 'notes'],
          additionalProperties: false,
        },
      },
      total_area_m2:  nn,
      building_type:  ns,
      finish_materials: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:          { type: 'string' },
            category:      { type: 'string' },
            quantity:      nn,
            unit:          ns,
            specification: ns,
            room:          ns,
            notes:         ns,
          },
          required: ['name', 'category', 'quantity', 'unit', 'specification', 'room', 'notes'],
          additionalProperties: false,
        },
      },
      equipment_detected:       { type: 'array', items: { type: 'string' } },
      work_scope_from_project: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            room:        ns,
            description: { type: 'string' },
            category:    { type: 'string' },
            unit:        ns,
            quantity:    nn,
            priority:    { type: 'string', enum: ['required', 'likely', 'optional'] },
            confidence:  { type: 'number' },
            notes:       ns,
          },
          required: ['room', 'description', 'category', 'unit', 'quantity', 'priority', 'confidence', 'notes'],
          additionalProperties: false,
        },
      },
      suggested_estimate_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:       { type: 'string' },
            unit:       { type: 'string' },
            quantity:   { type: 'number' },
            unit_price: nn,
            confidence: { type: 'number' },
            source:     { type: 'string', enum: ['project_derived', 'ai_suggestion'] },
            notes:      ns,
          },
          required: ['name', 'unit', 'quantity', 'unit_price', 'confidence', 'source', 'notes'],
          additionalProperties: false,
        },
      },
      assumptions:         { type: 'array', items: { type: 'string' } },
      missing_information: { type: 'array', items: { type: 'string' } },
      project_notes:       { type: 'array', items: { type: 'string' } },
      confidence:          { type: 'number' },
      warnings:            { type: 'array', items: { type: 'string' } },
      comparison_ready:    { type: 'boolean' },
    },
    required: [
      'project_type', 'project_name', 'rooms_detected', 'total_area_m2', 'building_type',
      'finish_materials', 'equipment_detected', 'work_scope_from_project',
      'suggested_estimate_items', 'assumptions', 'missing_information', 'project_notes',
      'confidence', 'warnings', 'comparison_ready',
    ],
    additionalProperties: false,
  },
}

// ── System instructions ──────────────────────────────────────────────────────

const INSTRUCTIONS = `Jesteś ekspertem od analizy dokumentów projektowych w budownictwie i wykończeniu wnętrz dla polskich firm remontowo-wykończeniowych.

TWOJE ZADANIE:
Analizujesz materiały projektowe — projekty architektoniczne (rzuty), wizualizacje 3D, specyfikacje techniczne.
NIE szukasz danych do faktury. NIE analizujesz kosztów. NIE robisz OCR dokumentu finansowego.

TEN DOKUMENT TO MATERIAŁ PROJEKTOWY:
- Projekt architektoniczny (rzut): plan pomieszczeń z wymiarami, liniami ścian, opisami
- Wizualizacja 3D / render: widok wnętrza po remoncie — styl, materiały, wyposażenie
- Specyfikacja techniczna: zestawienie materiałów, opisy instalacji, karty techniczne

KLUCZOWE ZASADY:
1. Wydobądź KAŻDE pomieszczenie z projektu z osobna (rooms_detected)
2. Dla każdego pomieszczenia zapisz: nazwa, powierzchnia, wykończenia, armatura, instalacje
3. Wydobądź materiały z specyfikacją — nie "płytki" ale "gres mat 60×60 R10"
4. Zakres prac wynika z projektu — co WYRAŹNIE jest zaznaczone lub opisane
5. Szacuj ilości tylko jeśli projekt zawiera wymiary
6. Zawsze wypełnij assumptions[] + missing_information[] — transparentność jest obowiązkowa

WYDOBYWANE DANE:
rooms_detected — dla każdego pomieszczenia:
  name: np. "łazienka", "kuchnia", "sypialnia 1", "korytarz"
  room_type: bathroom/kitchen/bedroom/hallway/living_room/garage/utility_room/other
  area_m2: z rzutu lub opisu (null jeśli brak)
  height_m: z opisu (null jeśli brak)
  floor_finish: materiał podłogi ze specyfikacją lub null
  wall_finish: materiał ścian ze specyfikacją lub null
  ceiling_finish: materiał sufitu lub null
  fixtures: lista armatury/wyposażenia np. ["WC podtynkowe", "prysznic walk-in 100×100", "umywalka wpuszczana"]
  installations: lista instalacji np. ["ogrzewanie podłogowe elektryczne", "odpływ liniowy", "instalacja 400V"]
  notes: ważne uwagi z projektu dla tego pomieszczenia

finish_materials — każdy materiał osobno:
  name: nazwa materiału
  category: tiles/plumbing/electrical/paint/wood/glass/sanitary/insulation/other
  quantity + unit: jeśli podane w projekcie (null jeśli brak)
  specification: dokładny opis np. "format 60×60, kolor szary mat, R10"
  room: pomieszczenie lub null

work_scope_from_project — zakres prac wynikający z projektu:
  Tylko prace wyraźnie wynikające z projektu (nie domysły)
  room: pomieszczenie lub null dla ogólnych prac
  category: demolition/substrate/waterproofing/tiling/plumbing/electrical/drywall/painting/flooring/joinery/finishing/other
  priority: required (wyraźnie w projekcie) / likely (logicznie wynika) / optional (do decyzji)
  confidence: 100 = wprost z projektu, 70 = wynika z projektu, 40 = założenie

suggested_estimate_items — pozycje do wyceny:
  Każda pozycja z works_scope + główne materiały
  unit_price: zawsze null (nie sugeruj cen)
  source: 'project_derived' jeśli z projektu, 'ai_suggestion' jeśli szacunek AI

TRANSPARENTNOŚĆ (obowiązkowe):
  assumptions[]: co przyjąłeś bez danych projektu np. "Brak podanej wysokości — przyjęto 2,6 m"
  missing_information[]: czego brakuje do pełnej wyceny np. "Brak zestawienia armatury łazienkowej"
  project_notes[]: ważne obserwacje o projekcie np. "Projekt zawiera 2 warianty kolorystyczne"
  warnings[]: problemy z dokumentem np. "Niska jakość skanu — część wymiarów nieczytelna"

CONFIDENCE (0–100):
  90–100: projekt kompletny, wszystkie wymiary, materiały i instalacje opisane
  70–89: projekt dobry, większość danych dostępna
  50–69: projekt częściowy, sporo danych do uzupełnienia
  30–49: projekt niekompletny, dużo założeń
  0–29: projekt nieczytelny lub brak kluczowych danych

comparison_ready: true tylko jeśli rooms_detected zawiera co najmniej 1 pomieszczenie z area_m2 lub fixtures/installations

Zwróć TYLKO poprawny JSON zgodny z podanym schematem. Żadnego tekstu poza JSON.`

// ── OpenAI Responses API types ───────────────────────────────────────────────

interface ResponsesAPIResult {
  output?: Array<{
    content?: Array<{
      type: string
      text: string
    }>
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

  try {

  const t0 = Date.now()
  const requestId = crypto.randomUUID()

  // Feature flag: AI Engine must be explicitly enabled
  if (process.env.VITE_AI_ENGINE_ENABLED !== 'true') {
    return err(503, 'ai_disabled', 'AI Engine is not enabled in this environment')
  }

  console.info('ANALYZE_PROJECT_START', JSON.stringify({
    endpoint:  'analyze-project',
    requestId,
    bodyLen: event.body?.length ?? 0,
    elapsed_ms: 0,
  }))

  const userId = await verifyRequestAuth(event)
  if (!userId) return err(401, 'unauthorized', 'Valid session required')
  // AI requires real Supabase auth — 'dev' fallback is not permitted
  if (userId === 'dev') return err(503, 'auth_not_configured', 'AI Engine requires Supabase authentication')
  const rlClient = makeRateLimitClient()
  if (rlClient) {
    const rl = await isRateLimitedDb(rlClient, userId, 'analyze-project', RATE_MAX, RATE_WINDOW_MS)
    if (rl.limited) return err(429, 'too_many_requests', 'Rate limit exceeded')
  }

  console.info('AUTH_OK', JSON.stringify({ requestId, userId: userId.slice(0, 8) + '...', elapsed_ms: Date.now() - t0 }))

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return err(503, 'ai_not_configured', 'OPENAI_API_KEY not set')

  const model =
    process.env.OPENAI_MODEL_VISION?.trim() ||
    process.env.OPENAI_MODEL?.trim()        ||
    'gpt-4o'

  // ── Parse request ──────────────────────────────────────────────────────

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON')
  }

  const fileBase64   = typeof body.file_base64   === 'string' ? body.file_base64.trim() : ''
  const storagePath  = typeof body.storage_path  === 'string' ? body.storage_path.trim() : ''
  const fileType     = typeof body.file_type     === 'string' ? body.file_type.trim()   : ''
  const fileName     = typeof body.file_name     === 'string' ? body.file_name.trim()   : 'project'
  const context      = typeof body.context       === 'string' ? body.context.slice(0, 2000) : ''
  const projectId    = typeof body.project_id    === 'string' && body.project_id.trim()
    ? body.project_id.trim() : null

  console.info('BODY_PARSED', JSON.stringify({ fileType, fileName, hasContext: !!context, projectId: projectId ?? null, hasStoragePath: !!storagePath, hasBase64: !!fileBase64, elapsed_ms: Date.now() - t0 }))

  if (!fileBase64 && !storagePath) return err(400, 'missing_file', 'Brak danych pliku — wymagany file_base64 lub storage_path.')
  if (!fileType)   return err(400, 'missing_type', 'file_type is required')
  if (!projectId)  return err(400, 'missing_project_id', 'project_id is required')

  // ── Resolve file data: storage path (large files) or inline base64 ──────
  let resolvedBase64 = fileBase64

  // ── Verify project access and resolve company_id ────────────────────────
  const sbUrl         = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const sbServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!sbServiceRole) {
    console.error('[analyze-project] SUPABASE_SERVICE_ROLE_KEY not set')
    return err(500, 'config_error', 'Server configuration error')
  }
  const sbService = createClient(sbUrl, sbServiceRole, { auth: { persistSession: false } })

  const { data: project, error: projErr } = await sbService
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projErr) {
    console.error('[analyze-project] Project lookup failed:', projErr.message)
    return err(500, 'access_check_failed', 'Could not verify project access')
  }
  if (!project || !(project as { company_id?: string }).company_id) {
    return err(403, 'project_access_denied', 'Project not found or access denied')
  }
  const companyId = (project as { company_id: string }).company_id

  // Confirm user is a member of this company
  const { data: member, error: memberErr } = await sbService
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberErr) {
    console.error('[analyze-project] Member lookup failed:', memberErr.message)
    return err(500, 'access_check_failed', 'Could not verify project access')
  }
  if (!member) {
    return err(403, 'project_access_denied', 'Project not found or access denied')
  }

  // ── Fetch large file from storage if storage_path was provided ─────────
  if (storagePath && !resolvedBase64) {
    console.info('STORAGE_FETCH_START', JSON.stringify({ storagePath, elapsed_ms: Date.now() - t0 }))
    try {
      const { data: blob, error: dlErr } = await sbService.storage
        .from('company-files')
        .download(storagePath)
      if (dlErr || !blob) {
        console.error('[analyze-project] Storage download failed:', dlErr?.message ?? 'no data')
        return err(502, 'storage_fetch_failed', 'Nie udało się pobrać pliku z storage. Spróbuj ponownie.')
      }
      const arrayBuf = await blob.arrayBuffer()
      const sizeBytes = arrayBuf.byteLength
      console.info('STORAGE_FETCH_OK', JSON.stringify({ sizeBytes, elapsed_ms: Date.now() - t0 }))
      if (sizeBytes > 20 * 1024 * 1024) {
        return err(413, 'file_too_large', `Plik jest za duży (${(sizeBytes / 1024 / 1024).toFixed(1)} MB, max 20 MB).`)
      }
      const bytes = new Uint8Array(arrayBuf)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
      }
      resolvedBase64 = btoa(binary)
    } catch (fetchErr) {
      console.error('[analyze-project] Storage fetch exception:', fetchErr)
      return err(502, 'storage_fetch_failed', 'Nie udało się pobrać pliku z storage.')
    }
  }

  // ── Plan check: AI Engine requires Pro or Business tier ───────────────────
  const { data: company, error: planErr } = await sbService
    .from('companies')
    .select('plan')
    .eq('id', companyId)
    .single()

  if (planErr || !company) {
    console.error('[analyze-project] Plan check failed:', planErr?.message)
    return err(500, 'plan_check_failed', 'Could not verify company plan')
  }
  if (!['pro', 'business', 'admin'].includes((company as { plan: string }).plan)) {
    return err(403, 'plan_insufficient', 'AI Engine requires a Pro or Business plan')
  }

  // ── Daily company limit ─────────────────────────────────────────────────
  const dailyLimit = parseInt(process.env.AI_DAILY_LIMIT ?? '50', 10)
  const { count: todayCount, error: countErr } = await sbService
    .from('ai_analysis_runs')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

  if (!countErr && typeof todayCount === 'number' && todayCount >= dailyLimit) {
    console.warn('[analyze-project] Daily limit exceeded', { companyId, todayCount, dailyLimit })
    return err(429, 'daily_limit_exceeded', `Dzienny limit analiz AI (${dailyLimit}) został wyczerpany. Spróbuj ponownie jutro.`)
  }

  // Size guard
  const base64Len = resolvedBase64.length
  console.info('PAYLOAD_SIZE', JSON.stringify({ base64Len, source: storagePath ? 'storage' : 'inline', approxBinaryKB: Math.round(base64Len * 0.75 / 1024), elapsed_ms: Date.now() - t0 }))
  if (base64Len > 28 * 1024 * 1024) {
    console.error('PAYLOAD_TOO_LARGE', JSON.stringify({ base64Len, elapsed_ms: Date.now() - t0 }))
    return err(413, 'file_too_large', `Plik za duży (${(base64Len * 0.75 / 1024 / 1024).toFixed(1)} MB, max 20 MB). Skompresuj PDF lub zmniejsz rozdzielczość.`)
  }

  // ── Build content array ────────────────────────────────────────────────

  const isPdf   = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
  const isImage = fileType.startsWith('image/')

  console.info('INPUT_DETECTED', JSON.stringify({ isPdf, isImage, fileType, elapsed_ms: Date.now() - t0 }))

  if (!isPdf && !isImage) {
    return err(400, 'unsupported_type', `Unsupported file type: ${fileType}. Use application/pdf or image/*.`)
  }

  type ContentItem =
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string }
    | { type: 'input_file'; filename: string; file_data: string }

  const content: ContentItem[] = []

  // Instruction text
  let instructionText = 'Zanalizuj ten materiał projektowy i wydobądź wszystkie dostępne dane projektowe.'
  if (context) {
    instructionText += `\n\nKontekst od użytkownika: ${context}`
  }
  if (isPdf) {
    instructionText += '\n\n[Typ wejścia: projekt architektoniczny PDF — analizuj jako dokument projektowy, nie jako fakturę]'
  } else {
    instructionText += '\n\n[Typ wejścia: wizualizacja / rysunek — analizuj jako materiał projektowy]'
  }
  content.push({ type: 'input_text', text: instructionText })

  // File content
  if (isPdf) {
    // OpenAI Responses API: send PDF as input_file
    content.push({
      type:      'input_file',
      filename:  fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      file_data: `data:application/pdf;base64,${resolvedBase64}`,
    })
  } else {
    // Image (visualization, render, drawing photo)
    const mimeType = fileType.startsWith('image/') ? fileType : 'image/jpeg'
    content.push({
      type:      'input_image',
      image_url: `data:${mimeType};base64,${resolvedBase64}`,
    })
  }

  // ── Call OpenAI ────────────────────────────────────────────────────────

  let aiRaw: string
  try {
    console.info('PROVIDER_REQUEST_START', JSON.stringify({ model, isPdf, contentItems: content.length, elapsed_ms: Date.now() - t0 }))
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: INSTRUCTIONS,
        input:        [{ role: 'user', content }],
        text:         { format: PROJECT_ANALYSIS_SCHEMA },
        max_output_tokens: 4_000,
      }),
    })

    const rawBody = await resp.text()

    if (!resp.ok) {
      console.error('PROVIDER_RESPONSE_ERROR', JSON.stringify({ status: resp.status, body: rawBody.slice(0, 400), elapsed_ms: Date.now() - t0 }))
      if (resp.status === 429) return err(429, 'openai_quota_exceeded', 'Quota OpenAI wyczerpana — sprawdź billing lub spróbuj za chwilę.')
      if (resp.status === 413) return err(413, 'file_too_large', 'Plik jest za duży dla modelu AI. Skompresuj PDF lub zmniejsz rozmiar.')
      if (resp.status === 400) return err(422, 'invalid_input', `OpenAI odrzucił dane wejściowe: ${rawBody.slice(0, 200)}`)
      return err(502, 'provider_error', `OpenAI ${resp.status}: ${rawBody.slice(0, 200)}`)
    }

    console.info('PROVIDER_RESPONSE_OK', JSON.stringify({ status: resp.status, rawLen: rawBody.length, elapsed_ms: Date.now() - t0 }))
    const data = JSON.parse(rawBody) as ResponsesAPIResult
    aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
    if (!aiRaw || aiRaw === '{}') {
      console.warn('PROVIDER_EMPTY_RESPONSE', JSON.stringify({ rawLen: rawBody.length, preview: rawBody.slice(0, 200), elapsed_ms: Date.now() - t0 }))
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('PROVIDER_REQUEST_FAILED', JSON.stringify({ error: msg, elapsed_ms: Date.now() - t0 }))
    return err(502, 'ai_call_failed', `Analiza AI niedostępna: ${msg.slice(0, 200)}`)
  }

  // ── Parse AI response ──────────────────────────────────────────────────

  let ai: Record<string, unknown>
  try {
    ai = JSON.parse(aiRaw) as Record<string, unknown>
    console.info('RESPONSE_PARSE_OK', JSON.stringify({ topKeys: Object.keys(ai).length, elapsed_ms: Date.now() - t0 }))
  } catch {
    console.error('RESPONSE_PARSE_ERROR', JSON.stringify({ preview: aiRaw.slice(0, 300), elapsed_ms: Date.now() - t0 }))
    return err(502, 'ai_invalid_json', 'Odpowiedź AI nie jest poprawnym JSON. Spróbuj ponownie.')
  }

  // ── Normalize ──────────────────────────────────────────────────────────

  function clampConf(v: unknown): number {
    return typeof v === 'number' ? Math.min(100, Math.max(0, v)) : 50
  }

  function strOrNull(v: unknown): string | null {
    return typeof v === 'string' && v.length > 0 ? v : null
  }

  function numOrNull(v: unknown): number | null {
    return typeof v === 'number' && isFinite(v) ? v : null
  }

  function toStrArray(v: unknown): string[] {
    return Array.isArray(v) ? (v as unknown[]).map(String).filter(s => s.length > 0) : []
  }

  const validProjectTypes = new Set(['architectural_drawing', 'design_visualization', 'technical_spec', 'mixed', 'unknown'])
  const validPriorities   = new Set(['required', 'likely', 'optional'])
  const validCategories   = new Set(['tiles', 'plumbing', 'electrical', 'paint', 'wood', 'glass', 'sanitary', 'insulation', 'other'])
  const validSources      = new Set(['project_derived', 'ai_suggestion'])

  // rooms_detected
  const rawRooms = Array.isArray(ai.rooms_detected) ? ai.rooms_detected : []
  const roomsDetected: ProjectRoom[] = (rawRooms as Record<string, unknown>[]).map(r => ({
    name:           String(r.name ?? 'pomieszczenie'),
    room_type:      String(r.room_type ?? 'other'),
    area_m2:        numOrNull(r.area_m2),
    height_m:       numOrNull(r.height_m),
    floor_finish:   strOrNull(r.floor_finish),
    wall_finish:    strOrNull(r.wall_finish),
    ceiling_finish: strOrNull(r.ceiling_finish),
    fixtures:       toStrArray(r.fixtures),
    installations:  toStrArray(r.installations),
    notes:          toStrArray(r.notes),
  }))

  // finish_materials
  const rawMaterials = Array.isArray(ai.finish_materials) ? ai.finish_materials : []
  const finishMaterials: ProjectMaterial[] = (rawMaterials as Record<string, unknown>[]).map(m => ({
    name:          String(m.name ?? ''),
    category:      validCategories.has(String(m.category)) ? String(m.category) : 'other',
    quantity:      numOrNull(m.quantity),
    unit:          strOrNull(m.unit),
    specification: strOrNull(m.specification),
    room:          strOrNull(m.room),
    notes:         strOrNull(m.notes),
  })).filter(m => m.name.length > 0)

  // work_scope_from_project
  const rawScope = Array.isArray(ai.work_scope_from_project) ? ai.work_scope_from_project : []
  const workScope: ProjectScopeItem[] = (rawScope as Record<string, unknown>[]).map(s => ({
    room:        strOrNull(s.room),
    description: String(s.description ?? ''),
    category:    String(s.category ?? 'other'),
    unit:        strOrNull(s.unit),
    quantity:    numOrNull(s.quantity),
    priority:    (validPriorities.has(String(s.priority)) ? String(s.priority) : 'likely') as ProjectScopeItem['priority'],
    confidence:  clampConf(s.confidence),
    notes:       strOrNull(s.notes),
  })).filter(s => s.description.length > 0)

  // suggested_estimate_items
  const rawEstimate = Array.isArray(ai.suggested_estimate_items) ? ai.suggested_estimate_items : []
  const estimateItems: ProjectEstimateItem[] = (rawEstimate as Record<string, unknown>[]).map(e => ({
    name:       String(e.name ?? ''),
    unit:       String(e.unit ?? 'szt.'),
    quantity:   typeof e.quantity === 'number' ? Math.max(0, e.quantity) : 0,
    unit_price: null,  // always null — AI does not suggest prices
    confidence: clampConf(e.confidence),
    source:     (validSources.has(String(e.source)) ? String(e.source) : 'ai_suggestion') as ProjectEstimateItem['source'],
    notes:      strOrNull(e.notes),
  })).filter(e => e.name.length > 0)

  const validProjectType = (validProjectTypes.has(String(ai.project_type)) ? String(ai.project_type) : 'unknown') as ProjectDocumentType

  const confidence = clampConf(ai.confidence)
  const warnings   = toStrArray(ai.warnings)

  // Add automatic warnings
  if (roomsDetected.length === 0) {
    warnings.push('Nie wykryto pomieszczeń — dokument może być nieprzeczytelny lub nie zawiera rzutu.')
  }
  if (workScope.length === 0 && estimateItems.length === 0) {
    warnings.push('Nie udało się wydobyć zakresu prac — sprawdź jakość dokumentu.')
  }

  const comparisonReady = typeof ai.comparison_ready === 'boolean'
    ? ai.comparison_ready
    : roomsDetected.some(r => r.area_m2 !== null || r.fixtures.length > 0 || r.installations.length > 0)

  const result: ProjectAnalysisResult = {
    project_type:             validProjectType,
    project_name:             strOrNull(ai.project_name),
    rooms_detected:           roomsDetected,
    total_area_m2:            numOrNull(ai.total_area_m2),
    building_type:            strOrNull(ai.building_type),
    finish_materials:         finishMaterials,
    equipment_detected:       toStrArray(ai.equipment_detected),
    work_scope_from_project:  workScope,
    suggested_estimate_items: estimateItems,
    assumptions:              toStrArray(ai.assumptions),
    missing_information:      toStrArray(ai.missing_information),
    project_notes:            toStrArray(ai.project_notes),
    confidence,
    warnings,
    comparison_ready:         comparisonReady,
  }

  // ── Bathroom Dependency Engine — post-processing ─────────────────────────
  const bathroomRooms = result.rooms_detected.filter(
    r => r.room_type === 'bathroom' || r.name.toLowerCase().includes('lazienk') || r.name.toLowerCase().includes('łazienk')
  )
  if (bathroomRooms.length > 0) {
    const allLabels = bathroomRooms.flatMap(r => [
      ...r.fixtures.map(f => f.toLowerCase()),
      ...r.installations.map(i => i.toLowerCase()),
    ])
    const triggerIds = detectBathroomTriggers(allLabels)
    if (triggerIds.length > 0) {
      // Dedup by normalised description (project items lack library_id)
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9ąćęłóśźż]/g, '')
      const existingDescs = new Set(
        result.work_scope_from_project.map(s => normalize(s.description))
      )
      const existingIds = new Set(
        result.work_scope_from_project.map(s => (s as { library_id?: string }).library_id ?? '').filter(Boolean)
      )
      const expanded = expandDependencies(triggerIds, existingIds)

      const bathroomRoomName = bathroomRooms[0]?.name ?? 'łazienka'

      for (const item of expanded.preceding) {
        if (!existingDescs.has(normalize(item.description))) {
          existingDescs.add(normalize(item.description))
          result.work_scope_from_project.push({
            room:        bathroomRoomName,
            description: item.description,
            category:    item.category,
            unit:        item.unit,
            quantity:    null,
            priority:    item.priority,
            confidence:  item.confidence,
            notes:       item.notes,
            provenance:  'dependency_inferred',
          })
        }
      }
      for (const item of expanded.hidden) {
        if (!existingDescs.has(normalize(item.description))) {
          existingDescs.add(normalize(item.description))
          result.work_scope_from_project.push({
            room:        bathroomRoomName,
            description: item.description,
            category:    item.category,
            unit:        item.unit,
            quantity:    null,
            priority:    item.priority,
            confidence:  item.confidence,
            notes:       item.notes,
            provenance:  'dependency_inferred',
          })
        }
      }
      for (const item of expanded.conditional) {
        if (!existingDescs.has(normalize(item.description))) {
          existingDescs.add(normalize(item.description))
          result.work_scope_from_project.push({
            room:        bathroomRoomName,
            description: item.description,
            category:    item.category,
            unit:        item.unit,
            quantity:    null,
            priority:    item.priority,
            confidence:  item.confidence,
            notes:       item.notes,
            provenance:  'confirmation_needed',
          })
        }
      }

      // Mirror into estimate items
      const existingEstimateDescs = new Set(
        result.suggested_estimate_items.map(e => normalize(e.name))
      )
      for (const item of [...expanded.preceding, ...expanded.hidden]) {
        if (!existingEstimateDescs.has(normalize(item.description))) {
          existingEstimateDescs.add(normalize(item.description))
          result.suggested_estimate_items.push({
            name:       item.description,
            unit:       item.unit,
            quantity:   0,
            unit_price: null,
            confidence: item.confidence,
            source:     'dependency_inferred',
            provenance: 'dependency_inferred',
            notes:      item.notes ?? null,
          })
        }
      }
      for (const item of expanded.conditional) {
        if (!existingEstimateDescs.has(normalize(item.description))) {
          existingEstimateDescs.add(normalize(item.description))
          result.suggested_estimate_items.push({
            name:       item.description,
            unit:       item.unit,
            quantity:   0,
            unit_price: null,
            confidence: item.confidence,
            source:     'confirmation_needed',
            provenance: 'confirmation_needed',
            notes:      item.notes ?? null,
          })
        }
      }

      // Surface confirmation questions (backward compat: text → missing_information)
      for (const q of expanded.questions) {
        if (!result.missing_information.includes(q.text)) {
          result.missing_information.push(q.text)
        }
      }
      // Structured questions channel
      if (!result.clarification_questions) result.clarification_questions = []
      const existingQIds = new Set(result.clarification_questions.map(cq => cq.id))
      for (const q of expanded.questions) {
        if (!existingQIds.has(q.id)) {
          existingQIds.add(q.id)
          result.clarification_questions.push(q)
        }
      }
    }
  }
  // ── End bathroom dependency injection ─────────────────────────────────────

  console.info('ANALYZE_PROJECT_DONE', JSON.stringify({
    endpoint:    'analyze-project',
    requestId,
    companyId:   companyId.slice(0, 8),
    projectId:   projectId?.slice(0, 8) ?? null,
    model,
    fileType,
    isPdf,
    projectType: result.project_type,
    rooms:       result.rooms_detected.length,
    materials:   result.finish_materials.length,
    scopeItems:  result.work_scope_from_project.length,
    estimateItems: result.suggested_estimate_items.length,
    confidence:  result.confidence,
    warnings:    result.warnings.length,
    total_ms:    Date.now() - t0,
  }))

  return ok(result)

  } catch (fatal: unknown) {
    const msg = fatal instanceof Error ? fatal.message : String(fatal)
    console.error('ANALYZE_PROJECT_FATAL', JSON.stringify({
      endpoint:    'analyze-project',
      requestId:   typeof requestId !== 'undefined' ? requestId : null,
      error:       msg.slice(0, 500),
      category:    'internal',
      elapsed_ms:  typeof t0 !== 'undefined' ? Date.now() - t0 : -1,
    }))
    captureAiError(fatal, {
      endpoint:   'analyze-project',
      requestId:  typeof requestId !== 'undefined' ? requestId : null,
      category:   'internal',
      userId:     typeof userId !== 'undefined' ? userId ?? undefined : undefined,
      companyId:  typeof companyId !== 'undefined' ? companyId : undefined,
      projectId:  typeof projectId !== 'undefined' ? projectId || undefined : undefined,
      elapsed_ms: typeof t0 !== 'undefined' ? Date.now() - t0 : undefined,
    })
    await flushSentry()
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: 'internal_error', message: 'Nieoczekiwany błąd serwera. Sprawdź logi Netlify.' }),
    }
  }
}
