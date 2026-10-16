-- Native unsigned contracts use the existing form's columns. No signing,
-- portal sharing, invoice generation or external messages are performed.
SET lock_timeout = '5s';
SET statement_timeout = '45s';
ALTER TABLE public.automation_jobs DROP CONSTRAINT automation_jobs_kind_check;
ALTER TABLE public.automation_jobs ADD CONSTRAINT automation_jobs_kind_check
 CHECK (kind IN ('estimate.draft','note.add','gmail.sync','gmail.draft','client.create','project.create','estimate.assign','contract.draft'));

CREATE OR REPLACE FUNCTION public.private_prepare_contract_draft(p_company_id UUID,p_key TEXT,p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 owner_id UUID; queued JSONB; job public.automation_jobs; estimate public.cost_estimates;
 document_id UUID; document_number TEXT; tranche JSONB; paragraph JSONB;
 schedule JSONB := COALESCE(p_payload->'tranches','[]'::JSONB);
 paragraphs JSONB := COALESCE(p_payload->'custom_paragraphs','[]'::JSONB);
 schedule_total NUMERIC := 0; rate NUMERIC; client_patch JSONB;
BEGIN
 SELECT owner_user_id INTO owner_id FROM public.private_app_settings
 WHERE singleton AND (enabled OR mcp_enabled) AND company_id=p_company_id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Private owner/company is not configured'; END IF;
 queued := public.private_enqueue_job(p_company_id,'contract.draft',p_key,p_payload);
 SELECT * INTO job FROM public.automation_jobs WHERE id=(queued->>'id')::UUID FOR UPDATE;
 IF job.status='done' THEN RETURN jsonb_build_object('id',job.id,'status','done','result',job.result); END IF;
 IF job.status<>'queued' THEN RAISE EXCEPTION 'Contract job is not ready'; END IF;
 SELECT * INTO estimate FROM public.cost_estimates
 WHERE id=(p_payload->>'estimate_id')::UUID AND company_id=p_company_id FOR UPDATE;
 IF estimate.id IS NULL OR estimate.client_id IS NULL THEN RAISE EXCEPTION 'A scoped estimate with a client is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=estimate.client_id AND company_id=p_company_id) THEN RAISE EXCEPTION 'Invalid client scope'; END IF;
 IF estimate.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=estimate.project_id AND company_id=p_company_id AND client_id=estimate.client_id) THEN RAISE EXCEPTION 'Invalid project scope'; END IF;
 IF EXISTS(SELECT 1 FROM public.contracts WHERE company_id=p_company_id AND estimate_id=estimate.id) THEN RAISE EXCEPTION 'This estimate already has a contract; edit the existing contract'; END IF;
 rate := (p_payload->>'vat_rate')::NUMERIC;
 IF rate IS NULL OR rate NOT IN (0,5,8,23) OR estimate.total_net IS NULL OR estimate.total_net<0 OR estimate.total_gross IS NULL OR estimate.total_gross<>round(estimate.total_net*(1+rate/100),2) THEN RAISE EXCEPTION 'Contract totals must match the estimate'; END IF;
 IF COALESCE(length(trim(p_payload->>'location')),0)=0 THEN RAISE EXCEPTION 'Work location is required'; END IF;
 IF NULLIF(p_payload->>'start_date','')::DATE > NULLIF(p_payload->>'end_date','')::DATE THEN RAISE EXCEPTION 'Invalid work dates'; END IF;
 IF jsonb_typeof(schedule)<>'array' OR jsonb_array_length(schedule)>9 THEN RAISE EXCEPTION 'Invalid payment schedule'; END IF;
 FOR tranche IN SELECT * FROM jsonb_array_elements(schedule) LOOP
  IF COALESCE(length(trim(tranche->>'id')),0)=0 OR COALESCE(length(trim(tranche->>'label')),0)=0 OR tranche->>'amount' IS NULL OR (tranche->>'amount')::NUMERIC<0 OR (tranche->>'amount')::NUMERIC<>round((tranche->>'amount')::NUMERIC,2) OR tranche->>'status' IS DISTINCT FROM 'planned' THEN RAISE EXCEPTION 'Invalid draft tranche'; END IF;
  IF tranche ? 'percent' AND ((tranche->>'percent')::NUMERIC<0 OR (tranche->>'percent')::NUMERIC>100) THEN RAISE EXCEPTION 'Invalid tranche percentage'; END IF;
  PERFORM NULLIF(tranche->>'due_date','')::DATE;
  schedule_total := schedule_total + (tranche->>'amount')::NUMERIC;
 END LOOP;
 IF jsonb_array_length(schedule)>0 AND schedule_total<>estimate.total_gross THEN RAISE EXCEPTION 'Tranches must sum to contract gross'; END IF;
 IF jsonb_typeof(paragraphs)<>'array' OR jsonb_array_length(paragraphs)>30 THEN RAISE EXCEPTION 'Invalid additional paragraphs'; END IF;
 FOR paragraph IN SELECT * FROM jsonb_array_elements(paragraphs) LOOP
  IF COALESCE(length(trim(paragraph->>'id')),0)=0 OR COALESCE(length(trim(paragraph->>'title')),0)=0 OR COALESCE(length(trim(paragraph->>'content')),0)=0 OR length(paragraph->>'content')>20000 THEN RAISE EXCEPTION 'Invalid additional paragraph'; END IF;
 END LOOP;
 client_patch := COALESCE(p_payload->'client_details','{}'::JSONB);
 IF jsonb_typeof(client_patch)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(client_patch) AS k WHERE k NOT IN ('name','address','postal_code','city','email','phone','pesel')) THEN RAISE EXCEPTION 'Invalid client fields'; END IF;
 IF client_patch<>'{}'::JSONB THEN
  UPDATE public.clients SET
   name=COALESCE(client_patch->>'name',name),address=COALESCE(client_patch->>'address',address),
   postal_code=COALESCE(client_patch->>'postal_code',postal_code),city=COALESCE(client_patch->>'city',city),
   email=COALESCE(client_patch->>'email',email),phone=COALESCE(client_patch->>'phone',phone),pesel=COALESCE(client_patch->>'pesel',pesel)
  WHERE id=estimate.client_id AND company_id=p_company_id;
 END IF;
 document_number := public.next_doc_number(p_company_id,'contract',CURRENT_DATE);
 INSERT INTO public.contracts(company_id,user_id,number,client_id,project_id,estimate_id,status,
  sign_date,start_date,end_date,location,value,value_net,vat_rate,notes,template_name,template_content,tranches,custom_paragraphs)
 VALUES(p_company_id,owner_id,document_number,estimate.client_id,estimate.project_id,estimate.id,'unsigned',
  NULL,NULLIF(p_payload->>'start_date','')::DATE,NULLIF(p_payload->>'end_date','')::DATE,p_payload->>'location',
  estimate.total_gross,estimate.total_net,rate,p_payload->>'notes',COALESCE(p_payload->>'template_name','Umowa · '||estimate.number),'',schedule,paragraphs)
 RETURNING id INTO document_id;
 UPDATE public.automation_jobs SET status='done',result=jsonb_build_object('document_id',document_id,'number',document_number),updated_at=now() WHERE id=job.id;
 RETURN jsonb_build_object('id',job.id,'status','done','result',jsonb_build_object('document_id',document_id,'number',document_number));
END $$;
REVOKE ALL ON FUNCTION public.private_prepare_contract_draft(UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_prepare_contract_draft(UUID,TEXT,JSONB) TO service_role;
