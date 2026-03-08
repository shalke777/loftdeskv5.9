/**
 * Netlify function: ksef-upo
 * KSeF MF API — fetch invoice status and UPO data.
 *
 * Endpoint: GET /common/Invoice/{KsefReferenceNumber}/status
 * Returns invoice status including UPO details.
 *
 * Input:  { ksefRef, sessionToken, env }
 * Output: { ksefReferenceNumber, invoiceReferenceNumber, acquisitionTimestamp,
 *           hashSHA, upoDownloadUrl?, statusCode, statusDescription }
 */
const { ksefFetch } = require('./ksef-http')

const BASE = {
  demo: 'https://ksef-demo.mf.gov.pl/api',
  test: 'https://ksef-test.mf.gov.pl/api',
  prod: 'https://ksef.mf.gov.pl/api',
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

  const { ksefRef, sessionToken, accessToken, env = 'test' } = body
  const token = sessionToken || accessToken
  if (!ksefRef || !token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak numeru referencyjnego lub tokena sesji.' }) }
  }

  // Clean the ksefRef — if legacy format "sessionRef|invoiceRef", use invoiceRef part
  const refToQuery = ksefRef.includes('|') ? ksefRef.split('|')[1] : ksefRef
  const base = BASE[env] || BASE.test

  try {
    const res = await ksefFetch(
      `${base}/common/Invoice/${encodeURIComponent(refToQuery)}/status`,
      {
        method: 'GET',
        headers: { SessionToken: token },
      },
    )
    const data = res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: data.exception?.exceptionDetailList?.[0]?.exceptionDescription || data.title || data.message || 'Nie udało się pobrać UPO z KSeF.',
          details: data,
        }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ksefReferenceNumber: data.ksefNumber || refToQuery,
        invoiceReferenceNumber: data.invoiceNumber || refToQuery,
        acquisitionTimestamp: data.acquisitionDate || data.invoicingDate || null,
        hashSHA: data.invoiceHash || null,
        upoDownloadUrl: data.upoDownloadUrl || null,
        statusCode: data.status?.code ?? null,
        statusDescription: data.status?.description || null,
      }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = /ECONNREFUSED|ENOTFOUND|Timeout|nie można|socket hang up|ECONNRESET/i.test(detail)
      ? `Nie można połączyć się z serwerem KSeF. ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
