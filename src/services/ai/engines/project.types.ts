// =============================================================================
// Project / Design Intelligence Engine — result types (v1)
// =============================================================================
// Represents the output of the project/design analysis engine.
// Used for: architectural drawings (rzuty), design visualizations (wizualizacje),
//           technical specifications, project PDFs.
//
// Key design decisions:
//   - rooms_detected[]: each room is its own structured object with dimensions + finishes
//   - work_scope_from_project: derived from project content (not visual observation)
//   - comparison_ready: can this result be paired with a RoomAnalysisResult for diff?
//   - assumptions + missing_information: always explicit — no silent guessing
//
// Engine routing:
//   project_pdf         → this engine
//   technical_drawing   → this engine
//   design_visualization → this engine
//
// Downstream:
//   rooms_detected    → RoomType selector pre-fill
//   work_scope_from_project  → SuggestedEstimateSection
//   comparison_ready  → compare() utility in comparison.ts
// =============================================================================

import type { ClarificationQuestion } from './clarification.types'

/** Type of project document uploaded */
export type ProjectDocumentType =
  | 'architectural_drawing'    // rzut techniczny z wymiarami
  | 'design_visualization'     // wizualizacja 3D / render / projekt wnętrza
  | 'technical_spec'           // specyfikacja techniczna / zestawienie materiałów
  | 'mixed'                    // dokument zawiera kilka typów (np. rzut + legenda)
  | 'unknown'

/** A single room or space extracted from the project document */
export interface ProjectRoom {
  name:           string           // 'łazienka', 'kuchnia główna', 'sypialnia 1', 'korytarz'
  room_type:      string           // 'bathroom' | 'kitchen' | 'bedroom' | 'hallway' | 'living_room' | 'garage' | 'other'
  area_m2:        number | null    // floor area in m²
  height_m:       number | null    // ceiling height in m
  floor_finish:   string | null    // 'gres mat 60x60 R10', 'parkiet dębowy', 'beton szlifowany'
  wall_finish:    string | null    // 'płytki 30x60 do sufitu', 'tynk malowany biały'
  ceiling_finish: string | null    // 'tynk gładź malowana', 'sufit podwieszany GK', 'beton architektoniczny'
  fixtures:       string[]         // ['WC podtynkowe', 'prysznic walk-in', 'umywalka wpuszczana']
  installations:  string[]         // ['ogrzewanie podłogowe', 'odpływ liniowy', 'instalacja 400V']
  notes:          string[]         // any project-specific notes for this room
}

/** A material with specification extracted from the project */
export interface ProjectMaterial {
  name:           string
  category:       string           // 'tiles' | 'plumbing' | 'electrical' | 'paint' | 'wood' | 'glass' | 'sanitary' | 'other'
  quantity:       number | null
  unit:           string | null
  specification:  string | null    // e.g. '60×60 gres mat antypoślizgowy R10', 'obwód 20A'
  room:           string | null    // which room, or null = whole project / unspecified
  notes:          string | null
}

/** A scope item derived from the project (not from photo observation) */
export interface ProjectScopeItem {
  room:        string | null       // room name, or 'całość' / null for whole project
  description: string
  category:    string              // same taxonomy as room engine: 'demolition' | 'tiling' | 'plumbing' | etc.
  unit:        string | null
  quantity:    number | null
  priority:    'required' | 'likely' | 'optional'
  confidence:  number              // 0–100: how certain this is actually required per the project
  notes:       string | null
  /** Set by post-processing dependency engine — not by the AI model */
  provenance?: 'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

/** An estimate item ready for pre-fill in the estimate form */
export interface ProjectEstimateItem {
  name:        string
  unit:        string
  quantity:    number
  unit_price:  number | null       // always null — AI does not suggest prices
  confidence:  number
  source:      'project_derived' | 'ai_suggestion' | 'dependency_inferred' | 'confirmation_needed'
  notes:       string | null
  /** Set by post-processing dependency engine — not by the AI model */
  provenance?: 'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

// ── Comparison (project vs. observed reality) ── MVP types ──────────────────

/** Category of a single comparison finding */
export type ComparisonCategory =
  | 'matching'               // projekt i stan faktyczny zgodne
  | 'missing_from_reality'   // projekt przewiduje, ale zdjęcia nie pokazują
  | 'changed'                // projekt mówi X, rzeczywistość Y
  | 'uncertain'              // nie da się ocenić z dostępnych danych

/** One finding in a project-vs-reality comparison */
export interface ComparisonDiff {
  element:             string
  category:            ComparisonCategory
  project_description: string | null
  reality_description: string | null
  impact_on_scope:     string | null    // e.g. 'może wymagać dodatkowych prac rozbiórkowych'
  notes:               string | null
}

/** Full comparison result — produced client-side by compareProjectToReality() */
export interface ProjectComparisonResult {
  project_type:    ProjectDocumentType
  space_type:      string | null    // from RoomAnalysisResult
  diffs:           ComparisonDiff[]
  summary:         string | null    // one-sentence Polish summary
  scope_additions: ProjectScopeItem[]  // extra scope items implied by the gap
  warnings:        string[]
  confidence:      number           // 0–100: overall comparison confidence
}

// ── Main result type ─────────────────────────────────────────────────────────

/**
 * Result produced by the Project / Design Intelligence Engine (v1).
 *
 * Input sources: project PDF, architectural drawing, 3D visualization, technical spec.
 *
 * Designed for use by Polish construction/renovation contractors:
 *   1. Pre-fill estimate form (suggested_estimate_items)
 *   2. Generate work scope draft (work_scope_from_project)
 *   3. Extract room inventory (rooms_detected)
 *   4. Compare with site photos (if comparison_ready = true)
 */
export interface ProjectAnalysisResult {
  // ── Document classification
  project_type:  ProjectDocumentType
  project_name:  string | null        // detected project name or title

  // ── Space inventory
  rooms_detected:  ProjectRoom[]
  total_area_m2:   number | null      // total floor area across all detected rooms
  building_type:   string | null      // 'mieszkanie', 'dom jednorodzinny', 'lokal użytkowy'

  // ── Materials
  finish_materials:   ProjectMaterial[]
  equipment_detected: string[]         // general equipment list (high-level)

  // ── Work scope from project
  work_scope_from_project:  ProjectScopeItem[]

  // ── Estimate draft
  suggested_estimate_items:  ProjectEstimateItem[]

  // ── Transparency
  assumptions:         string[]
  missing_information: string[]
  project_notes:       string[]

  // ── Quality metadata
  confidence:  number
  warnings:    string[]

  // ── Comparison readiness
  comparison_ready:  boolean   // true if enough data to compare with room photo result

  /** Structured clarification questions from the dependency engine (v1) */
  clarification_questions?: ClarificationQuestion[]
}
