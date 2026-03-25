// =============================================================================
// Multimodal Analysis Pipeline — Generalized result model
// =============================================================================
//
// This module defines the future-ready analysis result types for LoftDesk.
// Today: document extraction (invoices, receipts, bills, scans).
// Tomorrow: room photos, site photos, construction progress, material detection,
//           work scope proposals, estimate drafts.
//
// Design principles:
//   - The envelope (AnalysisResult) is always the same shape
//   - Sections are optional and extensible
//   - Existing expense/invoice code imports aliases that map 1:1
//   - New analysis types add new sections without breaking old consumers
// =============================================================================

// ── Analysis input classification ────────────────────────────────────────────

/** What kind of input was analyzed */
export type AnalysisInputType =
  | 'document_image'    // photo of an invoice, receipt, bill
  | 'document_pdf'      // digitally-generated PDF
  | 'scanned_pdf'       // scanned/image-based PDF
  | 'camera_capture'    // direct camera photo (could be document OR scene)
  | 'room_photo'        // photo of a room / interior / construction site
  | 'site_photo'        // broader site / exterior photo
  | 'text_input'        // manual or pasted text
  | 'unknown'

/** What the analysis determined the content to be */
export type AnalysisDocumentType =
  | 'invoice'           // faktura VAT
  | 'receipt'           // paragon / kasa fiskalna
  | 'bill'              // rachunek, proforma, zaliczka
  | 'room_scan'         // room / interior analysis (future)
  | 'site_scan'         // construction site analysis (future)
  | 'material_list'     // material specification (future)
  | 'work_scope'        // scope of work document (future)
  | 'other'             // unclassified

// ── Section: document fields (active — expense extraction) ───────────────────

export interface DocumentFields {
  vendor_name:      string | null
  vendor_nip:       string | null
  vendor_address?:  string | null
  buyer_name?:      string | null
  buyer_nip?:       string | null
  buyer_address?:   string | null
  document_number:  string | null  // was "invoice_number"
  issue_date:       string | null
  sale_date?:       string | null
  payment_due_date?: string | null
  net_amount:       number | null
  vat_amount:       number | null
  vat_rate?:        number | null
  gross_amount:     number | null
  currency:         string
  notes?:           string | null
}

/** A single line item from an itemized document */
export interface DocumentLineItem {
  name:         string | null
  quantity:     number | null
  unit:         string | null
  unit_net:     number | null
  vat_rate:     number | null
  net_amount:   number | null
  vat_amount:   number | null
  gross_amount: number | null
}

// ── Section: detected entities (future — room/site analysis) ─────────────────

export interface DetectedEntity {
  type:        string           // e.g. 'fixture', 'surface', 'appliance', 'damage'
  label:       string           // e.g. 'wanna', 'płytki podłogowe', 'pęknięcie ściany'
  confidence:  number           // 0–100
  location?:   string | null    // e.g. 'ściana lewa', 'podłoga', 'sufit'
  dimensions?: string | null    // e.g. '2.5m x 1.8m'
  notes?:      string | null
}

// ── Section: detected materials (future) ─────────────────────────────────────

export interface DetectedMaterial {
  name:        string           // e.g. 'płytki ceramiczne 60x60'
  category:    string           // e.g. 'okładziny', 'instalacja', 'farby'
  quantity?:   number | null
  unit?:       string | null    // e.g. 'm²', 'szt.', 'mb'
  confidence:  number           // 0–100
  notes?:      string | null
}

// ── Section: work scope items (future) ───────────────────────────────────────

export interface WorkScopeItem {
  description:  string          // e.g. 'demontaż starej glazury'
  category:     string          // e.g. 'demolition', 'tiling', 'plumbing'
  estimated_unit?: string | null
  estimated_qty?:  number | null
  confidence:   number          // 0–100
  notes?:       string | null
}

// ── Section: suggested estimate items (future) ───────────────────────────────

export interface SuggestedEstimateItem {
  name:         string
  unit:         string
  quantity:     number
  unit_price?:  number | null   // from market data or AI suggestion
  confidence:   number          // 0–100
  source:       'ai_suggestion' | 'market_data' | 'historical'
  notes?:       string | null
}

// ── Section confidence ───────────────────────────────────────────────────────

export interface SectionConfidence {
  document_fields?:    number    // 0–100
  line_items?:         number    // 0–100
  detected_entities?:  number    // 0–100
  detected_materials?: number    // 0–100
  work_scope?:         number    // 0–100
  estimate_items?:     number    // 0–100
}

// ── The envelope: AnalysisResult ─────────────────────────────────────────────

/**
 * Unified result of any multimodal analysis in LoftDesk.
 *
 * Active sections (populated today):
 *   - document_fields: invoice/receipt/bill data
 *   - line_items: itemized document positions
 *
 * Future sections (optional, not yet populated):
 *   - detected_entities: objects/surfaces/fixtures in a room photo
 *   - detected_materials: materials visible or inferred
 *   - work_scope: proposed scope of work
 *   - suggested_estimate_items: draft estimate positions
 *
 * Metadata is always present regardless of analysis type.
 */
export interface AnalysisResult {
  // ── classification ──
  input_type:     AnalysisInputType
  document_type:  AnalysisDocumentType | null

  // ── active sections ──
  document_fields?:  DocumentFields
  line_items?:       DocumentLineItem[]

  // ── future sections ──
  detected_entities?:       DetectedEntity[]
  detected_materials?:      DetectedMaterial[]
  work_scope?:              WorkScopeItem[]
  suggested_estimate_items?: SuggestedEstimateItem[]
  suggested_next_actions?:  string[]

  // ── per-section confidence ──
  section_confidence?:      SectionConfidence

  // ── global metadata (always present) ──
  extraction_confidence:      number   // 0–100, overall
  extraction_warnings:        string[]
  requires_user_confirmation: boolean
  parser_source:              'ai' | 'regex' | 'manual' | 'vision'

  // ── raw data (for debugging / future reprocessing) ──
  raw_text?:       string | null
  raw_response?:   unknown
}

// ── Backward-compatible aliases ──────────────────────────────────────────────
// These let existing expense code continue importing familiar names.

/** @deprecated Use DocumentLineItem */
export type ParseInvoiceLineItem = DocumentLineItem

/** @deprecated Use AnalysisResult — this alias maps the old flat shape */
export type ParseDocumentResult = AnalysisResult

// ── Mapper: AnalysisResult → flat ParseInvoiceResult shape ───────────────────
// Used by expense code that expects the flat interface from expenses.api.ts.
// This is the bridge: new pipeline produces AnalysisResult, old consumers read flat fields.

/**
 * Convert a flat ParseInvoiceResult (from Netlify functions) into an AnalysisResult envelope.
 * This is the ingestion boundary — all future code should work with AnalysisResult.
 */
export function toAnalysisResult(
  flat: {
    document_type?: string | null
    vendor_name?: string | null
    vendor_nip?: string | null
    vendor_address?: string | null
    buyer_name?: string | null
    buyer_nip?: string | null
    buyer_address?: string | null
    invoice_number?: string | null
    issue_date?: string | null
    sale_date?: string | null
    payment_due_date?: string | null
    net_amount?: number | null
    vat_amount?: number | null
    vat_rate?: number | null
    gross_amount?: number | null
    currency?: string
    notes?: string | null
    line_items?: DocumentLineItem[]
    extraction_confidence: number
    extraction_warnings: string[]
    requires_user_confirmation: boolean
    parser_source: 'ai' | 'regex' | 'manual' | 'vision'
  },
  inputType: AnalysisInputType = 'unknown',
): AnalysisResult {
  return {
    input_type: inputType,
    document_type: (flat.document_type as AnalysisDocumentType) ?? null,

    document_fields: {
      vendor_name:      flat.vendor_name ?? null,
      vendor_nip:       flat.vendor_nip ?? null,
      vendor_address:   flat.vendor_address ?? null,
      buyer_name:       flat.buyer_name ?? null,
      buyer_nip:        flat.buyer_nip ?? null,
      buyer_address:    flat.buyer_address ?? null,
      document_number:  flat.invoice_number ?? null,
      issue_date:       flat.issue_date ?? null,
      sale_date:        flat.sale_date ?? null,
      payment_due_date: flat.payment_due_date ?? null,
      net_amount:       flat.net_amount ?? null,
      vat_amount:       flat.vat_amount ?? null,
      vat_rate:         flat.vat_rate ?? null,
      gross_amount:     flat.gross_amount ?? null,
      currency:         flat.currency ?? 'PLN',
      notes:            flat.notes ?? null,
    },

    line_items: flat.line_items,

    extraction_confidence:      flat.extraction_confidence,
    extraction_warnings:        flat.extraction_warnings,
    requires_user_confirmation: flat.requires_user_confirmation,
    parser_source:              flat.parser_source,
  }
}

// ── Reverse mapper: AnalysisResult → flat fields for legacy consumers ────────

/**
 * Extract flat document fields from an AnalysisResult envelope.
 * Used by form components that pre-fill from the structured result.
 * Returns the same shape as ParseInvoiceResult so existing forms work unchanged.
 */
export function flattenAnalysisResult(ar: AnalysisResult): {
  document_type:  string | null
  vendor_name:    string | null
  vendor_nip:     string | null
  vendor_address: string | null
  buyer_name:     string | null
  buyer_nip:      string | null
  buyer_address:  string | null
  invoice_number: string | null
  issue_date:     string | null
  sale_date:      string | null
  payment_due_date: string | null
  net_amount:     number | null
  vat_amount:     number | null
  vat_rate:       number | null
  gross_amount:   number | null
  currency:       string
  notes:          string | null
  line_items:     DocumentLineItem[]
  extraction_confidence:      number
  extraction_warnings:        string[]
  requires_user_confirmation: boolean
  parser_source:              'ai' | 'regex' | 'manual' | 'vision'
} {
  const df = ar.document_fields
  return {
    document_type:   ar.document_type,
    vendor_name:     df?.vendor_name ?? null,
    vendor_nip:      df?.vendor_nip ?? null,
    vendor_address:  df?.vendor_address ?? null,
    buyer_name:      df?.buyer_name ?? null,
    buyer_nip:       df?.buyer_nip ?? null,
    buyer_address:   df?.buyer_address ?? null,
    invoice_number:  df?.document_number ?? null,
    issue_date:      df?.issue_date ?? null,
    sale_date:       df?.sale_date ?? null,
    payment_due_date: df?.payment_due_date ?? null,
    net_amount:      df?.net_amount ?? null,
    vat_amount:      df?.vat_amount ?? null,
    vat_rate:        df?.vat_rate ?? null,
    gross_amount:    df?.gross_amount ?? null,
    currency:        df?.currency ?? 'PLN',
    notes:           df?.notes ?? null,
    line_items:      ar.line_items ?? [],
    extraction_confidence:      ar.extraction_confidence,
    extraction_warnings:        ar.extraction_warnings,
    requires_user_confirmation: ar.requires_user_confirmation,
    parser_source:              ar.parser_source,
  }
}

// ── Input type classifier ────────────────────────────────────────────────────

/** Map file MIME / source type hint to AnalysisInputType */
export function classifyInputType(
  file: { type: string; name: string } | null,
  sourceHint?: 'camera' | 'gallery' | 'pdf' | 'manual' | string,
): AnalysisInputType {
  if (sourceHint === 'camera')  return 'camera_capture'
  if (sourceHint === 'room_photo') return 'room_photo'
  if (sourceHint === 'manual')  return 'text_input'
  if (!file) return 'unknown'

  const t = file.type.toLowerCase()
  const n = file.name.toLowerCase()

  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'document_pdf'
  if (t.startsWith('image/')) return sourceHint === 'gallery' ? 'document_image' : 'document_image'

  return 'unknown'
}

// ── Rehydration: JSONB → AnalysisResult ──────────────────────────────────────

/**
 * Safely rehydrate a `parse_raw` JSONB value from the database back into
 * a typed AnalysisResult, or null if the data is missing / invalid.
 * Used when reading stored expenses to recover the full analysis envelope.
 */
export function rehydrateAnalysisResult(
  raw: unknown,
): AnalysisResult | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  // Minimum viable check: must have extraction_confidence (always present on AnalysisResult)
  if (typeof obj.extraction_confidence !== 'number') return null

  return raw as AnalysisResult
}
