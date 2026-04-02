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

// ── Document layer classification ─────────────────────────────────────────────
//
// Calibrated from: 6 real "projekt wykonawczy" bundles (ai-calibration-bundle-v1.md).
// Studio: "na miarę mieszkania", Katarzyna Kluza — 5 full projects + 1 viz-only pack.
//
// NOTE: The layer codes and drawing-number routing (O1→survey_existing,
// 3A→electrical_lighting, etc.) reflect THIS studio's numbering convention.
// Other studios may use different numbers — treat codes as vocabulary, not routing rules.
//
// confidence_cap: maximum confidence allowed when this layer is the ONLY source.
// null = no additional cap (layer is already gated by source_priority).
//
// TODO validate (batch 2): exact confidence_cap values need tuning against real
// composite fusion outcomes — treat current values as calibrated starting points.

export type DocumentLayerType =
  | 'title_page'
  | 'visualization_3d'
  | 'survey_existing'
  | 'functional_layout'
  | 'structural_guidelines'
  | 'electrical_legend'
  | 'electrical_lighting'
  | 'electrical_sockets'
  | 'plumbing_wod_kan'
  | 'floor_coverings'
  | 'wall_coverings'
  | 'wall_elevations'
  | 'tile_layout'
  | 'ceiling_plan'
  | 'furniture_drawing'
  | 'staircase_design'
  | 'glazing_door_detail'
  | 'construction_detail'
  | 'unknown'

export const DOCUMENT_LAYER_META: Record<Exclude<DocumentLayerType, 'unknown'>, {
  label:          string
  sourceRole:     AssetSourceRole
  sourcePriority: number        // lower = more authoritative
  confidenceCap:  number | null // null = no extra cap
  mustUse:        boolean       // required for composite analysis
}> = {
  title_page:             { label: 'Strona tytułowa',                  sourceRole: 'text_note',           sourcePriority: 50, confidenceCap: null, mustUse: false },
  visualization_3d:       { label: 'Wizualizacje 3D',                  sourceRole: 'design_visualization', sourcePriority: 20, confidenceCap: 0.55, mustUse: false },
  survey_existing:        { label: 'Stan zastany – inwentaryzacja',     sourceRole: 'architectural_drawing',sourcePriority: 5,  confidenceCap: 0.92, mustUse: false }, // mustUse=true for houses only — see BUNDLE_TYPES
  functional_layout:      { label: 'Układ funkcjonalny',               sourceRole: 'architectural_drawing',sourcePriority: 8,  confidenceCap: 0.90, mustUse: true  },
  structural_guidelines:  { label: 'Wytyczne budowlane – ściany',      sourceRole: 'architectural_drawing',sourcePriority: 6,  confidenceCap: 0.90, mustUse: false }, // mustUse for new builds
  electrical_legend:      { label: 'Legenda elektryczna',              sourceRole: 'technical_spec',       sourcePriority: 3,  confidenceCap: null, mustUse: false },
  electrical_lighting:    { label: 'Elektryka – oświetlenie',          sourceRole: 'installation_drawing', sourcePriority: 7,  confidenceCap: 0.92, mustUse: true  },
  electrical_sockets:     { label: 'Elektryka – gniazdka',             sourceRole: 'installation_drawing', sourcePriority: 7,  confidenceCap: 0.92, mustUse: true  },
  plumbing_wod_kan:       { label: 'Instalacje sanitarne wod-kan',     sourceRole: 'installation_drawing', sourcePriority: 7,  confidenceCap: 0.90, mustUse: true  },
  floor_coverings:        { label: 'Okładziny podłogowe',              sourceRole: 'technical_spec',       sourcePriority: 5,  confidenceCap: 0.95, mustUse: true  },
  wall_coverings:         { label: 'Okładziny ścienne / farby',        sourceRole: 'technical_spec',       sourcePriority: 8,  confidenceCap: 0.88, mustUse: false },
  wall_elevations:        { label: 'Wybrane widoki ścian',             sourceRole: 'installation_drawing', sourcePriority: 6,  confidenceCap: 0.93, mustUse: true  },
  tile_layout:            { label: 'Projekt glazury',                  sourceRole: 'technical_spec',       sourcePriority: 5,  confidenceCap: 0.95, mustUse: true  },
  ceiling_plan:           { label: 'Projekt sufitu podwieszanego',     sourceRole: 'architectural_drawing',sourcePriority: 8,  confidenceCap: 0.88, mustUse: false },
  furniture_drawing:      { label: 'Projekt mebla / zabudowy',         sourceRole: 'technical_spec',       sourcePriority: 4,  confidenceCap: 0.96, mustUse: true  },
  staircase_design:       { label: 'Koncepcja schodów',                sourceRole: 'technical_spec',       sourcePriority: 7,  confidenceCap: 0.88, mustUse: false },
  glazing_door_detail:    { label: 'Projekt przeszklenia / drzwi',     sourceRole: 'technical_spec',       sourcePriority: 6,  confidenceCap: 0.90, mustUse: false },
  construction_detail:    { label: 'Detal budowlany',                  sourceRole: 'technical_spec',       sourcePriority: 10, confidenceCap: 0.85, mustUse: false },
} as const

// ── Bundle document type ───────────────────────────────────────────────────────
//
// Calibrated from ai-calibration-bundle-v1.md — 2 confirmed types:
//   projekt_wykonawczy — full technical bundle (5/6 PDFs in calibration set)
//   visualization_pack — renders only, no drawings (Jankowicz 7-page PDF)
//
// CRITICAL GUARD (R-C-37): visualization_pack MUST NOT reach composite analysis.
// Early-exit with error 'insufficient_technical_layers' before any fusion step.

export type BundleDocumentType = 'projekt_wykonawczy' | 'visualization_pack' | 'unknown'

export const BUNDLE_DOCUMENT_TYPES: Record<Exclude<BundleDocumentType, 'unknown'>, {
  label:                string
  structurallyComplete: boolean
  confidenceCapGlobal:  number | null  // null = no global cap (per-layer caps apply)
  photoOnlyPenalty:     boolean
  // Layers expected in a complete bundle of this type
  expectedMustUseLayers: DocumentLayerType[]
  // Layers present only in houses (not apartments)
  houseOnlyLayers:       DocumentLayerType[]
}> = {
  projekt_wykonawczy: {
    label:                'Projekt wykonawczy',
    structurallyComplete: true,
    confidenceCapGlobal:  null,
    photoOnlyPenalty:     false,
    expectedMustUseLayers: [
      'functional_layout',
      'electrical_lighting',
      'electrical_sockets',
      'plumbing_wod_kan',
      'floor_coverings',
      'wall_elevations',
      'furniture_drawing',
    ],
    houseOnlyLayers: ['survey_existing', 'staircase_design'],
  },
  visualization_pack: {
    label:                'Pack wizualizacyjny',
    structurallyComplete: false,
    confidenceCapGlobal:  0.45,  // max confidence regardless of model output
    photoOnlyPenalty:     true,
    expectedMustUseLayers: [],
    houseOnlyLayers: [],
  },
} as const

// ── Structural missing-data signals per bundle type ───────────────────────────
//
// These are ALWAYS injected for a given bundle_document_type — they describe
// structural limitations of the document format, not extraction failures.
//
// Calibration finding (ai-calibration-bundle-v1.md, section 1):
//   ALL 6 projekt_wykonawczy PDFs lacked a consolidated material quantity table.
//   Quantities are scattered per drawing. This is a structural property of the format.
//
// scorePenalty: applied on top of per-item confidence penalties in confidence-model.ts.
// NOTE: floor_coverings quantities are stated WITHOUT production surplus (+10% standard).
//       Always annotate floor area evidence with notes: "bez zapasu produkcyjnego".

export interface StructuralMissingDataSignal {
  key:          string
  description:  string
  scorePenalty: number
  notes?:       string
}

export const STRUCTURAL_MISSING_DATA: Record<
  Exclude<BundleDocumentType, 'unknown'>,
  StructuralMissingDataSignal[]
> = {
  projekt_wykonawczy: [
    {
      key:          'material_quantity_summary',
      description:  'Projekt nie zawiera zbiorczego zestawienia materiałów z ilościami. Ilości rozproszone per rysunek.',
      scorePenalty: 0.10,
      notes:        'Ilości powierzchni podłóg/płytek podane bez zapasu produkcyjnego. Przy ekstrakcji: sumuj wartości z wielu rzutów (multi-kondygnacja), nie nadpisuj.',
    },
  ],
  visualization_pack: [],
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
  document_type:      BundleDocumentType | null
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
  layer_type:         DocumentLayerType | null
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
  company_id:     string
  project_id:     string
  created_by:     string
  label?:         string
  document_type?: BundleDocumentType
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
  source_role?:       AssetSourceRole   // optional — auto-derived from layer_type if omitted
  layer_type?:        DocumentLayerType
  room_hint?:         string
  source_priority?:   number
  input_asset_id?:    string   // P0 bridge
}

export interface UpdateAssetStatusInput {
  asset_id:           string
  extraction_status:  AssetExtractionStatus
  processing_error?:  string
}
