// Isolated PostgreSQL rehearsal using catalog metadata; never contacts production.
// Snapshot contains schema metadata only, never user records or credentials.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
const snapshot=JSON.parse(readFileSync(process.argv[2],'utf8'))
const db=new PGlite()
const quote=value=>'"'+value.replaceAll('"','""')+'"'
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE supabase_auth_admin;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id UUID PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 CREATE FUNCTION public.uuid_generate_v4() RETURNS UUID LANGUAGE SQL AS $$SELECT gen_random_uuid()$$;
 CREATE FUNCTION public.my_company_id() RETURNS UUID LANGUAGE SQL AS $$SELECT nullif(current_setting('test.company',true),'')::uuid$$;`)
for(const table of snapshot.tables){
 const columns=table.columns.map(column=>{
  const generated=table.name==='voice_notes'&&column.name==='char_count'
  return `${quote(column.name)} ${column.type}${column.default?(generated?` GENERATED ALWAYS AS (${column.default}) STORED`:` DEFAULT ${column.default}`):''}${column.not_null?' NOT NULL':''}`
 })
 await db.exec(`CREATE TABLE public.${quote(table.name)} (${columns.join(',')});`)
 if(table.rls)await db.exec(`ALTER TABLE public.${quote(table.name)} ENABLE ROW LEVEL SECURITY`)
}
for(const table of snapshot.tables)for(const constraint of table.constraints||[])
 await db.exec(`ALTER TABLE public.${quote(table.name)} ADD CONSTRAINT ${quote(constraint.name)} ${constraint.ddl}`)
await db.exec(readFileSync(new URL('../supabase/migrations/118_next_doc_number_with_date_and_reset.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(process.argv[3],'utf8'))
assert.equal((await db.query('SELECT enabled FROM private_app_settings')).rows[0].enabled,false)
assert.equal((await db.query('SELECT private_app_access_allowed() AS allowed')).rows[0].allowed,true)
for(const role of ['anon','authenticated'])assert.equal((await db.query("SELECT has_function_privilege($1,'private_enqueue_job(uuid,text,text,jsonb)','EXECUTE') AS allowed",[role])).rows[0].allowed,false)
assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE policyname='private_owner_gate'")).rows[0].n,snapshot.tables.filter(t=>t.rls).length)
const owner='00000000-0000-0000-0000-000000000001'
const company='00000000-0000-0000-0000-000000000002'
await db.query('INSERT INTO auth.users VALUES($1)',[owner])
await db.query("INSERT INTO companies(id,name) VALUES($1,'Isolated schema rehearsal')",[company])
await db.query('UPDATE private_app_settings SET enabled=true,owner_user_id=$1,company_id=$2',[owner,company])
const payload={name:'Schema rehearsal',items:[{name:'Stage',quantity:2,unit_price:100,vat_rate:8}]}
const job=(await db.query('SELECT private_enqueue_job($1,$2,$3,$4) AS job',[company,'estimate.draft','schema-rehearsal-1',payload])).rows[0].job
const lease=(await db.query('SELECT * FROM private_claim_job($1)',[company])).rows[0]
await db.query('SELECT private_execute_db_job($1,$2)',[job.id,lease.lease_id])
const document=(await db.query('SELECT * FROM cost_estimates')).rows[0]
assert.equal(document.user_id,owner)
assert.equal(Number(document.total_gross),216)
const line=(await db.query('SELECT * FROM cost_estimate_items')).rows[0]
assert.equal(line.cost_estimate_id,document.id)
assert.equal(line.description,'Stage')
assert.equal((await db.query("SELECT count(*)::int AS n FROM operator_notifications WHERE type='automation'")).rows[0].n,1)
await db.query('UPDATE private_app_settings SET enabled=false')
// A separate clean foundation tests the before-activation revert without deleting data.
await db.exec('BEGIN')
await db.exec('DELETE FROM operator_notifications;DELETE FROM automation_jobs')
await db.exec(readFileSync(new URL('./mcp-foundation-revert.sql',import.meta.url),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''))
assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE policyname='private_owner_gate'")).rows[0].n,0)
await db.exec('ROLLBACK')
await db.close()
console.log(JSON.stringify({passed:true,tables:snapshot.tables.length,realCheckAndUniqueConstraints:true,providerServicesSimulated:true,productionModified:false}))
