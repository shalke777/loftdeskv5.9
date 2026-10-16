-- Activate owner-scoped MCP independently of the legacy application cutover.
ALTER TABLE public.private_app_settings ADD COLUMN mcp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.private_app_settings ADD CONSTRAINT private_mcp_owner_required CHECK (NOT mcp_enabled OR (owner_user_id IS NOT NULL AND company_id IS NOT NULL));

CREATE OR REPLACE FUNCTION public.private_execute_db_job(p_id UUID,p_lease UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job public.automation_jobs; doc_id UUID; doc_number TEXT; item JSONB; net NUMERIC:=0; vat NUMERIC:=0; line_net NUMERIC; line_vat NUMERIC; sort_no INTEGER:=0; client UUID; project UUID; owner_id UUID;
BEGIN
 SELECT * INTO job FROM public.automation_jobs WHERE id=p_id FOR UPDATE;
 IF job.status='done' THEN RETURN job.result; END IF;
 IF job.status<>'running' OR job.lease_id IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'Invalid job lease'; END IF;
 SELECT owner_user_id INTO owner_id FROM public.private_app_settings
 WHERE singleton AND (enabled OR mcp_enabled) AND company_id=job.company_id;
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

CREATE OR REPLACE FUNCTION public.private_mcp_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  claims JSONB := event->'claims';
  oauth_client TEXT := COALESCE(NULLIF(event->>'client_id',''), NULLIF(claims->>'client_id',''));
  settings public.private_app_settings;
  client public.private_mcp_clients;
BEGIN
  -- Preserve existing first-party login/refresh behavior.
  IF oauth_client IS NULL THEN RETURN event; END IF;
  SELECT * INTO settings FROM public.private_app_settings WHERE singleton;
  SELECT * INTO client FROM public.private_mcp_clients WHERE client_id=oauth_client AND enabled;
  IF NOT (COALESCE(settings.enabled,FALSE) OR COALESCE(settings.mcp_enabled,FALSE)) OR client.client_id IS NULL
     OR claims->>'sub' IS DISTINCT FROM settings.owner_user_id::TEXT THEN
    RAISE EXCEPTION 'Private MCP client access denied';
  END IF;
  -- Intentionally not a database role: PostgREST cannot SET ROLE to this
  -- identity. MCP tokens must not inherit the owner's direct REST/RPC powers.
  -- Do not create/grant this role to authenticator.
  claims := claims || jsonb_build_object(
    'aud',client.resource_url,'role','loftdesk_mcp_only','client_id',oauth_client,
    'scope','email','loftdesk_mcp',TRUE,
    'loftdesk_company_id',settings.company_id,
    'loftdesk_mcp_version',client.token_version,
    'loftdesk_mcp_write',client.allow_write
  );
  claims := jsonb_set(claims,'{exp}',to_jsonb(LEAST((claims->>'exp')::BIGINT,extract(epoch FROM now())::BIGINT+900)));
  RETURN jsonb_set(event,'{claims}',claims);
END $$;
REVOKE ALL ON FUNCTION public.private_mcp_access_token_hook(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_mcp_access_token_hook(JSONB) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
