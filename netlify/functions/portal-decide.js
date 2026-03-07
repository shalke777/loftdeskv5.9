const { createClient } = require('@supabase/supabase-js')

const sb = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'method_not_allowed' }) }

  const token = event.queryStringParameters?.token
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_token' }) }

  try {
    const body = JSON.parse(event.body || '{}')
    const decision = body.decision
    if (decision !== 'accepted' && decision !== 'rejected') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_decision' }) }
    }

    const client = sb()
    const { data: tok, error } = await client
      .from('client_tokens')
      .select('*')
      .eq('token', token)
      .eq('active', true)
      .single()

    if (error || !tok) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not_found' }) }
    if (new Date(tok.expires_at) < new Date()) return { statusCode: 410, headers, body: JSON.stringify({ error: 'expired' }) }

    const { error: updateError } = await client
      .from('cost_estimates')
      .update({ status: decision })
      .eq('id', tok.cost_estimate_id)

    if (updateError) throw updateError

    // Also log a system message about the decision
    await client.from('portal_messages').insert({
      token_id: tok.id,
      sender: 'client',
      content: decision === 'accepted' ? '✅ Klient zaakceptował kosztorys' : '❌ Klient odrzucił kosztorys',
      read: false,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, status: decision }) }
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_error', detail: e.message }) }
  }
}
