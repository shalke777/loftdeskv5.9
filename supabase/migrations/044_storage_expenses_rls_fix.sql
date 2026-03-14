-- =============================================================================
-- Migration 044 — Fix upload RLS for company-files bucket (expenses path)
-- =============================================================================
-- Symptom:  POST /storage/v1/object/company-files/.../expenses/...  400
--           "new row violates row-level security policy"
--
-- Root cause:
--   Migrations 037 and 039 defined the INSERT policy but were never applied to
--   production because `supabase db push` is not part of the Netlify build.
--   Result: storage.objects has RLS on but no permissive INSERT policy
--   → every upload is rejected.
--
-- This migration must be run MANUALLY in the Supabase SQL Editor:
--   https://supabase.com/dashboard → project → SQL Editor → paste + run
--
-- Idempotent: DROP IF EXISTS before every CREATE.
-- =============================================================================

BEGIN;

-- ── 1. Upsert bucket (safe if already exists) ────────────────────────────────
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
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. DROP stale copies of all three policies ───────────────────────────────
DROP POLICY IF EXISTS "company_files_read"   ON storage.objects;
DROP POLICY IF EXISTS "company_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_files_delete" ON storage.objects;
-- Also drop older names from migration 008 comments in case they were applied
DROP POLICY IF EXISTS "company files read"   ON storage.objects;
DROP POLICY IF EXISTS "company files write"  ON storage.objects;

-- ── 3. SELECT — public read (URLs are shared with clients / PDFs) ─────────────
CREATE POLICY "company_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-files');

-- ── 4. INSERT — authenticated user uploading to their own company folder ──────
--
--  Path format used by expenses.api.ts:
--    <company_id>/expenses/<timestamp>_<filename>
--
--  Policy enforces:
--    (a) correct bucket
--    (b) user is authenticated
--    (c) first path segment = the user's own company_id
--        → multi-tenant isolation: user A cannot upload into company B's folder
--
CREATE POLICY "company_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-files'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = my_company_id()::text
  );

-- ── 5. UPDATE — authenticated user may replace their own file (upsert=false
--    in current code, but allow for future use) ─────────────────────────────
DROP POLICY IF EXISTS "company_files_update" ON storage.objects;
CREATE POLICY "company_files_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'company-files'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = my_company_id()::text
  );

-- ── 6. DELETE — authenticated user may delete files in their company folder ──
CREATE POLICY "company_files_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-files'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = my_company_id()::text
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
