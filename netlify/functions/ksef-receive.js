/**
 * Netlify function: ksef-receive
 * KSeF MF API v2 — query received invoice metadata.
 *
 * Endpoint: POST /invoices/query/metadata
 * Auth: Bearer JWT token
 * Returns the last 30 days of invoices accessible in the auth context.
 *
 * Input:  { sessionToken (JWT), env, pageSize?, pageOffset? }
 * Output: { documents: KsefReceivedDoc[], total: number }
 */
const { ksefFetch } = require('./ksef-http')
const { mockApi } = require('./ksef-mock')

const BASE = {
  demo: 'https://api-demo.ksef.mf.gov.pl/v2',
  test: 'https://api-test.ksef.mf.gov.pl/v2',
  prod: 'https://api.ksef.mf.gov.pl/v2',
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) }
  }

  const { sessionToken, accessToken, env = 'test', pageSize = 50, pageOffset = 0 } = body
  const token = sessionToken || accessToken
  if (!token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak tokena sesji.' }) }
  }

  const base = BASE[env] || BASE.test
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const to = new Date().toISOString()

  try {
    // Query invoice metadata (v2) — Subject2 = received invoices (buyer context)
    const url = `${base}/invoices/query/metadata?sortOrder=Desc&pageSize=${Math.min(pageSize, 250)}&pageOffset=${pageOffset}`
    const res = await ksefFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subjectType: 'Subject2',
        dateRange: {
          dateType: 'PermanentStorage',
          from,
          to,
        },
      }),
    })
    const result = res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: result.exception?.exceptionDescription || result.title || result.message || 'Nie udało się pobrać dokumentów z KSeF.',
          details: result,
        }),
      }
    }

    // Map v2 InvoiceMetadata items to KsefReceivedDoc shape
    const items = result.invoices || []
    const documents = items.map((inv) => ({
      ksefRef: inv.ksefNumber || '',
      invoiceNumber: inv.invoiceNumber || '—',
      issuerNip: inv.seller?.nip || '',
      issueDate: inv.issueDate || inv.invoicingDate || '',
      receivedAt: inv.acquisitionDate || inv.permanentStorageDate || new Date().toISOString(),
      grossAmount: Number(inv.grossAmount ?? 0),
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        documents,
        total: result.invoices?.length ?? documents.length,
        hasMore: result.hasMore ?? false,
      }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const isConnectionError = /ECONNREFUSED|ENOTFOUND|Timeout|nie można|socket hang up|ECONNRESET|503|502/i.test(detail)

    if (isConnectionError && env !== 'prod') {
      console.warn(`[ksef-receive] Connection failed (${env}), falling back to mock:`, detail)
      const mock = mockApi.receiveDocuments('');
      return { statusCode: 200, headers, body: JSON.stringify(mock.body) };
    }

    const friendly = isConnectionError
      ? `Nie można połączyć się z serwerem KSeF. ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
