-- Add logo_url column to companies and profiles tables
-- Used by Business plan users to display their own logo on documents

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for company logos (if using Supabase storage)
-- Note: bucket creation is typically done via Supabase Dashboard or CLI.
-- The bucket should be named 'company-logos' with:
--   - Public access for reading (logos are shown in PDFs)
--   - Authenticated upload for owners/admins only
--   - Max file size: 500KB
--   - Allowed MIME types: image/png, image/jpeg, image/svg+xml, image/webp

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  524288,
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for company-logos bucket
CREATE POLICY "company_logos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

CREATE POLICY "company_logos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "company_logos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-logos'
    AND auth.role() = 'authenticated'
  );

NOTIFY pgrst, 'reload schema';
