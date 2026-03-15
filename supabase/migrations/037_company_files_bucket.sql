-- Create a general-purpose storage bucket for company files:
-- expense invoices (PDF/images), chat attachments, and other documents.
-- Separate from 'company-logos' which is image-only with a 500 KB cap.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-files',
  'company-files',
  true,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Public read — URLs are shared with clients / embedded in PDFs
DROP POLICY IF EXISTS "company_files_read" ON storage.objects;
CREATE POLICY "company_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-files');

-- Authenticated users may upload into their own company folder
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

NOTIFY pgrst, 'reload schema';
