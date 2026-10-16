-- Add owner-scoped, transactionally idempotent client/project operations.
ALTER TABLE public.automation_jobs DROP CONSTRAINT automation_jobs_kind_check;
ALTER TABLE public.automation_jobs ADD CONSTRAINT automation_jobs_kind_check
 CHECK (kind IN ('estimate.draft','note.add','gmail.sync','gmail.draft','client.create','project.create','estimate.assign'));

CREATE OR REPLACE FUNCTION public.private_execute_crm_job(p_id UUID,p_lease UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 job public.automation_jobs; owner_id UUID; client UUID; project UUID; estimate UUID;
 existing_client UUID; existing_project UUID; doc_number TEXT; seq INTEGER; matches INTEGER;
 output JSONB; email_value TEXT;
BEGIN
 SELECT * INTO STRICT job FROM public.automation_jobs WHERE id=p_id FOR UPDATE;
 IF job.status='done' THEN RETURN job.result; END IF;
 IF job.status<>'running' OR job.lease_id IS DISTINCT FROM p_lease OR job.lease_until<=now() THEN RAISE EXCEPTION 'Invalid job lease'; END IF;
 SELECT owner_user_id INTO owner_id FROM public.private_app_settings
 WHERE singleton AND (enabled OR mcp_enabled) AND company_id=job.company_id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Private owner/company is not configured'; END IF;
 -- Serialize deduplication and project numbering within the owner company.
 PERFORM pg_advisory_xact_lock(hashtextextended('private-crm/'||job.company_id::text,0));
 IF job.kind='client.create' THEN
  IF coalesce(length(trim(job.payload->>'name')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid client name'; END IF;
  email_value:=nullif(lower(trim(job.payload->>'email')),'');
  IF email_value IS NOT NULL AND (length(email_value)>320 OR email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF email_value IS NOT NULL THEN
   SELECT count(*), min(id::text)::uuid INTO matches,client FROM public.clients WHERE company_id=job.company_id AND lower(trim(email))=email_value;
   IF matches>1 THEN RAISE EXCEPTION 'Ambiguous client email; choose an existing client'; END IF;
  END IF;
  IF client IS NULL THEN
   INSERT INTO public.clients(company_id,user_id,name,email,phone,city,address,postal_code,contact_person)
   VALUES(job.company_id,owner_id,trim(job.payload->>'name'),email_value,nullif(trim(job.payload->>'phone'),''),nullif(trim(job.payload->>'city'),''),nullif(trim(job.payload->>'address'),''),nullif(trim(job.payload->>'postal_code'),''),nullif(trim(job.payload->>'contact_person'),'')) RETURNING id INTO client;
   output:=jsonb_build_object('client_id',client,'created',true);
  ELSE output:=jsonb_build_object('client_id',client,'created',false); END IF;
 ELSIF job.kind IN ('project.create','estimate.assign') THEN
  client:=nullif(job.payload->>'client_id','')::uuid;
  estimate:=nullif(job.payload->>'estimate_id','')::uuid;
  IF job.kind='estimate.assign' AND estimate IS NULL THEN RAISE EXCEPTION 'Estimate required'; END IF;
  IF estimate IS NOT NULL THEN
   SELECT client_id,project_id INTO existing_client,existing_project FROM public.cost_estimates
   WHERE id=estimate AND company_id=job.company_id AND status='draft' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Draft estimate not found in company'; END IF;
  END IF;
  IF job.kind='project.create' THEN
   IF coalesce(length(trim(job.payload->>'name')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid project name'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=client AND company_id=job.company_id) THEN RAISE EXCEPTION 'Invalid client scope'; END IF;
   IF existing_client IS NOT NULL AND existing_client<>client THEN RAISE EXCEPTION 'Estimate client conflict'; END IF;
   project:=existing_project;
   IF project IS NULL THEN
    SELECT count(*),min(id::text)::uuid INTO matches,project FROM public.projects
    WHERE company_id=job.company_id AND client_id=client AND name=trim(job.payload->>'name')
    AND coalesce(investment_address,'')=coalesce(nullif(trim(job.payload->>'investment_address'),''),'') AND deleted_at IS NULL;
    IF matches>1 THEN RAISE EXCEPTION 'Ambiguous project; choose existing project'; END IF;
   END IF;
   IF project IS NULL THEN
    -- Locks coordinate with UI inserts as well as other CRM jobs.
    LOCK TABLE public.projects IN SHARE ROW EXCLUSIVE MODE;
    SELECT greatest(coalesce(max(CASE WHEN number ~ '^PRJ-[0-9]+$' THEN substring(number from 5)::integer ELSE 0 END),0)+1,count(*)::integer+1)
    INTO seq FROM public.projects WHERE company_id=job.company_id;
    doc_number:='PRJ-'||lpad(seq::text,greatest(3,length(seq::text)),'0');
    INSERT INTO public.projects(company_id,user_id,client_id,number,name,status,address,investment_address,notes)
    VALUES(job.company_id,owner_id,client,doc_number,trim(job.payload->>'name'),'offer',nullif(trim(job.payload->>'investment_address'),''),nullif(trim(job.payload->>'investment_address'),''),job.payload->>'notes') RETURNING id INTO project;
   END IF;
  ELSE project:=(job.payload->>'project_id')::uuid; END IF;
  SELECT client_id,number INTO existing_client,doc_number FROM public.projects
   WHERE id=project AND company_id=job.company_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR existing_client IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=existing_client AND company_id=job.company_id) THEN RAISE EXCEPTION 'Invalid project/client scope'; END IF;
  IF client IS NOT NULL AND client<>existing_client THEN RAISE EXCEPTION 'Project client conflict'; END IF;
  client:=existing_client;
  IF estimate IS NOT NULL THEN
   IF existing_project IS NOT NULL AND existing_project<>project THEN RAISE EXCEPTION 'Estimate project conflict'; END IF;
   UPDATE public.cost_estimates SET client_id=client,project_id=project WHERE id=estimate AND company_id=job.company_id AND status='draft'
   AND (client_id IS NULL OR client_id=client) AND (project_id IS NULL OR project_id=project);
   IF NOT FOUND THEN RAISE EXCEPTION 'Estimate assignment conflict'; END IF;
   INSERT INTO public.project_documents(company_id,project_id,doc_type,doc_id,assignment_status,linked_manually)
   VALUES(job.company_id,project,'estimate',estimate,'confirmed',true)
   ON CONFLICT(company_id,project_id,doc_type,doc_id) DO UPDATE SET assignment_status='confirmed',archived_at=NULL,linked_manually=true;
  END IF;
  output:=jsonb_build_object('client_id',client,'project_id',project,'estimate_id',estimate,'number',doc_number);
 ELSE RAISE EXCEPTION 'Not a CRM job'; END IF;
 UPDATE public.automation_jobs SET status='done',result=output,lease_id=NULL,lease_until=NULL,updated_at=now() WHERE id=job.id;
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.private_execute_crm_job(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_execute_crm_job(UUID,UUID) TO service_role;
