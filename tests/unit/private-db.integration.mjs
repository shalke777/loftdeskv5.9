// Uses an actual PostgreSQL engine via PGlite; set PGLITE_MODULE to its local module path.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_auth_admin;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::UUID $$;
 CREATE TABLE companies(id UUID PRIMARY KEY);
 CREATE TABLE company_members(user_id UUID,company_id UUID,role TEXT);
 CREATE TABLE clients(id UUID PRIMARY KEY,company_id UUID,name TEXT);
 ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
 CREATE POLICY base ON clients FOR SELECT TO authenticated USING(TRUE);
 GRANT SELECT ON clients TO authenticated;
 CREATE TABLE projects(id UUID PRIMARY KEY,company_id UUID);
 CREATE TABLE cost_estimates(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),company_id UUID,user_id UUID NOT NULL REFERENCES auth.users(id),client_id UUID,project_id UUID,number TEXT,name TEXT,status TEXT,total_net NUMERIC,total_gross NUMERIC,notes TEXT);
 CREATE TABLE cost_estimate_items(id UUID DEFAULT gen_random_uuid(),cost_estimate_id UUID NOT NULL REFERENCES cost_estimates(id),description TEXT NOT NULL,name TEXT,unit TEXT,quantity NUMERIC,unit_price NUMERIC,vat_rate NUMERIC,sort_order INT);
 CREATE TABLE operator_notifications(id UUID DEFAULT gen_random_uuid(),company_id UUID,type TEXT,title TEXT,body TEXT,reference_id UUID);
 CREATE TABLE invoices(id UUID PRIMARY KEY,company_id UUID);
 CREATE SCHEMA storage; CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit BIGINT);
 CREATE TABLE storage.objects(bucket_id TEXT,name TEXT);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(TEXT) RETURNS TEXT[] LANGUAGE SQL AS $$SELECT string_to_array($1,'/')$$;
 CREATE SEQUENCE doc_counter;
 CREATE FUNCTION next_doc_number(UUID,TEXT,DATE) RETURNS TEXT LANGUAGE SQL AS $$ SELECT 'WY/'||nextval('doc_counter') $$;
 CREATE FUNCTION my_company_id() RETURNS UUID LANGUAGE SQL AS $$ SELECT '00000000-0000-0000-0000-000000000002'::UUID $$;
 INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
 INSERT INTO companies VALUES('00000000-0000-0000-0000-000000000002');
 INSERT INTO clients VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Client');
`)
for(const file of ['170_private_app_access.sql','171_private_automation.sql','172_automation_notifications.sql','173_private_ksef_worker.sql','174_private_mcp_oauth.sql'])await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'))
const company='00000000-0000-0000-0000-000000000002'
await db.query('UPDATE private_app_settings SET enabled=true,owner_user_id=$1,company_id=$2',['00000000-0000-0000-0000-000000000001',company])
const enqueue=async(kind,key,payload)=>(await db.query('SELECT private_enqueue_job($1,$2,$3,$4) AS job',[company,kind,key,payload])).rows[0].job
const payload={name:'Offer',items:[{name:'Stage 1',quantity:1,unit_price:0.03,vat_rate:23},{name:'Stage 2',quantity:1,unit_price:0.03,vat_rate:23}]}
const first=await enqueue('estimate.draft','estimate/test/1',payload)
assert.equal((await enqueue('estimate.draft','estimate/test/1',payload)).id,first.id)
await assert.rejects(enqueue('estimate.draft','estimate/test/1',{...payload,name:'Different'}))
let job=(await db.query('SELECT * FROM private_claim_job($1)',[company])).rows[0]
await db.query('SELECT private_execute_db_job($1,$2)',[job.id,job.lease_id])
await db.query('SELECT private_execute_db_job($1,$2)',[job.id,job.lease_id])
let docs=(await db.query('SELECT * FROM cost_estimates')).rows
assert.equal(docs.length,1)
assert.equal((await db.query("SELECT * FROM operator_notifications WHERE type='automation'")).rows.length,1)
assert.equal(Number(docs[0].total_net),0.06)
assert.equal(Number(docs[0].total_gross),0.08)
assert.equal(docs[0].user_id,'00000000-0000-0000-0000-000000000001')
const lines=(await db.query('SELECT * FROM cost_estimate_items')).rows
assert.equal(lines.length,2)
assert.equal(lines[0].cost_estimate_id,docs[0].id)
assert.equal(lines[0].description,'Stage 1')
// A service worker must not create documents for another queued company.
const otherCompany='00000000-0000-0000-0000-000000000005'
await db.query('INSERT INTO companies VALUES($1)',[otherCompany])
const foreignJob=(await db.query('SELECT private_enqueue_job($1,$2,$3,$4) AS job',[otherCompany,'estimate.draft','estimate/foreign/1',payload])).rows[0].job
const foreignLease=(await db.query('SELECT * FROM private_claim_job($1)',[otherCompany])).rows[0]
await assert.rejects(db.query('SELECT private_execute_db_job($1,$2)',[foreignJob.id,foreignLease.lease_id]),/Private owner\/company is not configured/)
assert.equal((await db.query('SELECT * FROM cost_estimates')).rows.length,1)
await enqueue('estimate.draft','estimate/bad/1',{name:'Missing rows'})
job=(await db.query('SELECT * FROM private_claim_job($1)',[company])).rows[0]
await assert.rejects(db.query('SELECT private_execute_db_job($1,$2)',[job.id,job.lease_id]))
assert.equal((await db.query('SELECT * FROM cost_estimates')).rows.length,1)
await db.exec("UPDATE automation_jobs SET status='failed' WHERE status='running'")
await enqueue('gmail.draft','draft/unknown/1',{})
job=(await db.query('SELECT * FROM private_claim_job($1)',[company])).rows[0]
await db.query("UPDATE automation_jobs SET lease_until=now()-interval '1 minute' WHERE id=$1",[job.id])
await db.query('SELECT * FROM private_claim_job($1)',[company])
assert.equal((await db.query('SELECT status FROM automation_jobs WHERE id=$1',[job.id])).rows[0].status,'unknown')
await db.exec(`UPDATE private_app_settings SET enabled=true,owner_user_id='00000000-0000-0000-0000-000000000001',company_id='${company}'`)
await assert.rejects(db.exec("INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000004')"))
await db.exec("SET ROLE authenticated;SET test.uid='00000000-0000-0000-0000-000000000001'")
assert.equal((await db.query('SELECT * FROM clients')).rows.length,1)
await db.exec("SET test.uid='00000000-0000-0000-0000-000000000004'")
assert.equal((await db.query('SELECT * FROM clients')).rows.length,0)
await db.exec('RESET ROLE')
await db.query("INSERT INTO private_mcp_clients(client_id,resource_url,redirect_uris,enabled,allow_write) VALUES('chatgpt-client','https://loftdesk.pl/api/assistant/mcp',ARRAY['https://chatgpt.com/connector_platform_oauth_redirect'],true,true)")
const regular={claims:{sub:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}}
assert.deepEqual((await db.query('SELECT private_mcp_access_token_hook($1) AS result',[regular])).rows[0].result,regular)
const oauth={...regular,client_id:'chatgpt-client'}
const claims=(await db.query('SELECT private_mcp_access_token_hook($1) AS result',[oauth])).rows[0].result.claims
assert.equal(claims.aud,'https://loftdesk.pl/api/assistant/mcp')
assert.equal(claims.role,'loftdesk_mcp_only')
assert.equal(claims.loftdesk_mcp_write,true)
assert.equal(claims.loftdesk_company_id,company)
assert.ok(claims.exp<=Math.floor(Date.now()/1000)+901)
await assert.rejects(db.query('SELECT private_mcp_access_token_hook($1)',[{...oauth,client_id:'unregistered'}]))
await assert.rejects(db.query('SELECT private_mcp_access_token_hook($1)',[{...oauth,claims:{...regular.claims,sub:'00000000-0000-0000-0000-000000000004'}}]))
await db.exec("UPDATE private_mcp_clients SET enabled=false,token_version=token_version+1")
await assert.rejects(db.query('SELECT private_mcp_access_token_hook($1)',[oauth]))
await db.exec('SET ROLE authenticated')
await assert.rejects(db.query('SELECT * FROM private_mcp_clients'))
await db.exec('RESET ROLE')
await db.exec(readFileSync(new URL('../../scripts/private-access-audit.sql',import.meta.url),'utf8'))
// Preflight must work both with pending migrations and with the MCP schema present.
const preflight=readFileSync(new URL('../../scripts/mcp-database-preflight.sql',import.meta.url),'utf8')
let inventory=await db.exec(preflight)
let report=JSON.parse(inventory.find(result=>result.fields?.some(field=>field.name==='mcp_preflight')).rows[0].mcp_preflight)
assert.equal(report.mcp_database_role_must_be_absent,true)
assert.ok(report.missing_columns.some(column=>column.table_name==='clients' && column.column_name==='email'))
await db.exec('DROP TABLE private_mcp_clients CASCADE')
inventory=await db.exec(preflight)
report=JSON.parse(inventory.find(result=>result.fields?.some(field=>field.name==='mcp_preflight')).rows[0].mcp_preflight)
assert.ok(report.missing_columns.some(column=>column.table_name==='private_mcp_clients'))
await db.close()
console.log('PASS: migrations, idempotency, atomic draft creation, rollback, ambiguous-write recovery, signup gate and owner RLS')
