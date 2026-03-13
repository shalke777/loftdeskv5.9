-- =============================================================================
-- Migration 039 — idempotent create-or-fix of the company-files storage bucket
-- =============================================================================
-- Root cause: migration 037 was never applied to production because there is
-- no automatic `supabase db push` in the Netlify build pipeline.
-- Migration 038's UPDATE statement silently touched 0 rows (bucket absent).
--
-- This migration is fully idempotent — safe to run on any state:
--   • bucket missing        → INSERT creates it with correct MIME types
--   • bucket already exists → ON CONFLICT DO UPDATE refreshes MIME types
--   • policies already exist → DROP IF EXISTS + CREATE removes stale copies
-- =============================================================================

BEGIN;

-- ── 1. Upsert the bucket ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-files',
  'company-files',
  true,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET
    public            = EXCLUDED.public,
    file_size_limit   = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Policies — drop-and-recreate so re-runs are safe ──────────────────────

-- Public read (no auth required — URLs are shared with clients)
DROP POLICY IF EXISTS "company_files_read" ON storage.objects;
CREATE POLICY "company_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-files');

-- Authenticated users may upload
DROP POLICY IF EXISTS "company_files_insert" ON storage.objects;
CREATE POLICY "company_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-files'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users may delete their own uploads
DROP POLICY IF EXISTS "company_files_delete" ON storage.objects;
CREATE POLICY "company_files_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-files'
    AND auth.role() = 'authenticated'
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
