CREATE TABLE public.private_ksef_credentials (
 company_id UUID NOT NULL REFERENCES public.companies(id), env TEXT NOT NULL CHECK(env IN('test','demo','prod')),
 nip TEXT NOT NULL, encrypted_access_token TEXT NOT NULL, encrypted_refresh_token TEXT NOT NULL,
 access_expires_at TIMESTAMPTZ, refresh_expires_at TIMESTAMPTZ, last_error TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(company_id,env)
);
ALTER TABLE public.private_ksef_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_ksef_credentials FROM anon,authenticated;
ALTER TABLE public.invoices ADD COLUMN ksef_upo_path TEXT, ADD COLUMN ksef_upo_sha256 TEXT;
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('ksef-documents','ksef-documents',FALSE,5242880)
 ON CONFLICT(id) DO UPDATE SET public=FALSE;
CREATE POLICY private_ksef_artifacts ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='ksef-documents' AND public.private_app_access_allowed() AND (storage.foldername(name))[1]=public.my_company_id()::TEXT);

GRANT ALL ON public.private_ksef_credentials TO service_role;
