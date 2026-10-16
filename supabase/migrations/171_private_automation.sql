CREATE TABLE public.automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  kind TEXT NOT NULL CHECK (kind IN ('estimate.draft','note.add','gmail.sync','gmail.draft')),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 160),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','unknown')),
  result JSONB, last_error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  lease_id UUID, lease_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,idempotency_key)
);
CREATE TABLE public.assistant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES public.companies(id),
  project_id UUID REFERENCES public.projects(id), content TEXT NOT NULL,
  source_job_id UUID NOT NULL UNIQUE REFERENCES public.automation_jobs(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.private_integrations (
  company_id UUID NOT NULL REFERENCES public.companies(id), provider TEXT NOT NULL CHECK(provider='gmail'),
  account_email TEXT NOT NULL, encrypted_refresh_token TEXT NOT NULL, last_sync_at TIMESTAMPTZ,
  PRIMARY KEY(company_id,provider)
);
CREATE TABLE public.integration_oauth_states (
  state_hash TEXT PRIMARY KEY, company_id UUID NOT NULL REFERENCES public.companies(id),
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.automation_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES public.companies(id),
  provider_id TEXT NOT NULL, thread_id TEXT, sender TEXT, subject TEXT, body TEXT,
  received_at TIMESTAMPTZ, attachment_metadata JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','handled','ignored')),
  UNIQUE(company_id,provider_id)
);
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_integrations, public.integration_oauth_states FROM anon, authenticated;
CREATE POLICY private_jobs_read ON public.automation_jobs FOR SELECT TO authenticated USING (public.private_app_access_allowed() AND company_id=public.my_company_id());
CREATE POLICY private_notes_read ON public.assistant_notes FOR SELECT TO authenticated USING (public.private_app_access_allowed() AND company_id=public.my_company_id());
CREATE POLICY private_inbox_read ON public.automation_inbox FOR SELECT TO authenticated USING (public.private_app_access_allowed() AND company_id=public.my_company_id());

CREATE OR REPLACE FUNCTION public.private_enqueue_job(p_company_id UUID,p_kind TEXT,p_key TEXT,p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job public.automation_jobs;
BEGIN
 INSERT INTO public.automation_jobs(company_id,kind,idempotency_key,payload) VALUES(p_company_id,p_kind,p_key,p_payload)
 ON CONFLICT(company_id,idempotency_key) DO NOTHING;
 SELECT * INTO job FROM public.automation_jobs WHERE company_id=p_company_id AND idempotency_key=p_key;
 IF job.kind<>p_kind OR job.payload<>p_payload THEN RAISE EXCEPTION 'Idempotency key reused with different input'; END IF;
 RETURN jsonb_build_object('id',job.id,'status',job.status,'result',job.result);
END $$;

CREATE OR REPLACE FUNCTION public.private_claim_job(p_company_id UUID) RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 -- Only transactionally idempotent database jobs and read-only sync are retried after a crash.
 UPDATE public.automation_jobs SET status=CASE WHEN kind='gmail.draft' THEN 'unknown' WHEN attempts>=5 THEN 'failed' ELSE 'queued' END,
 last_error='Worker lease expired',lease_id=NULL,lease_until=NULL
 WHERE company_id=p_company_id AND status='running' AND lease_until<now();
 RETURN QUERY UPDATE public.automation_jobs SET status='running',attempts=attempts+1,
 lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
 WHERE id=(SELECT id FROM public.automation_jobs WHERE company_id=p_company_id AND status='queued' AND attempts<5
 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.private_execute_db_job(p_id UUID,p_lease UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job public.automation_jobs; doc_id UUID; doc_number TEXT; item JSONB; net NUMERIC:=0; vat NUMERIC:=0; line_net NUMERIC; line_vat NUMERIC; sort_no INTEGER:=0; client UUID; project UUID; owner_id UUID;
BEGIN
 SELECT * INTO job FROM public.automation_jobs WHERE id=p_id FOR UPDATE;
 IF job.status='done' THEN RETURN job.result; END IF;
 IF job.status<>'running' OR job.lease_id IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'Invalid job lease'; END IF;
 SELECT owner_user_id INTO owner_id FROM public.private_app_settings
 WHERE singleton AND enabled AND company_id=job.company_id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Private owner/company is not configured'; END IF;
 client:=NULLIF(job.payload->>'client_id','')::UUID; project:=NULLIF(job.payload->>'project_id','')::UUID;
 IF client IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=client AND company_id=job.company_id) THEN RAISE EXCEPTION 'Invalid client scope'; END IF;
 IF project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=project AND company_id=job.company_id) THEN RAISE EXCEPTION 'Invalid project scope'; END IF;
 IF job.kind='note.add' THEN
  IF length(trim(COALESCE(job.payload->>'content','')))=0 THEN RAISE EXCEPTION 'Empty note'; END IF;
  INSERT INTO public.assistant_notes(company_id,project_id,content,source_job_id) VALUES(job.company_id,project,job.payload->>'content',job.id) RETURNING id INTO doc_id;
 ELSIF job.kind='estimate.draft' THEN
  IF length(trim(COALESCE(job.payload->>'name','')))=0 OR jsonb_typeof(job.payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(job.payload->'items') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid estimate'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(job.payload->'items') LOOP
   IF COALESCE(length(trim(item->>'name')),0)=0 OR COALESCE((item->>'quantity')::NUMERIC,0)<=0 OR (item->>'unit_price') IS NULL OR (item->>'unit_price')::NUMERIC<0 OR (item->>'vat_rate') IS NULL OR (item->>'vat_rate')::NUMERIC NOT IN(0,5,8,23) THEN RAISE EXCEPTION 'Invalid estimate line'; END IF;
   line_net:=round((item->>'quantity')::NUMERIC*(item->>'unit_price')::NUMERIC,2);
   line_vat:=round(line_net*(item->>'vat_rate')::NUMERIC/100,2); net:=net+line_net;vat:=vat+line_vat;
  END LOOP;
  doc_number:=public.next_doc_number(job.company_id,'estimate',CURRENT_DATE);
  INSERT INTO public.cost_estimates(company_id,user_id,client_id,project_id,number,name,status,total_net,total_gross,notes)
   VALUES(job.company_id,owner_id,client,project,doc_number,job.payload->>'name','draft',net,net+vat,job.payload->>'notes') RETURNING id INTO doc_id;
  FOR item IN SELECT * FROM jsonb_array_elements(job.payload->'items') LOOP
   INSERT INTO public.cost_estimate_items(cost_estimate_id,name,description,unit,quantity,unit_price,vat_rate,sort_order)
   VALUES(doc_id,item->>'name',item->>'name',COALESCE(item->>'unit','kpl'),(item->>'quantity')::NUMERIC,(item->>'unit_price')::NUMERIC,(item->>'vat_rate')::NUMERIC,sort_no);
   sort_no:=sort_no+1;
  END LOOP;
 ELSE RAISE EXCEPTION 'Not a database job'; END IF;
 UPDATE public.automation_jobs SET status='done',result=jsonb_build_object('document_id',doc_id,'number',doc_number),lease_id=NULL,lease_until=NULL,updated_at=now() WHERE id=p_id;
 RETURN jsonb_build_object('document_id',doc_id,'number',doc_number);
END $$;
REVOKE ALL ON FUNCTION public.private_enqueue_job(UUID,TEXT,TEXT,JSONB),public.private_claim_job(UUID),public.private_execute_db_job(UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_enqueue_job(UUID,TEXT,TEXT,JSONB),public.private_claim_job(UUID),public.private_execute_db_job(UUID,UUID) TO service_role;
ALTER TABLE public.private_integrations ADD COLUMN sync_page_token TEXT,
 ADD COLUMN sync_window_start TIMESTAMPTZ, ADD COLUMN sync_window_end TIMESTAMPTZ;

GRANT ALL ON public.automation_jobs,public.assistant_notes,public.private_integrations,public.integration_oauth_states,public.automation_inbox TO service_role;
GRANT SELECT ON public.automation_jobs,public.assistant_notes,public.automation_inbox TO authenticated;
