// =============================================================================
// Input Classifier — determines what kind of input to route to which engine
// =============================================================================
// This is the FIRST step in the AI pipeline. Before calling any analysis
// engine, classify the input so the correct prompt, schema, and model are used.
//
// Two engines downstream:
//   document engine — invoices, receipts, formal docs, cost notes
//   room engine     — room photos, work progress, plan visualizations
// =============================================================================

/** Fine-grained input type for engine routing */
export type InputType =
  // ── Document engine ──
  | 'invoice'              // faktura VAT (z NIP, kwotami netto/brutto)
  | 'receipt'              // paragon / kasa fiskalna
  | 'formal_document'      // umowa, protokół, zlecenie, pismo urzędowe
  | 'cost_note'            // nota kosztowa, kosztorys, zestawienie materiałów
  // ── Room engine ──
  | 'room_photo'           // zdjęcie pomieszczenia / wnętrza do remontu
  | 'work_progress_photo'  // zdjęcie postępu prac na budowie
  // ── Project / Design engine ──
  | 'project_pdf'          // projekt architektoniczny w PDF (rzut, opis techniczny)
  | 'technical_drawing'    // rysunek techniczny, schemat instalacji, CAD
  | 'design_visualization' // wizualizacja 3D, render, projekt aranżacji wnętrza
  // ── Legacy / catch-all ──
  | 'plan_visualization'   // @deprecated — use project_pdf or design_visualization
  | 'unknown'

export interface InputClassification {
  type: InputType
  confidence: number         // 0–100
  hint?: string              // reason or clue used to classify
  suggestedEngine: 'document' | 'room' | 'project' | 'none'
}

// Mapping: InputType → engine
const ENGINE_MAP: Record<InputType, InputClassification['suggestedEngine']> = {
  invoice:              'document',
  receipt:              'document',
  formal_document:      'document',
  cost_note:            'document',
  room_photo:           'room',
  work_progress_photo:  'room',
  project_pdf:          'project',
  technical_drawing:    'project',
  design_visualization: 'project',
  plan_visualization:   'project',   // legacy type now routes to project engine
  unknown:              'none',
}

function makeResult(
  type: InputType,
  confidence: number,
  hint?: string,
): InputClassification {
  return { type, confidence, hint, suggestedEngine: ENGINE_MAP[type] }
}

/**
 * Classify an input file + optional source hint into an InputClassification.
 *
 * Priority order:
 *   1. Explicit source hints (highest confidence)
 *   2. MIME type
 *   3. File extension fallback
 *   4. Unknown (lowest confidence)
 *
 * New source hints:
 *   project_upload  → project_pdf (PDF) or design_visualization (image)
 *   design_upload   → design_visualization (image)
 *   drawing_upload  → technical_drawing
 *
 * For ambiguous inputs (camera, gallery) the confidence is intentionally low,
 * signalling to the caller that an AI-assisted secondary classification may help.
 */
export function classifyInput(
  file: { type: string; name: string } | null,
  sourceHint?: 'camera' | 'gallery' | 'scanner' | 'room_capture' | 'pdf_upload' | 'project_upload' | 'design_upload' | 'drawing_upload' | 'manual' | string,
): InputClassification {
  // ── Explicit high-confidence hints ──────────────────────────────────────
  if (sourceHint === 'room_capture')
    return makeResult('room_photo', 92, 'explicit room_capture source hint')
  if (sourceHint === 'scanner')
    return makeResult('invoice', 80, 'scanner source — likely a document photo')
  if (sourceHint === 'manual')
    return makeResult('cost_note', 55, 'manual text input')
  if (sourceHint === 'drawing_upload')
    return makeResult('technical_drawing', 88, 'explicit drawing_upload hint')
  if (sourceHint === 'design_upload')
    return makeResult('design_visualization', 88, 'explicit design_upload hint')

  // project_upload: distinguish PDF from image for project engine
  if (sourceHint === 'project_upload') {
    if (!file) return makeResult('project_pdf', 75, 'project_upload hint without file info')
    const mime = file.type.toLowerCase()
    const name = file.name.toLowerCase()
    if (mime === 'application/pdf' || name.endsWith('.pdf'))
      return makeResult('project_pdf', 92, 'project_upload + PDF — architectural drawing')
    if (mime.startsWith('image/'))
      return makeResult('design_visualization', 88, 'project_upload + image — design visualization')
    return makeResult('project_pdf', 70, 'project_upload hint, unknown format')
  }

  // Legacy pdf_upload hint — document invoice flow (unchanged for backward compat)
  if (sourceHint === 'pdf_upload')
    return makeResult('invoice', 70, 'explicit PDF upload hint')

  if (!file) return makeResult('unknown', 0)

  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()

  // PDF without a source hint → document (backward compat — invoice flow)
  // Note: project PDFs should always be uploaded with project_upload source hint
  if (mime === 'application/pdf' || name.endsWith('.pdf'))
    return makeResult('invoice', 68, 'PDF file — assumed cost document (use project_upload for project PDFs)')

  if (mime.startsWith('image/')) {
    // Gallery without explicit room hint — ambiguous
    if (sourceHint === 'gallery')
      return makeResult('unknown', 38, 'gallery image without type hint — could be room or document')
    // Camera without explicit hint — ambiguous
    if (sourceHint === 'camera')
      return makeResult('unknown', 32, 'camera capture without classification hint')
    // Image with no hint — lean toward document (primary expense flow)
    return makeResult('invoice', 45, 'image file, no source hint, defaulting to document')
  }

  // Text files → manual cost notes / documents
  if (mime === 'text/plain' || name.endsWith('.txt') || name.endsWith('.csv'))
    return makeResult('cost_note', 55, 'text file — treated as cost note / manual input')

  return makeResult('unknown', 0, 'unrecognized MIME type')
}

/** Map new InputType back to the legacy AnalysisInputType string (backward compat) */
export function inputTypeToLegacy(t: InputType): string {
  switch (t) {
    case 'invoice':              return 'document_image'
    case 'receipt':              return 'document_image'
    case 'formal_document':      return 'document_image'
    case 'cost_note':            return 'document_image'
    case 'room_photo':           return 'room_photo'
    case 'work_progress_photo':  return 'site_photo'
    case 'project_pdf':          return 'plan_visualization'
    case 'technical_drawing':    return 'plan_visualization'
    case 'design_visualization': return 'plan_visualization'
    case 'plan_visualization':   return 'plan_visualization'
    case 'unknown':              return 'unknown'
  }
}
