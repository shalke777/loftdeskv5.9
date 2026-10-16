import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite()
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE private_app_settings(singleton boolean,enabled boolean,mcp_enabled boolean,owner_user_id uuid,company_id uuid);
CREATE TABLE automation_jobs(id uuid primary key default gen_random_uuid(),company_id uuid,kind text constraint automation_jobs_kind_check check(kind in ('estimate.draft','note.add','gmail.sync','gmail.draft')),payload jsonb,status text,lease_id uuid,lease_until timestamptz,result jsonb,updated_at timestamptz);
CREATE TABLE clients(id uuid primary key default gen_random_uuid(),company_id uuid,user_id uuid,name text,email text,phone text,city text,address text,postal_code text,contact_person text);
CREATE TABLE projects(id uuid primary key default gen_random_uuid(),company_id uuid,user_id uuid,client_id uuid,number text,name text,status text,address text,investment_address text,notes text,deleted_at timestamptz);
CREATE TABLE cost_estimates(id uuid primary key default gen_random_uuid(),company_id uuid,client_id uuid,project_id uuid,status text,total_gross numeric);
CREATE TABLE project_documents(company_id uuid,project_id uuid,doc_type text,doc_id uuid,assignment_status text,linked_manually boolean,archived_at timestamptz,unique(company_id,project_id,doc_type,doc_id));
`)
await db.exec(readFileSync('supabase/migrations/20261016102508_private_mcp_clients_projects.sql','utf8'))
const company='00000000-0000-0000-0000-000000000001',owner='00000000-0000-0000-0000-000000000002',foreign='00000000-0000-0000-0000-000000000003'
await db.query('insert into private_app_settings values(true,false,true,$1,$2)',[owner,company])
for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'private_execute_crm_job(uuid,uuid)','EXECUTE') allowed",[role])).rows[0].allowed,false)
async function job(kind,payload,scope=company){return (await db.query("insert into automation_jobs(company_id,kind,payload,status,lease_id,lease_until) values($1,$2,$3,'running',gen_random_uuid(),now()+interval '5 minutes') returning *",[scope,kind,payload])).rows[0]}
async function execute(j){return (await db.query('select private_execute_crm_job($1,$2) result',[j.id,j.lease_id])).rows[0].result}
const cj=await job('client.create',{name:'Megha',email:'MEGHA@example.com'})
const client=await execute(cj)
assert.deepEqual(await execute(cj),client)
assert.equal((await execute(await job('client.create',{name:'Other spelling',email:'megha@example.com'}))).client_id,client.client_id)
assert.equal((await db.query('select count(*)::int n from clients')).rows[0].n,1)
const estimate=(await db.query("insert into cost_estimates(company_id,status,total_gross) values($1,'draft',27930.96) returning id",[company])).rows[0].id
const pj=await job('project.create',{name:'Bathroom',client_id:client.client_id,estimate_id:estimate,investment_address:'Site'})
const project=await execute(pj)
assert.equal(project.number,'PRJ-001')
assert.equal((await execute(await job('project.create',{name:'Bathroom',client_id:client.client_id,investment_address:'Site'}))).project_id,project.project_id)
assert.equal((await db.query('select count(*)::int n from projects')).rows[0].n,1)
let row=(await db.query('select * from cost_estimates where id=$1',[estimate])).rows[0]
assert.equal(row.client_id,client.client_id);assert.equal(row.project_id,project.project_id);assert.equal(Number(row.total_gross),27930.96);assert.equal(row.status,'draft')
await execute(await job('estimate.assign',{project_id:project.project_id,estimate_id:estimate}))
assert.equal((await db.query('select count(*)::int n from project_documents')).rows[0].n,1)
const otherClient=(await db.query('insert into clients(company_id,name) values($1,$2) returning id',[foreign,'Other'])).rows[0].id
await assert.rejects(execute(await job('project.create',{name:'No',client_id:otherClient})),/Invalid client scope/)
await assert.rejects(execute(await job('client.create',{name:'No'},foreign)),/Private owner/)
const second=(await execute(await job('project.create',{name:'Second',client_id:client.client_id}))).project_id
await assert.rejects(execute(await job('estimate.assign',{project_id:second,estimate_id:estimate})),/Estimate project conflict/)
await db.query("update cost_estimates set status='sent' where id=$1",[estimate])
await assert.rejects(execute(await job('estimate.assign',{project_id:project.project_id,estimate_id:estimate})),/Draft estimate/)
const expired=await job('client.create',{name:'Expired'})
await db.query("update automation_jobs set lease_until=now()-interval '1 minute' where id=$1",[expired.id])
await assert.rejects(execute(expired),/Invalid job lease/)
const bad=await job('project.create',{name:'No',client_id:client.client_id,estimate_id:estimate})
await assert.rejects(execute(bad),/Draft estimate/)
assert.equal((await db.query('select count(*)::int n from projects')).rows[0].n,2)
console.log('CRM integration passed: retries, email deduplication, atomic links, numbering, scopes, draft-only, conflicts, lease expiry and service-only grants.')
await db.close()
