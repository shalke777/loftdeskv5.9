-- =============================================================================
-- 095_ai_extraction_results.sql
-- =============================================================================
-- Composite Project Analysis — Evidence Layer
-- One row per extracted evidence item from a single asset.
-- This is the EVIDENCE layer — NOT the final scope/estimate.
--
-- Design principle (from calibration batch 1):
--   - Extractors produce evidence, not final answers
--   - Evidence has type, confidence, source anchor, and conflicts
--   - Fusion (future P1 phase) merges evidence across assets into scope
--   - Missing data and conflicts are explicit and stored — never silenced
--
-- Evidence types map to calibration rules:
--   dimension  → area, height, sp_height (R-15, R-20)
--   fixture    → wanna, kabina, parawan, umywalka (R-17, R-22, R-23)
--   material   → płytki, gres, format (R-21, R-26)
--   installation → grzejnik, pralka, hydraulika (R-18, R-24)
--   tile_spec  → zestawienie okladzin sciennych (R-26 gold truth)
--   scope_hint → wykryte działanie, które trafi do scope after fusion
--   missing_data → jawna luka — brak rzutu, brak wymiaru (R-19)
--   conflict   → sprzeczność między assetami
--   hypothesis → możliwe, ale niepotwierdzone
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_extraction_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       uuid        NOT NULL REFERENCES public.ai_analysis_bundles(id) ON DELETE CASCADE,
  asset_id        uuid        NOT NULL REFERENCES public.ai_bundle_assets(id) ON DELETE CASCADE,
  company_id      uuid        NOT NULL,
  project_id      uuid        NOT NULL,

  -- ── Extraction provenance ──────────────────────────────────────────────────
  extractor_type  text        NOT NULL
                              CHECK (extractor_type IN (
                                'document_ai',    -- structured PDF / OCR-based
                                'room_vision',    -- photo → room analysis
                                'project_vision', -- PDF/render → project/design analysis
                                'text_nlp',       -- text note parsing
                                'manual'          -- operator-entered override
                              )),

  -- ── Evidence classification ────────────────────────────────────────────────
  evidence_type   text        NOT NULL
                              CHECK (evidence_type IN (
                                'dimension',      -- wymiar: pole, wysokość, długość
                                'fixture',        -- armatura: wanna, kabina, umywalka, WC
                                'material',       -- płytki, gres, farba, klej
                                'installation',   -- hydraulika, elektryka, ogrzewanie
                                'tile_spec',      -- zestawienie okładzin ściennych (R-26)
                                'scope_hint',     -- sugestia zakresu prac
                                'missing_data',   -- jawna luka — brak danych
                                'conflict',       -- sprzeczność ze źródłem
                                'hypothesis'      -- prawdopodobne ale niepotwierdzone
                              )),

  -- ── Evidence payload ──────────────────────────────────────────────────────
  -- Structured content specific to evidence_type.
  -- Schema is validated at application layer, not DB layer (JSONB flexible).
  --
  -- Examples by evidence_type:
  --   dimension:   { "subject": "floor_area", "value": 4.97, "unit": "m2",
  --                  "room_label": "łazienka", "source": "rzut_techniczny" }
  --   fixture:     { "name": "wanna zabudowana", "brand": null,
  --                  "dims": "70x160", "confirmed": true }
  --   tile_spec:   { "product": "Tubądzin Aulla Grey", "format": "75.8x75.8",
  --                  "area_netto": 5.2, "waste_multiplier": 1.10,
  --                  "zone": "ściany główne" }
  --   scope_hint:  { "description": "Obudowa wanny front i bok",
  --                  "rule": "R-22", "category": "tiling" }
  --   missing_data:{ "subject": "rzut_wod-kan", "impact": "cannot_confirm_hydraulics",
  --                  "required_question": "Q-WODKAN-ZMIANA" }
  --   conflict:    { "with_asset_id": "...", "subject": "sp_height",
  --                  "value_this": 264, "value_other": 285 }
  content         jsonb       NOT NULL DEFAULT '{}',

  -- ── Room context ──────────────────────────────────────────────────────────
  -- Which room this evidence belongs to (null = whole project / unknown)
  room_label      text,

  -- ── Confidence ────────────────────────────────────────────────────────────
  confidence_score  numeric(4, 2)
                    CHECK (confidence_score IS NULL OR
                           (confidence_score >= 0 AND confidence_score <= 1)),

  -- Human-readable reason for the confidence score (aligns with R-12 hierarchy)
  -- e.g. "Wymiar z rzutu technicznego z 2 przekrojami"
  --      "Wizualizacja, brak wymiarów technicznych"
  confidence_reason text,

  -- ── Source traceability ────────────────────────────────────────────────────
  -- Where in the source document this evidence was found
  -- e.g. "strona 3, WIDOK A", "lewa ściana", "ZESTAWIENIE OKŁADZIN ŚCIENNYCH"
  source_anchor   text,

  -- ── Conflict references ────────────────────────────────────────────────────
  -- UUIDs of other ai_extraction_results rows that this conflicts with
  conflict_ids    uuid[]      NOT NULL DEFAULT '{}',

  -- ── Fusion flag ───────────────────────────────────────────────────────────
  -- Whether this evidence has been consumed by the fusion engine
  -- (future P1 phase — not active yet)
  fused           boolean     NOT NULL DEFAULT false,
  fused_at        timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.ai_extraction_results_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_extraction_results_updated_at
  BEFORE UPDATE ON public.ai_extraction_results
  FOR EACH ROW EXECUTE FUNCTION public.ai_extraction_results_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS ai_extraction_results_bundle_id_idx
  ON public.ai_extraction_results (bundle_id);

CREATE INDEX IF NOT EXISTS ai_extraction_results_asset_id_idx
  ON public.ai_extraction_results (asset_id);

CREATE INDEX IF NOT EXISTS ai_extraction_results_company_project_idx
  ON public.ai_extraction_results (company_id, project_id);

CREATE INDEX IF NOT EXISTS ai_extraction_results_type_idx
  ON public.ai_extraction_results (bundle_id, evidence_type);

CREATE INDEX IF NOT EXISTS ai_extraction_results_unfused_idx
  ON public.ai_extraction_results (bundle_id, fused)
  WHERE fused = false;

-- RLS
ALTER TABLE public.ai_extraction_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_extraction_results_select"
  ON public.ai_extraction_results FOR SELECT
  USING (company_id = my_company_id());

-- All writes via service role (bypasses RLS)

NOTIFY pgrst, 'reload schema';
