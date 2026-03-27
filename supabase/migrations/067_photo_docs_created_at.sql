-- =============================================================================
-- Migration 067: Add created_at to project_photo_docs
--
-- Root cause: project_photo_docs was created in migration 017 without a
-- created_at column. The client-portal API query was selecting it, which
-- caused a 42703 (column does not exist) error for all clients on the
-- "Zdjęcia z realizacji" section of the Documents tab.
--
-- After applying this migration, re-add created_at to the SELECT in
-- src/features/client-portal/api/client-portal.api.ts listPhotoDocs().
--
-- Safety:
--   - ADD COLUMN IF NOT EXISTS — idempotent
--   - DEFAULT now() sets a reasonable timestamp for existing rows
--   - NOT NULL with DEFAULT means no existing rows are broken
--   - Existing data is not changed in any other way
-- =============================================================================

ALTER TABLE public.project_photo_docs
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows: use taken_at if set, otherwise now()
UPDATE public.project_photo_docs
SET created_at = COALESCE(taken_at, now())
WHERE created_at = now()
  AND taken_at IS NOT NULL;

-- Index for ordering/pagination
CREATE INDEX IF NOT EXISTS idx_project_photo_docs_created_at
  ON public.project_photo_docs (project_id, created_at DESC);
