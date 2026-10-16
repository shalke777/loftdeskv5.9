-- Administrator-only inventory. Read-only; does not activate MCP or issue tokens.
-- Run before migrations and again afterwards. Missing objects are reported safely.
-- This is schema preparation, not approval to deploy or a full privacy audit.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH required(table_name, columns) AS (VALUES
 ('private_app_settings', 'singleton,enabled,owner_user_id,company_id'),
 ('private_mcp_clients', 'client_id,resource_url,redirect_uris,enabled,allow_write,token_version'),
 ('clients', 'id,company_id,name,email,phone,address,nip,created_at'),
 ('projects', 'id,company_id,name,number,client_id,status,address,notes,created_at'),
 ('cost_estimates', 'id,user_id,company_id,number,name,status,client_id,project_id,total_net,total_gross,created_at'),
 ('invoices', 'id,company_id,number,invoice_type,client_id,project_id,status,total_net,total_gross,due_date,ksef_status,ksef_number,ksef_last_error,created_at'),
 ('cost_estimate_items', 'cost_estimate_id,description,sort_order,name,unit,quantity,unit_price,vat_rate'),
 ('invoice_items', 'invoice_id,sort_order'),
 ('automation_inbox', 'id,company_id,provider_id,thread_id,sender,subject,body,received_at,attachment_metadata,status'),
 ('automation_jobs', 'id,company_id,kind,status,result,last_error,created_at'),
 ('assistant_notes', 'id,company_id,project_id,content,created_at')
), missing AS (
 SELECT r.table_name, col AS column_name
 FROM required r CROSS JOIN LATERAL unnest(string_to_array(r.columns, ',')) col
 WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=col)
), functions(signature) AS (VALUES
 ('public.private_mcp_access_token_hook(jsonb)'),
 ('public.private_enqueue_job(uuid,text,text,jsonb)'),
 ('public.private_claim_job(uuid)'),
 ('public.private_execute_db_job(uuid,uuid)'),
 ('public.next_doc_number(uuid,text,date)')
)
SELECT jsonb_pretty(jsonb_build_object(
 'schema_columns_ready', NOT EXISTS(SELECT 1 FROM missing),
 'owner_membership_candidates', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',user_id,'company_id',company_id,'role',role) ORDER BY user_id,company_id) FROM public.company_members WHERE role IN ('owner','admin')),'[]'::jsonb),
 'missing_columns', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.table_name,m.column_name) FROM missing m),'[]'::jsonb),
 'missing_functions', COALESCE((SELECT jsonb_agg(signature) FROM functions WHERE to_regprocedure(signature) IS NULL),'[]'::jsonb),
 'mcp_database_role_must_be_absent', to_regrole('loftdesk_mcp_only') IS NULL,
 'exposed_definer_functions', COALESCE((SELECT jsonb_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef AND
   (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))),'[]'::jsonb),
 'public_buckets', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM storage.buckets WHERE public),'[]'::jsonb),
 'remaining_checks', jsonb_build_array('Verify owner/company membership before provisioning',
   'Inspect existing access-token hook and signing algorithm in Auth settings',
   'Review exposed RPC implementations and storage policies with private-access-audit.sql',
   'Verify production backup and isolated staging migration',
   'Verify native OAuth issuance, refresh, revocation and direct REST/RPC/storage denial')
)) AS mcp_preflight;
ROLLBACK;
