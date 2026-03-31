-- Migration 083: Create ai-inputs storage bucket for AI analysis uploads
-- Private bucket with path convention: {company_id}/{project_id}/{run_id}/{filename}
-- Separate from company-files. Used only by the AI engine pipeline.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-inputs',
  'ai-inputs',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated operators can upload into their own company path
CREATE POLICY "ai_inputs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ai-inputs'
    AND (storage.foldername(name))[1] = (my_company_id())::text
  );

-- Authenticated operators can read from their own company path
CREATE POLICY "ai_inputs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ai-inputs'
    AND (storage.foldername(name))[1] = (my_company_id())::text
  );

-- Authenticated operators can delete their own uploads
CREATE POLICY "ai_inputs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ai-inputs'
    AND (storage.foldername(name))[1] = (my_company_id())::text
  );

NOTIFY pgrst, 'reload schema';
