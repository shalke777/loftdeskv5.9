// Apply to all public API paths. Internal scheduled functions do not use these paths.
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  if (Netlify.env.get('LOFTDESK_PRIVATE_MODE') !== 'true') return context.next()
  const path = new URL(request.url).pathname
  if (request.method === 'OPTIONS') return context.next()
  // These routes authenticate their own signed state / integration token.
  if (['/api/assistant/mcp', '/.netlify/functions/assistant-mcp', '/.netlify/functions/gmail-oauth-callback'].includes(path)) return context.next()
  const owner = Netlify.env.get('LOFTDESK_OWNER_USER_ID')
  const url = Netlify.env.get('SUPABASE_URL') || Netlify.env.get('VITE_SUPABASE_URL')
  const key = Netlify.env.get('SUPABASE_ANON_KEY') || Netlify.env.get('VITE_SUPABASE_ANON_KEY')
  if (!owner || !url || !key) return Response.json({ error: 'Private access is not configured' }, { status: 503 })
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return Response.json({ error: 'Authentication required' }, { status: 401 })
  try {
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: auth } })
    if (!response.ok) return Response.json({ error: 'Invalid session' }, { status: 401 })
    const user = await response.json()
    if (user.id !== owner) return Response.json({ error: 'Owner access required' }, { status: 403 })
    return context.next()
  } catch {
    return Response.json({ error: 'Authentication unavailable' }, { status: 503 })
  }
}
