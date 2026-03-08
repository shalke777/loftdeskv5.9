/**
 * Netlify function: ksef-receive
 * KSeF API v2 — query received invoice metadata.
 *
 * Endpoint: POST /invoices/query/metadata
 * Returns the last 30 days of invoices accessible in the auth context.
 *
 * Input:  { accessToken, env, pageSize?, pageOffset? }
 * Output: { documents: KsefReceivedDoc[], total: number }
 */
const { ksefFetch } = require('./ksef-http')

const BASE = {
  test: 'https://api-test.ksef.mf.gov.pl/v2',
  prod: 'https://api.ksef.mf.gov.pl/v2',
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) }
  }

  const { accessToken, env = 'test', pageSize = 50, pageOffset = 0 } = body
  if (!accessToken) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_access_token' }) }
  }

  const base = BASE[env] || BASE.test
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Query invoice metadata for last 30 days
    const res = await ksefFetch(
      `${base}/invoices/query/metadata?pageOffset=${pageOffset}&pageSize=${Math.min(pageSize, 250)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          acquisitionTimestampFrom: from,
        }),
      },
    )
    const result = res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: result.title || result.exception?.exceptionDetailList?.[0]?.exceptionCode || 'receive_failed',
          details: result,
        }),
      }
    }

    // Map v2 metadata items to KsefReceivedDoc shape
    const items = result.invoicesInfo || result.invoices || result.items || []
    const documents = items.map((inv) => ({
      ksefRef: inv.ksefReferenceNumber || inv.ksefNumber || '',
      invoiceNumber: inv.invoiceNumber || inv.number || '—',
      issuerNip: inv.sellerNip || inv.seller?.nip || inv.subject1?.nip || '',
      issueDate: inv.issueDate || inv.invoicingDate || '',
      receivedAt: inv.acquisitionDate || inv.permanentStorageDate || new Date().toISOString(),
      grossAmount: Number(inv.grossValuePln ?? inv.grossValue ?? inv.p15 ?? 0),
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ documents, total: result.count ?? documents.length }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = /ECONNREFUSED|ENOTFOUND|Timeout/.test(detail)
      ? `Nie można połączyć się z serwerem KSeF: ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
