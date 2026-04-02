-- =============================================================================
-- 097_p1_schema_alignment.sql
-- =============================================================================
-- Adds two columns that P1 composite TS types expect but were missing from the
-- original 093/094 CREATE TABLE statements:
--   1. ai_analysis_bundles.document_type   (bundle-level document classification)
--   2. ai_bundle_assets.layer_type         (per-asset drawing layer classification)
--
-- Both columns are nullable text with CHECK constraints matching the TS union types
-- in src/services/ai/composite/bundle.types.ts.
--
-- Safe: additive only, nullable, no default, no existing-row impact.
-- =============================================================================

-- 1. ai_analysis_bundles.document_type
ALTER TABLE public.ai_analysis_bundles
  ADD COLUMN IF NOT EXISTS document_type text;

ALTER TABLE public.ai_analysis_bundles
  ADD CONSTRAINT ai_analysis_bundles_document_type_check
  CHECK (document_type IS NULL OR document_type IN (
    'projekt_wykonawczy',
    'visualization_pack',
    'unknown'
  ));

-- 2. ai_bundle_assets.layer_type
ALTER TABLE public.ai_bundle_assets
  ADD COLUMN IF NOT EXISTS layer_type text;

ALTER TABLE public.ai_bundle_assets
  ADD CONSTRAINT ai_bundle_assets_layer_type_check
  CHECK (layer_type IS NULL OR layer_type IN (
    'title_page',
    'visualization_3d',
    'survey_existing',
    'functional_layout',
    'structural_guidelines',
    'electrical_legend',
    'electrical_lighting',
    'electrical_sockets',
    'plumbing_wod_kan',
    'floor_coverings',
    'wall_coverings',
    'wall_elevations',
    'tile_layout',
    'ceiling_plan',
    'furniture_drawing',
    'staircase_design',
    'glazing_door_detail',
    'construction_detail',
    'unknown'
  ));
