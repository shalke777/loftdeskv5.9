// Uses an actual PostgreSQL engine via PGlite; set PGLITE_MODULE to its local module path.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::UUID $$;
 CREATE TABLE companies(id UUID PRIMARY KEY);
 CREATE TABLE clients(id UUID PRIMARY KEY,company_id UUID,name TEXT);
 ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
 CREATE POLICY base ON clients FOR SELECT TO authenticated USING(TRUE);
 GRANT SELECT ON clients TO authenticated;
 CREATE TABLE projects(id UUID PRIMARY KEY,company_id UUID);
 CREATE TABLE cost_estimates(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),company_id UUID,client_id UUID,project_id UUID,number TEXT,name TEXT,status TEXT,total_net NUMERIC,total_gross NUMERIC,notes TEXT);
 CREATE TABLE cost_estimate_items(id UUID DEFAULT gen_random_uuid(),estimate_id UUID,name TEXT,unit TEXT,quantity NUMERIC,unit_price NUMERIC,vat_rate NUMERIC,sort_order INT);
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
for(const file of ['170_private_app_access.sql','171_private_automation.sql','172_automation_notifications.sql','173_private_ksef_worker.sql'])await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'))
const company='00000000-0000-0000-0000-000000000002'
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
await db.close()
console.log('PASS: migrations, idempotency, atomic draft creation, rollback, ambiguous-write recovery, signup gate and owner RLS')
