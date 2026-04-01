-- =============================================================================
-- 094_ai_bundle_assets.sql
-- =============================================================================
-- Composite Project Analysis — Asset Registry
-- One row per file or text note in a bundle.
-- Rich metadata enables source-aware extraction, priority ordering,
-- room disambiguation, and evidence traceability.
--
-- Differences from ai_input_assets (089 — P0, frozen):
--   - ai_input_assets: simple audit log, tied to a run_id → DO NOT CHANGE
--   - ai_bundle_assets: first-class asset with lifecycle, roles, room hints,
--     source priority, and extraction status tracking
--
-- Bridge to P0: input_asset_id is a nullable FK to ai_input_assets,
-- allowing P0 runs to reference the same storage objects without breaking
-- the frozen 089 table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_bundle_assets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id         uuid        NOT NULL REFERENCES public.ai_analysis_bundles(id) ON DELETE CASCADE,
  company_id        uuid        NOT NULL,
  project_id        uuid        NOT NULL,

  -- ── Storage reference ──────────────────────────────────────────────────────
  storage_path      text        NOT NULL,
  original_filename text        NOT NULL,
  mime_type         text        NOT NULL,
  file_size_bytes   bigint,

  -- ── Asset classification ───────────────────────────────────────────────────
  -- source_type: physical format of the file
  source_type       text        NOT NULL DEFAULT 'unknown'
                                CHECK (source_type IN (
                                  'pdf',           -- any PDF (drawing, spec, visualization)
                                  'photo',         -- on-site photo, progress photo
                                  'render',        -- 3D render or visualization image
                                  'text_note',     -- plain/markdown text note
                                  'unknown'
                                )),

  -- source_role: semantic role in the project analysis context
  -- Used by extractors to select the right prompt and parsing strategy
  source_role       text        NOT NULL DEFAULT 'unknown'
                                CHECK (source_role IN (
                                  'architectural_drawing',   -- rzut techniczny z wymiarami
                                  'design_visualization',    -- wizualizacja 3D / render wnętrza
                                  'technical_spec',          -- specyfikacja techniczna / zestawienie
                                  'installation_drawing',    -- schemat wod-kan / elek
                                  'site_photo',              -- zdjęcie budowy / postęp prac
                                  'progress_photo',          -- zdjęcie po zakończeniu etapu
                                  'text_note',               -- opis tekstowy / notatka
                                  'unknown'
                                )),

  -- ── Room disambiguation ────────────────────────────────────────────────────
  -- Optional hint set by operator or auto-detected from filename/content
  room_hint         text,        -- e.g. 'łazienka parter', 'kuchnia', null = całość projektu

  -- ── Extraction priority ────────────────────────────────────────────────────
  -- Lower = higher priority (1 = most important source)
  -- Default 50 = neutral. Extractor uses this to order source merging.
  -- Aligns with calibration rule R-12 source hierarchy.
  source_priority   integer     NOT NULL DEFAULT 50
                                CHECK (source_priority BETWEEN 1 AND 99),

  -- ── Extraction lifecycle ───────────────────────────────────────────────────
  extraction_status text        NOT NULL DEFAULT 'pending'
                                CHECK (extraction_status IN (
                                  'pending',     -- queued, not yet processed
                                  'processing',  -- extraction in progress
                                  'extracted',   -- evidence written to ai_extraction_results
                                  'failed',      -- extraction failed, see processing_error
                                  'skipped'      -- intentionally excluded (e.g. duplicate)
                                )),

  processing_error  text,        -- populated when extraction_status = 'failed'

  -- ── P0 bridge ─────────────────────────────────────────────────────────────
  -- Nullable FK to ai_input_assets — allows P0 runs to reference the same
  -- storage objects without modifying the frozen 089 table.
  input_asset_id    uuid        REFERENCES public.ai_input_assets(id) ON DELETE SET NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.ai_bundle_assets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_bundle_assets_updated_at
  BEFORE UPDATE ON public.ai_bundle_assets
  FOR EACH ROW EXECUTE FUNCTION public.ai_bundle_assets_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS ai_bundle_assets_bundle_id_idx
  ON public.ai_bundle_assets (bundle_id);

CREATE INDEX IF NOT EXISTS ai_bundle_assets_company_project_idx
  ON public.ai_bundle_assets (company_id, project_id);

CREATE INDEX IF NOT EXISTS ai_bundle_assets_extraction_status_idx
  ON public.ai_bundle_assets (bundle_id, extraction_status);

-- RLS
ALTER TABLE public.ai_bundle_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_bundle_assets_select"
  ON public.ai_bundle_assets FOR SELECT
  USING (company_id = my_company_id());

-- INSERT and status updates via service role only (bypasses RLS)

NOTIFY pgrst, 'reload schema';
