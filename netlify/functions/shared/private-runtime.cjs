const { createClient } = require('@supabase/supabase-js')
const { privateOwnerAllowed } = require('./private-owner.cjs')
function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration missing')
  return createClient(url, key, { auth: { persistSession: false } })
}
async function privateContext() {
  if (process.env.LOFTDESK_PRIVATE_MODE !== 'true' || !process.env.LOFTDESK_OWNER_USER_ID || !process.env.LOFTDESK_COMPANY_ID) throw new Error('Private application is not configured')
  const sb = admin()
  const { data, error } = await sb.from('private_app_settings').select('enabled,owner_user_id,company_id').eq('singleton', true).single()
  if (error || !data?.enabled || data.owner_user_id !== process.env.LOFTDESK_OWNER_USER_ID || data.company_id !== process.env.LOFTDESK_COMPANY_ID) throw new Error('Private application settings mismatch')
  return { sb, companyId: data.company_id, ownerId: data.owner_user_id }
}
async function ownerContext(event) {
  const ctx = await privateContext()
  const auth = event.headers?.authorization || event.headers?.Authorization || ''
  const { data, error } = await ctx.sb.auth.getUser(auth.startsWith('Bearer ') ? auth.slice(7) : '')
  if (error || !data.user || !privateOwnerAllowed(data.user.id)) throw new Error('Owner authentication required')
  return ctx
}
async function checked(promise) { const { data, error } = await promise; if (error) throw error; return data }
function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id', 'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Protocol-Version', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: JSON.stringify(body) } }
module.exports = { privateContext, ownerContext, checked, json }
