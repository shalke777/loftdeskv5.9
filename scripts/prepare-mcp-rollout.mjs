// Produces a reviewable SQL package; never connects to or modifies a database.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root=fileURLToPath(new URL('../',import.meta.url))
const destination=process.argv[2]
if(!destination)throw new Error('Usage: node scripts/prepare-mcp-rollout.mjs <output.sql>')
const files=['170_private_app_access.sql','171_private_automation.sql','172_automation_notifications.sql','174_private_mcp_oauth.sql']
const sql=[
 '-- Private MCP foundation only. Does not activate OAuth, owner mode or workers.',
 '-- Requires reviewed backup, staging verification and production authorization.',
 'BEGIN;',
 "SET LOCAL lock_timeout = '5s';",
 "SET LOCAL statement_timeout = '45s';",
 ...files.map(name=>`-- SOURCE: ${name}\n${readFileSync(resolve(root,'supabase/migrations',name),'utf8')}`),
 "DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.private_app_settings WHERE enabled) THEN RAISE EXCEPTION 'Foundation must remain disabled'; END IF; END $$;",
 'COMMIT;',
].join('\n\n')+'\n'
writeFileSync(resolve(destination),sql,{mode:0o600})
console.log(JSON.stringify({file:resolve(destination),sources:files,sha256:createHash('sha256').update(sql).digest('hex'),activated:false}))
