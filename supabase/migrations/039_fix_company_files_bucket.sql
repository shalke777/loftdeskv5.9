-- =============================================================================
-- Migration 039 ÔÇö idempotent create-or-fix of the company-files storage bucket
-- =============================================================================
-- Root cause: migration 037 was never applied to production because there is
-- no automatic `supabase db push` in the Netlify build pipeline.
-- Migration 038's UPDATE statement silently touched 0 rows (bucket absent).
--
-- This migration is fully idempotent ÔÇö safe to run on any state:
--   ÔÇó bucket missing        Ôćĺ INSERT creates it with correct MIME types
--   ÔÇó bucket already exists Ôćĺ ON CONFLICT DO UPDATE refreshes MIME types
--   ÔÇó policies already exist Ôćĺ DROP IF EXISTS + CREATE removes stale copies
-- =============================================================================

BEGIN;

-- ÔöÇÔöÇ 1. Upsert the bucket ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

-- ÔöÇÔöÇ 2. Policies ÔÇö drop-and-recreate so re-runs are safe ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

-- Public read (no auth required ÔÇö URLs are shared with clients)
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
