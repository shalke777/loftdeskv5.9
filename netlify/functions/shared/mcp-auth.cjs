const { createRemoteJWKSet, jwtVerify } = require('jose')
const { privateContext, mcpContext, checked } = require('./private-runtime.cjs')
const { secretMatches } = require('./private-owner.cjs')
let keySet
let keySetUrl
function config() {
  const resource = new URL(process.env.LOFTDESK_MCP_RESOURCE_URL || 'https://loftdesk.pl/api/assistant/mcp')
  const issuer = new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  if (resource.protocol !== 'https:' || resource.pathname !== '/api/assistant/mcp' || resource.search || resource.hash || resource.username || resource.password) throw new Error('Invalid MCP resource configuration')
  if (issuer.protocol !== 'https:' || issuer.pathname !== '/' || issuer.search || issuer.hash || issuer.username || issuer.password) throw new Error('Invalid OAuth issuer configuration')
  return { resource: resource.href, issuer: `${issuer.origin}/auth/v1`, metadata: `${resource.origin}/.well-known/oauth-protected-resource/api/assistant/mcp` }
}
function challenge(error) {
  const c = config()
  return `Bearer resource_metadata="${c.metadata}"${error ? ', error="invalid_token"' : ''}, scope="email"`
}
function metadata() {
  const c = config()
  return { resource: c.resource, authorization_servers: [c.issuer], bearer_methods_supported: ['header'], scopes_supported: ['email'], resource_name: 'Prywatny LoftDesk' }
}
async function authenticate(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || ''
  const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1]
  if (!token || token.length > 16000) throw new Error('Authentication required')
  // Explicit compatibility switch for local/admin clients only. ChatGPT uses OAuth.
  if (process.env.LOFTDESK_MCP_ALLOW_STATIC_TOKEN === 'true' && secretMatches(token,process.env.LOFTDESK_ASSISTANT_TOKEN)) {
    return { ...await privateContext(), canWrite:true, clientId:'static-admin' }
  }
  const c = config()
  const jwksUrl = `${c.issuer}/.well-known/jwks.json`
  if (!keySet || keySetUrl !== jwksUrl) {
    keySet = createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration:5000, cooldownDuration:30000 })
    keySetUrl = jwksUrl
  }
  const {payload} = await jwtVerify(token,keySet,{issuer:c.issuer,audience:c.resource,algorithms:['ES256','RS256'],requiredClaims:['exp','iat','sub','client_id'],clockTolerance:5})
  if (payload.loftdesk_mcp !== true || payload.role !== 'loftdesk_mcp_only' || typeof payload.client_id !== 'string' || !payload.scope?.split?.(' ').includes('email')) throw new Error('Wrong MCP token')
  const ctx = await mcpContext()
  if (payload.sub !== ctx.ownerId || payload.loftdesk_company_id !== ctx.companyId) throw new Error('Owner access required')
  const client = await checked(ctx.sb.from('private_mcp_clients').select('enabled,allow_write,resource_url,token_version').eq('client_id',payload.client_id).maybeSingle())
  if (!client?.enabled || client.resource_url !== c.resource || client.token_version !== payload.loftdesk_mcp_version) throw new Error('MCP grant revoked')
  return {...ctx,clientId:payload.client_id,canWrite:client.allow_write && payload.loftdesk_mcp_write === true}
}
module.exports = {config,challenge,metadata,authenticate}
