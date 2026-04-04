// =============================================================================
// Netlify Background Function: analyze-project-bg-background
// =============================================================================
// Processes large-file project analysis jobs asynchronously.
// Invoked fire-and-forget by analyze-project sync function.
// Runs up to 15 minutes (Netlify Background Function).
// Reads job from project_analysis_jobs, processes, writes result back.
// =============================================================================

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { detectBathroomTriggers, expandDependencies } from './shared/bathroom-triggers'
import { CATALOG_REFERENCE } from './shared/catalog-reference'

// ── Types (mirrors analyze-project.ts) ──────────────────────────────────────

interface ProjectRoom {
  name: string; room_type: string; area_m2: number | null; height_m: number | null
  floor_finish: string | null; wall_finish: string | null; ceiling_finish: string | null
  fixtures: string[]; installations: string[]; notes: string[]
}

interface ProjectMaterial {
  name: string; category: string; quantity: number | null; unit: string | null
  specification: string | null; room: string | null; notes: string | null
}

interface ProjectScopeItem {
  room: string | null; description: string; category: string; unit: string | null
  quantity: number | null; priority: 'required' | 'likely' | 'optional'
  confidence: number; notes: string | null; provenance?: string; library_id?: string
}

interface ProjectEstimateItem {
  name: string; unit: string; quantity: number; unit_price: number | null
  confidence: number; source: string; notes: string | null; provenance?: string
}

interface ClarificationQuestion { id: string; text: string; options?: string[]; context?: string }

interface ProjectAnalysisResult {
  project_type: string; project_name: string | null
  rooms_detected: ProjectRoom[]; total_area_m2: number | null
  building_type: string | null; finish_materials: ProjectMaterial[]
  equipment_detected: string[]; work_scope_from_project: ProjectScopeItem[]
  suggested_estimate_items: ProjectEstimateItem[]; assumptions: string[]
  missing_information: string[]; project_notes: string[]
  confidence: number; warnings: string[]; comparison_ready: boolean
  clarification_questions?: ClarificationQuestion[]
}

interface ResponsesAPIResult {
  output?: Array<{ content?: Array<{ type: string; text: string }> }>
}

// ── Schema & Instructions (same as analyze-project.ts) ──────────────────────

const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] }

const PROJECT_ANALYSIS_SCHEMA = {
  type: 'json_schema', name: 'project_analysis_v1', strict: true,
  schema: {
    type: 'object',
    properties: {
      project_type: { type: 'string', enum: ['architectural_drawing', 'design_visualization', 'technical_spec', 'mixed', 'unknown'] },
      project_name: ns,
      rooms_detected: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, room_type: { type: 'string' }, area_m2: nn, height_m: nn, floor_finish: ns, wall_finish: ns, ceiling_finish: ns, fixtures: { type: 'array', items: { type: 'string' } }, installations: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['name','room_type','area_m2','height_m','floor_finish','wall_finish','ceiling_finish','fixtures','installations','notes'], additionalProperties: false } },
      total_area_m2: nn, building_type: ns,
      finish_materials: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, category: { type: 'string' }, quantity: nn, unit: ns, specification: ns, room: ns, notes: ns }, required: ['name','category','quantity','unit','specification','room','notes'], additionalProperties: false } },
      equipment_detected: { type: 'array', items: { type: 'string' } },
      work_scope_from_project: { type: 'array', items: { type: 'object', properties: { room: ns, description: { type: 'string' }, category: { type: 'string' }, unit: ns, quantity: nn, priority: { type: 'string', enum: ['required','likely','optional'] }, confidence: { type: 'number' }, notes: ns }, required: ['room','description','category','unit','quantity','priority','confidence','notes'], additionalProperties: false } },
      suggested_estimate_items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, unit: { type: 'string' }, quantity: { type: 'number' }, unit_price: nn, confidence: { type: 'number' }, source: { type: 'string', enum: ['project_derived','ai_suggestion'] }, notes: ns }, required: ['name','unit','quantity','unit_price','confidence','source','notes'], additionalProperties: false } },
      assumptions: { type: 'array', items: { type: 'string' } },
      missing_information: { type: 'array', items: { type: 'string' } },
      project_notes: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' }, warnings: { type: 'array', items: { type: 'string' } },
      comparison_ready: { type: 'boolean' },
    },
    required: ['project_type','project_name','rooms_detected','total_area_m2','building_type','finish_materials','equipment_detected','work_scope_from_project','suggested_estimate_items','assumptions','missing_information','project_notes','confidence','warnings','comparison_ready'],
    additionalProperties: false,
  },
}

const INSTRUCTIONS = `Jesteś kosztorysantem budowlanym. Generujesz KOMPLETNY kosztorys robót z dokumentu projektowego.
NIE szukasz danych do faktury. NIE robisz OCR dokumentu finansowego.

KROK 1 — KLASYFIKACJA (building_type):
Ustal typ na podstawie dokumentu i kontekstu użytkownika:
- "wykończenie ze stanu deweloperskiego" — nowe budownictwo, brak starych elementów → BEZ demontaży
- "remont ze stanu wtórnego" — po użytkowaniu → WYMAGANE demontaże + wywóz gruzu
- "remont częściowy" — modernizacja wybranych elementów → demontaże tylko w zakresie
Domyślnie: "remont ze stanu wtórnego". Uzasadnij w assumptions[].

KROK 2 — POMIESZCZENIA (rooms_detected):
Każde pomieszczenie osobno: nazwa, room_type, area_m2 (oszacuj jeśli brak), height_m (domyślnie 2.6), wykończenia, fixtures, installations.

KROK 3 — MATERIAŁY (finish_materials):
Każdy materiał osobno z category, quantity, unit, specification. Nie "płytki" — "gres mat 60×60 R10".

KROK 4 — ZAKRES PRAC (work_scope_from_project):
Każda praca osobno z room, category, unit, quantity, priority, confidence.
ZAWSZE podaj unit i quantity — oszacuj jeśli brak wymiarów (confidence < 70).

KROK 5 — KOSZTORYS (suggested_estimate_items):
Każda czynność = OSOBNA POZYCJA z name, unit, quantity, source. unit_price = null.

COVERAGE GATES — TWARDE WYMAGANIA:

GATE WOD-KAN: Jeśli w rooms_detected jest łazienka LUB kuchnia, MUSISZ dodać OSOBNE pozycje:
→ podejście wody zimnej (szt) — po 1 na każdy odbiornik (WC, umywalka, wanna, prysznic, pralka, zmywarka)
→ podejście wody ciepłej (szt) — umywalka, wanna, prysznic
→ podejście kanalizacyjne (szt) — po 1 na każdy odbiornik
→ montaż baterii (szt) — umywalkowa, prysznicowa, wannowa, zlewozmywakowa
→ podłączenie hydrauliczne (szt) — WC, wanna, prysznic, pralka
Łazienka z WC+umywalka+prysznic = min. 3 zimna + 2 ciepła + 3 kanalizacja + 3 baterie/podłączenia.

GATE ELEKTRYKA: Dla KAŻDEGO pomieszczenia MUSISZ dodać OSOBNE pozycje:
→ punkt oświetleniowy (szt) — sufit, lustro, kinkiet
→ gniazdo elektryczne (szt)
→ wyłącznik oświetlenia (szt)
→ łazienka: + wypust pod wentylator (szt)
→ kuchnia: + podłączenia AGD (szt), instalacja 400V jeśli kuchenka elektryczna
Min. per pomieszczenie: 2 oświetlenie + 1 gniazdo + 1 wyłącznik.

GATE DEMONTAŻE: Jeśli building_type = "remont ze stanu wtórnego":
→ MUSISZ dodać: demontaż starych płytek/podłóg (m2), demontaż starej armatury (kpl), wywóz gruzu (m3/kpl).
Jeśli building_type = "wykończenie ze stanu deweloperskiego":
→ NIE DODAWAJ demontaży starych elementów.

GATE WYKOŃCZENIE: Dla każdego pomieszczenia sprawdź:
→ przygotowanie podłoża (gruntowanie, wylewka, tynki)
→ hydroizolacja (łazienka — ZAWSZE)
→ płytki ścienne + podłogowe OSOBNO (m2) + fugowanie (m2)
→ malowanie ścian + sufitów (m2)
→ podłogi (m2)
→ stolarka: drzwi (szt), listwy (mb)
→ silikonowanie (mb)

MINIMA ADAPTACYJNE — sprawdź przed finalizacją:
- 1 pomieszczenie (pokój/korytarz): min. 10 pozycji
- łazienka lub kuchnia: min. 20 pozycji
- mieszkanie 2+ pomieszczeń: min. 35 pozycji
- mieszkanie 4+ pomieszczeń: min. 50 pozycji
Jeśli masz MNIEJ — sprawdź brakujące gate'y i uzupełnij.

SELF-CHECK PRZED ZWRÓCENIEM JSON:
1. Czy każda łazienka/kuchnia ma pozycje wod-kan per punkt? Jeśli NIE → uzupełnij.
2. Czy każde pomieszczenie ma pozycje elektryczne? Jeśli NIE → uzupełnij.
3. Czy building_type wtórny ma demontaże? Jeśli NIE → uzupełnij.
4. Czy building_type deweloperski NIE ma pełnych demontaży? Jeśli MA → usuń.
5. Czy suggested_estimate_items.length >= minimum adaptacyjne? Jeśli NIE → uzupełnij brakujące kategorie.
6. Czy quantity i unit są wypełnione wszędzie? Jeśli NIE → oszacuj.

TRANSPARENTNOŚĆ: Wypełnij assumptions[], missing_information[], project_notes[], warnings[].
CONFIDENCE: 90–100 kompletny, 70–89 dobry, 50–69 częściowy, 30–49 niekompletny, 0–29 nieczytelny.
comparison_ready: true jeśli ≥1 pomieszczenie z area_m2 lub fixtures.

Zwróć TYLKO poprawny JSON zgodny ze schematem. Żadnego tekstu poza JSON.

${CATALOG_REFERENCE}`

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Main handler ────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const t0 = Date.now()

  // Background functions return 202 immediately — this code runs asynchronously.
  // Parse body
  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    console.error('[bg] Invalid JSON body')
    return { statusCode: 400, body: 'invalid json' }
  }

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''

  if (!jobId) {
    console.error('[bg] Missing job_id')
    return { statusCode: 400, body: 'missing job_id' }
  }

  // Init Supabase service client
  const sbUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!sbKey) {
    console.error('[bg] No service role key')
    return { statusCode: 500, body: 'config error' }
  }
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } })

  // Load job
  const { data: job, error: jobErr } = await sb
    .from('project_analysis_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    console.error('[bg] Job not found:', jobId, jobErr?.message)
    return { statusCode: 404, body: 'job not found' }
  }

  if (job.status !== 'queued') {
    console.warn('[bg] Job not queued, skipping:', job.status)
    return { statusCode: 200, body: 'already processed' }
  }

  // Mark processing
  await sb.from('project_analysis_jobs').update({
    status: 'processing',
    started_at: new Date().toISOString(),
  }).eq('id', jobId)

  console.info('[bg] PROCESSING_START', JSON.stringify({ jobId, storagePath: job.storage_path, elapsed_ms: Date.now() - t0 }))

  try {
    // ── Download file from storage ────────────────────────────────────────
    const { data: blob, error: dlErr } = await sb.storage
      .from('company-files')
      .download(job.storage_path)

    if (dlErr || !blob) {
      throw new Error(`Storage download failed: ${dlErr?.message ?? 'no data'}`)
    }

    const arrayBuf = await blob.arrayBuffer()
    const sizeBytes = arrayBuf.byteLength
    console.info('[bg] FILE_DOWNLOADED', JSON.stringify({ sizeBytes, elapsed_ms: Date.now() - t0 }))

    if (sizeBytes > 20 * 1024 * 1024) {
      await failJob(sb, jobId, 'file_too_large', `Plik za duży (${(sizeBytes / 1024 / 1024).toFixed(1)} MB, max 20 MB)`)
      return { statusCode: 200, body: 'file too large' }
    }

    // Convert to base64
    const bytes = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    const fileBase64 = btoa(binary)

    console.info('[bg] BASE64_READY', JSON.stringify({ base64Len: fileBase64.length, elapsed_ms: Date.now() - t0 }))

    // Cleanup temp file (fire-and-forget)
    sb.storage.from('company-files').remove([job.storage_path]).catch(() => {})

    // ── Build OpenAI content ──────────────────────────────────────────────
    const fileType = job.file_type || 'application/pdf'
    const fileName = job.file_name || 'project'
    const context  = job.context || ''
    const isPdf    = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
    const isImage  = fileType.startsWith('image/')

    const content: Record<string, unknown>[] = []

    let instructionText = INSTRUCTIONS
    if (context) instructionText += `\n\nKONTEKST OD UŻYTKOWNIKA: ${context}`
    if (isPdf) instructionText += '\n\n[Typ wejścia: projekt architektoniczny PDF — analizuj jako dokument projektowy, nie jako fakturę]'
    else instructionText += '\n\n[Typ wejścia: wizualizacja / rysunek — analizuj jako materiał projektowy]'
    content.push({ type: 'input_text', text: instructionText })

    if (isPdf) {
      content.push({
        type: 'input_file',
        filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
        file_data: `data:application/pdf;base64,${fileBase64}`,
      })
    } else if (isImage) {
      const mimeType = fileType.startsWith('image/') ? fileType : 'image/jpeg'
      content.push({
        type: 'input_image',
        image_url: `data:${mimeType};base64,${fileBase64}`,
      })
    } else {
      await failJob(sb, jobId, 'unsupported_type', `Unsupported file type: ${fileType}`)
      return { statusCode: 200, body: 'unsupported type' }
    }

    // ── Call OpenAI ───────────────────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY ?? ''
    const model = process.env.OPENAI_MODEL_VISION?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o'

    console.info('[bg] OPENAI_START', JSON.stringify({ model, isPdf, elapsed_ms: Date.now() - t0 }))

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: INSTRUCTIONS,
        input: [{ role: 'user', content }],
        text: { format: PROJECT_ANALYSIS_SCHEMA },
        max_output_tokens: 8_000,
      }),
    })

    const rawBody = await resp.text()

    if (!resp.ok) {
      console.error('[bg] OPENAI_ERROR', JSON.stringify({ status: resp.status, body: rawBody.slice(0, 300) }))
      if (resp.status === 429) {
        await failJob(sb, jobId, 'openai_quota', 'Quota OpenAI wyczerpana.')
      } else {
        await failJob(sb, jobId, 'provider_error', `OpenAI ${resp.status}: ${rawBody.slice(0, 200)}`)
      }
      return { statusCode: 200, body: 'openai error' }
    }

    console.info('[bg] OPENAI_OK', JSON.stringify({ rawLen: rawBody.length, elapsed_ms: Date.now() - t0 }))

    const data = JSON.parse(rawBody) as ResponsesAPIResult
    const aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'

    // ── Parse & normalize ─────────────────────────────────────────────────
    const ai = JSON.parse(aiRaw) as Record<string, unknown>

    const validProjectTypes = new Set(['architectural_drawing', 'design_visualization', 'technical_spec', 'mixed', 'unknown'])
    const validPriorities   = new Set(['required', 'likely', 'optional'])
    const validCategories   = new Set(['tiles', 'plumbing', 'electrical', 'paint', 'wood', 'glass', 'sanitary', 'insulation', 'other'])
    const validSources      = new Set(['project_derived', 'ai_suggestion'])

    const rawRooms = Array.isArray(ai.rooms_detected) ? ai.rooms_detected : []
    const roomsDetected: ProjectRoom[] = (rawRooms as Record<string, unknown>[]).map(r => ({
      name: String(r.name ?? 'pomieszczenie'), room_type: String(r.room_type ?? 'other'),
      area_m2: numOrNull(r.area_m2), height_m: numOrNull(r.height_m),
      floor_finish: strOrNull(r.floor_finish), wall_finish: strOrNull(r.wall_finish), ceiling_finish: strOrNull(r.ceiling_finish),
      fixtures: toStrArray(r.fixtures), installations: toStrArray(r.installations), notes: toStrArray(r.notes),
    }))

    const rawMaterials = Array.isArray(ai.finish_materials) ? ai.finish_materials : []
    const finishMaterials: ProjectMaterial[] = (rawMaterials as Record<string, unknown>[]).map(m => ({
      name: String(m.name ?? ''), category: validCategories.has(String(m.category)) ? String(m.category) : 'other',
      quantity: numOrNull(m.quantity), unit: strOrNull(m.unit),
      specification: strOrNull(m.specification), room: strOrNull(m.room), notes: strOrNull(m.notes),
    })).filter(m => m.name.length > 0)

    const rawScope = Array.isArray(ai.work_scope_from_project) ? ai.work_scope_from_project : []
    const workScope: ProjectScopeItem[] = (rawScope as Record<string, unknown>[]).map(s => ({
      room: strOrNull(s.room), description: String(s.description ?? ''), category: String(s.category ?? 'other'),
      unit: strOrNull(s.unit), quantity: numOrNull(s.quantity),
      priority: (validPriorities.has(String(s.priority)) ? String(s.priority) : 'likely') as ProjectScopeItem['priority'],
      confidence: clampConf(s.confidence), notes: strOrNull(s.notes),
    })).filter(s => s.description.length > 0)

    const rawEstimate = Array.isArray(ai.suggested_estimate_items) ? ai.suggested_estimate_items : []
    const estimateItems: ProjectEstimateItem[] = (rawEstimate as Record<string, unknown>[]).map(e => ({
      name: String(e.name ?? ''), unit: String(e.unit ?? 'szt.'),
      quantity: typeof e.quantity === 'number' ? Math.max(0, e.quantity) : 0,
      unit_price: null, confidence: clampConf(e.confidence),
      source: (validSources.has(String(e.source)) ? String(e.source) : 'ai_suggestion') as string,
      notes: strOrNull(e.notes),
    })).filter(e => e.name.length > 0)

    const confidence = clampConf(ai.confidence)
    const warnings = toStrArray(ai.warnings)

    if (roomsDetected.length === 0) warnings.push('Nie wykryto pomieszczeń — dokument może być nieprzeczytelny lub nie zawiera rzutu.')
    if (workScope.length === 0 && estimateItems.length === 0) warnings.push('Nie udało się wydobyć zakresu prac — sprawdź jakość dokumentu.')

    const comparisonReady = typeof ai.comparison_ready === 'boolean'
      ? ai.comparison_ready
      : roomsDetected.some(r => r.area_m2 !== null || r.fixtures.length > 0 || r.installations.length > 0)

    const result: ProjectAnalysisResult = {
      project_type: (validProjectTypes.has(String(ai.project_type)) ? String(ai.project_type) : 'unknown'),
      project_name: strOrNull(ai.project_name), rooms_detected: roomsDetected,
      total_area_m2: numOrNull(ai.total_area_m2), building_type: strOrNull(ai.building_type),
      finish_materials: finishMaterials, equipment_detected: toStrArray(ai.equipment_detected),
      work_scope_from_project: workScope, suggested_estimate_items: estimateItems,
      assumptions: toStrArray(ai.assumptions), missing_information: toStrArray(ai.missing_information),
      project_notes: toStrArray(ai.project_notes), confidence, warnings, comparison_ready: comparisonReady,
    }

    // ── Bathroom dependency engine ────────────────────────────────────────
    const bathroomRooms = result.rooms_detected.filter(
      r => r.room_type === 'bathroom' || r.name.toLowerCase().includes('lazienk') || r.name.toLowerCase().includes('łazienk')
    )
    if (bathroomRooms.length > 0) {
      const allLabels = bathroomRooms.flatMap(r => [...r.fixtures.map(f => f.toLowerCase()), ...r.installations.map(i => i.toLowerCase())])
      const triggerIds = detectBathroomTriggers(allLabels)
      if (triggerIds.length > 0) {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9ąćęłóśźż]/g, '')
        const existingDescs = new Set(result.work_scope_from_project.map(s => normalize(s.description)))
        const existingIds = new Set(result.work_scope_from_project.map(s => (s as { library_id?: string }).library_id ?? '').filter(Boolean))
        const expanded = expandDependencies(triggerIds, existingIds)
        const bathroomRoomName = bathroomRooms[0]?.name ?? 'łazienka'

        for (const item of [...expanded.preceding, ...expanded.hidden, ...expanded.conditional]) {
          if (!existingDescs.has(normalize(item.description))) {
            existingDescs.add(normalize(item.description))
            result.work_scope_from_project.push({
              room: bathroomRoomName, description: item.description, category: item.category,
              unit: item.unit, quantity: null, priority: item.priority, confidence: item.confidence,
              notes: item.notes,
              provenance: expanded.conditional.includes(item) ? 'confirmation_needed' : 'dependency_inferred',
            })
          }
        }

        const existingEstimateDescs = new Set(result.suggested_estimate_items.map(e => normalize(e.name)))
        for (const item of [...expanded.preceding, ...expanded.hidden, ...expanded.conditional]) {
          if (!existingEstimateDescs.has(normalize(item.description))) {
            existingEstimateDescs.add(normalize(item.description))
            result.suggested_estimate_items.push({
              name: item.description, unit: item.unit, quantity: 0, unit_price: null,
              confidence: item.confidence,
              source: expanded.conditional.includes(item) ? 'confirmation_needed' : 'dependency_inferred',
              notes: item.notes ?? null, provenance: expanded.conditional.includes(item) ? 'confirmation_needed' : 'dependency_inferred',
            })
          }
        }

        for (const q of expanded.questions) {
          if (!result.missing_information.includes(q.text)) result.missing_information.push(q.text)
        }
        if (!result.clarification_questions) result.clarification_questions = []
        const existingQIds = new Set(result.clarification_questions.map(cq => cq.id))
        for (const q of expanded.questions) {
          if (!existingQIds.has(q.id)) { existingQIds.add(q.id); result.clarification_questions.push(q) }
        }
      }
    }

    // ── Save result ───────────────────────────────────────────────────────
    await sb.from('project_analysis_jobs').update({
      status: 'done',
      result_json: result,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)

    console.info('[bg] JOB_DONE', JSON.stringify({
      jobId, confidence: result.confidence,
      rooms: result.rooms_detected.length,
      total_ms: Date.now() - t0,
    }))

    return { statusCode: 200, body: 'ok' }

  } catch (fatal) {
    const msg = fatal instanceof Error ? fatal.message : String(fatal)
    console.error('[bg] FATAL', JSON.stringify({ jobId, error: msg.slice(0, 500), elapsed_ms: Date.now() - t0 }))
    await failJob(sb, jobId, 'internal_error', msg.slice(0, 500))
    // Cleanup storage file on failure
    if (job.storage_path) {
      sb.storage.from('company-files').remove([job.storage_path]).catch(() => {})
    }
    return { statusCode: 200, body: 'fatal error' }
  }
}

// ── Helper: mark job as failed ──────────────────────────────────────────────

async function failJob(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  errorCode: string,
  errorMessage: string,
) {
  await sb.from('project_analysis_jobs').update({
    status: 'failed',
    error_code: errorCode,
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId)
}
