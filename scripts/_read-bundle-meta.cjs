#!/usr/bin/env node
// _read-bundle-meta.cjs
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const env = {}
fs.readFileSync('.env','utf8').split('\n').forEach(l => {
  const eq = l.indexOf('=')
  if (eq > 0) env[l.slice(0,eq).trim()] = l.slice(eq+1).trim().replace(/^['"]|['"]$/g,'')
})
const sb = createClient(env.SUPABASE_URL||env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
async function run() {
  const {data:a, error} = await sb.from('ai_bundle_assets')
    .select('id,bundle_id,company_id,project_id,source_role,room_hint,layer_type,original_filename,storage_path')
    .eq('id','89f5dfa5-9e13-4dbe-bcf0-66ca63af440f').single()
  if (error) { console.error(error.message); process.exit(1) }
  console.log('ASSET:', JSON.stringify(a, null, 2))
  const {data:b} = await sb.from('ai_bundles')
    .select('id,company_id,project_id,document_type,status').eq('id',a.bundle_id).single()
  console.log('BUNDLE:', JSON.stringify(b, null, 2))
}
run().catch(e => { console.error(e.message); process.exit(1) })
