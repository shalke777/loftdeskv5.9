-- =============================================================================
-- Migration 098: ai_fusion_snapshots
-- =============================================================================
-- Persists the output of bundle-fusion so results survive page reloads
-- without re-computing.
--
-- One snapshot per bundle (bundle_id UNIQUE).
-- Backend upserts after each fusion compute.
-- Staleness detected via evidence_count comparison.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_fusion_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       uuid NOT NULL REFERENCES public.ai_analysis_bundles(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL,
  result_json     jsonb NOT NULL,
  evidence_count  integer NOT NULL DEFAULT 0,
  fusion_ms       integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One snapshot per bundle — upsert replaces on re-compute
CREATE UNIQUE INDEX IF NOT EXISTS ai_fusion_snapshots_bundle_idx
  ON public.ai_fusion_snapshots(bundle_id);

-- Fast lookup by company
CREATE INDEX IF NOT EXISTS ai_fusion_snapshots_company_idx
  ON public.ai_fusion_snapshots(company_id);

-- RLS
ALTER TABLE public.ai_fusion_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fusion_snapshots_select"
  ON public.ai_fusion_snapshots FOR SELECT
  USING (company_id = my_company_id());

-- Service role writes (backend only), but allow frontend SELECT via RLS
-- No INSERT/UPDATE/DELETE policies for anon/authenticated — only service role writes
