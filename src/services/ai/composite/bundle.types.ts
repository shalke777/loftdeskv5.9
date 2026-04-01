// =============================================================================
// src/services/ai/composite/bundle.types.ts
// =============================================================================
// Domain types for Composite Project Analysis — Bundle layer (P1 foundation).
// These types mirror the DB schema in 093–095 and provide the TypeScript
// vocabulary for bundle creation, asset registration, and extraction contracts.
//
// NOT exported from the P0 ai-review feature — these live in services/ai/composite
// and will be consumed by future composite engine and UI hooks.
// =============================================================================

// ── Asset source classification ───────────────────────────────────────────────

export type AssetSourceType =
  | 'pdf'
  | 'photo'
  | 'render'
  | 'text_note'
  | 'unknown'

export type AssetSourceRole =
  | 'architectural_drawing'   // rzut techniczny z wymiarami
  | 'design_visualization'    // wizualizacja 3D / render
  | 'technical_spec'          // specyfikacja / zestawienie materiałów
  | 'installation_drawing'    // schemat wod-kan / elek
  | 'site_photo'              // zdjęcie budowy
  | 'progress_photo'          // zdjęcie po zakończeniu etapu
  | 'text_note'               // opis tekstowy
  | 'unknown'

// source_priority constants (calibrated from R-12 hierarchy):
//   1–10  = primary technical source (rzut + 2 przekroje)
//   11–25 = strong secondary (wizualizacja HD, przekrój z wymiarami)
//   26–50 = supporting (rzut sufitu, opis)
//   51–75 = weak (single przekrój bez legendy)
//   76–99 = fallback / unclassified
export const SOURCE_PRIORITY = {
  DRAWING_WITH_TWO_SECTIONS:  5,
  DRAWING_WITH_ONE_SECTION:   15,
  DESIGN_VISUALIZATION_HD:    12,
  INSTALLATION_DRAWING:       20,
  CEILING_PLAN:               40,
  TEXT_NOTE:                  50,
  SITE_PHOTO:                 55,
  UNKNOWN:                    80,
} as const

// ── Bundle status ─────────────────────────────────────────────────────────────

export type BundleStatus = 'pending' | 'processing' | 'partial' | 'ready' | 'failed'

export type AssetExtractionStatus =
  | 'pending'
  | 'processing'
  | 'extracted'
  | 'failed'
  | 'skipped'

// ── Row shapes (mirror DB schema) ─────────────────────────────────────────────

export interface AiAnalysisBundle {
  id:                 string
  company_id:         string
  project_id:         string
  created_by:         string
  label:              string | null
  status:             BundleStatus
  asset_count:        number
  extracted_count:    number
  failed_count:       number
  confidence_summary: number | null
  missing_data:       boolean
  error_message:      string | null
  submitted_at:       string | null
  completed_at:       string | null
  created_at:         string
  updated_at:         string
}

export interface AiBundleAsset {
  id:                 string
  bundle_id:          string
  company_id:         string
  project_id:         string
  storage_path:       string
  original_filename:  string
  mime_type:          string
  file_size_bytes:    number | null
  source_type:        AssetSourceType
  source_role:        AssetSourceRole
  room_hint:          string | null
  source_priority:    number
  extraction_status:  AssetExtractionStatus
  processing_error:   string | null
  input_asset_id:     string | null
  created_at:         string
  updated_at:         string
}

// ── Input shapes (for service layer) ─────────────────────────────────────────

export interface CreateBundleInput {
  company_id:  string
  project_id:  string
  created_by:  string
  label?:      string
}

export interface RegisterAssetInput {
  bundle_id:          string
  company_id:         string
  project_id:         string
  storage_path:       string
  original_filename:  string
  mime_type:          string
  file_size_bytes?:   number
  source_type:        AssetSourceType
  source_role:        AssetSourceRole
  room_hint?:         string
  source_priority?:   number
  input_asset_id?:    string   // P0 bridge
}

export interface UpdateAssetStatusInput {
  asset_id:           string
  extraction_status:  AssetExtractionStatus
  processing_error?:  string
}
