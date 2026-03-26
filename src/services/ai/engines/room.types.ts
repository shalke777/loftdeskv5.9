// =============================================================================
// Room / Project Scope Engine — result types (v2)
// =============================================================================
// Represents the output of the room analysis engine.
// Used for: room photos, work progress photos, site photos, plan visualizations.
//
// Key design decisions:
//   - stage_of_work: explicit observable stage (not just "łazienka")
//   - scope split into required / likely / optional — maps directly to library priority
//   - observed_elements + detected_installations separate from detected_materials
//   - missing_information + assumptions: transparency about what AI couldn't determine
//   - quantity_hints: structured dimensional data (not embedded in context text)
//   - coverage: how well the library was applied
// =============================================================================

/** Observable stage of the space being analyzed */
export type StageOfWork =
  | 'before_renovation'    // stan przed — stara łazienka do remontu, widoczne zużycie
  | 'demolition'           // w trakcie wyburzeń / kucia, gołe ściany / podłogi
  | 'shell'                // stan surowy — brak wykończenia, widoczne konstrukcje
  | 'in_progress'          // w trakcie remontu — mix prac
  | 'finishing'            // na etapie wykończeniowym — montaż, malowanie
  | 'after_renovation'     // po remoncie — stan nowy / odebrany
  | 'unknown'

/** A detected physical element in the photo */
export interface DetectedElement {
  type:       'fixture' | 'surface' | 'installation' | 'damage' | 'appliance' | 'furniture' | 'other'
  label:      string            // Polish: 'wanna', 'płytki ścienne', 'pęknięcie ściany', 'grzejnik'
  confidence: number            // 0–100
  location?:  string | null     // 'ściana lewa', 'podłoga', 'narożnik'
  notes?:     string | null
}

/** A detected or inferred material in the space */
export interface DetectedMaterial {
  name:       string
  category:   string            // 'okładziny_ścian' | 'okładziny_podłóg' | 'instalacja_sanitarna' | etc.
  quantity?:  number | null
  unit?:      string | null     // 'm²' | 'mb' | 'szt.'
  confidence: number
  notes?:     string | null
}

/** A single scope item — linked to the task library when possible */
export interface ScopeItem {
  library_id?:   string | null  // id from bathroom-task-library.ts (e.g. 'waterproof_wet')
  description:   string         // Polish description of the work
  category:      string         // 'demolition' | 'substrate' | 'waterproofing' | 'tiling' | etc.
  unit?:         string | null  // 'm²' | 'mb' | 'szt.' | 'kpl.' | 'ryczałt'
  quantity?:     number | null  // estimated quantity, 0 if unknown
  priority:      'required' | 'likely' | 'optional'
  confidence:    number         // 0–100 — how sure we are this work is needed
  notes?:        string | null
  dependencies?: string[]       // library_ids this task depends on (must also appear in scope)
  /** Set by post-processing dependency engine — not by the AI model */
  provenance?:   'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

/** A dimensional quantity hint computed from user inputs or visual estimation */
export interface QuantityHint {
  dimension:  'floor_area' | 'wall_area' | 'ceiling_area' | 'perimeter' | 'wet_zone_area' | 'other'
  value:      number | null
  unit:       string            // 'm²' | 'm'
  source:     'measured' | 'estimated' | 'user_input' | 'ai_inferred' | 'unknown'
  confidence: number
}

/** An item ready to be placed in the estimate draft */
export interface SuggestedEstimateItem {
  library_id?: string | null    // links to bathroom-task-library id
  name:        string
  unit:        string
  quantity:    number
  unit_price?: number | null    // always null — AI does not suggest prices
  confidence:  number
  source:      'ai_suggestion' | 'market_data' | 'historical' | 'dependency_inferred' | 'confirmation_needed'
  notes?:      string | null
  /** Set by post-processing dependency engine — not by the AI model */
  provenance?:  'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

/**
 * Result produced by the Room / Project Scope Engine.
 *
 * Designed for construction renovation context (łazienka, kuchnia, etc.).
 * Uses bathroom-task-library.ts as the reference library for scope items.
 *
 * Core structure separates scope by priority level, matching library priorities:
 *   required_work_scope  ↔  library priority: 'required'
 *   likely_work_scope    ↔  library priority: 'likely'
 *   optional_work_scope  ↔  library priority: 'conditional' | 'optional'
 */
export interface RoomAnalysisResult {
  // Space classification
  space_type:    string | null        // 'łazienka' | 'kuchnia' | 'pokój' | etc. (Polish)
  stage_of_work: StageOfWork

  // What was observed in the photo(s)
  observed_elements:       DetectedElement[]     // fixtures, surfaces, visible damage, appliances
  detected_installations:  DetectedElement[]     // plumbing, electrical, HVAC elements
  detected_materials:      DetectedMaterial[]    // tiles, paint, pipes, etc.

  // Scope proposals — split by certainty level
  // Each array maps to a library priority:
  required_work_scope:  ScopeItem[]   // OBOWIĄZKOWE — must be done regardless
  likely_work_scope:    ScopeItem[]   // PRAWDOPODOBNE — contextually expected
  optional_work_scope:  ScopeItem[]   // OPCJONALNE / WARUNKOWE — only if confirmed

  // Transparency — what the AI couldn't determine or had to assume
  missing_information: string[]       // questions that couldn't be answered from photos
  assumptions:         string[]       // assumptions made during analysis (e.g. 'zakładam WC stojące')

  // Dimensional data for quantity calculations
  quantity_hints: QuantityHint[]

  // Final flat estimate items (for form pre-fill — union of all scopes after AI decision)
  suggested_estimate_items: SuggestedEstimateItem[]

  // How well the task library was applied
  coverage: {
    total:     number     // total library tasks for this space type
    matched:   number     // library tasks matched to estimate items
    unmatched: number     // library tasks not represented in estimate
  } | null

  // Metadata
  warnings:    string[]
  confidence:  number     // 0–100 overall
  notes?:      string | null
}
