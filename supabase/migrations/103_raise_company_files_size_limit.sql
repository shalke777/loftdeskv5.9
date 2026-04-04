-- Migration 103: Raise company-files bucket size limit from 20 MB to 40 MB
-- Root cause: analyze-project async path uploads PDFs up to 40 MB,
-- but the bucket rejected files >20 MB at the Supabase Storage level.

UPDATE storage.buckets
SET file_size_limit = 41943040  -- 40 MB
WHERE id = 'company-files';
