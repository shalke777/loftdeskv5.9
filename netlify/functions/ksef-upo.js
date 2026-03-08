/**
 * Netlify function: ksef-upo
 * KSeF API v2 — fetch invoice status and UPO data.
 *
 * The ksefRef field uses format "sessionRef|invoiceRef" (set by ksef-send).
 * Endpoint: GET /sessions/{sessionRef}/invoices/{invoiceRef}
 * Returns invoice status including ksefNumber, acquisitionDate, invoiceHash,
 * and optionally upoDownloadUrl (pre-signed, no auth required).
 *
 * Input:  { ksefRef, accessToken, env }
 * Output: { ksefReferenceNumber, invoiceReferenceNumber, acquisitionTimestamp,
 *           hashSHA, upoDownloadUrl?, statusCode, statusDescription }
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

  const { ksefRef, accessToken, env = 'test' } = body
  if (!ksefRef || !accessToken) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_fields' }) }
  }

  // v2 ksefRef = "sessionRef|invoiceRef"
  // v1 (legacy) ksefRef has no pipe separator — return graceful info
  if (!ksefRef.includes('|')) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ksefReferenceNumber: ksefRef,
        invoiceReferenceNumber: ksefRef,
        acquisitionTimestamp: null,
        hashSHA: null,
        statusCode: null,
        statusDescription: 'UPO niedostępne dla faktur wysłanych w starszym formacie (sprzed aktualizacji API).',
      }),
    }
  }

  const [sessionRef, invoiceRef] = ksefRef.split('|')
  const base = BASE[env] || BASE.test

  try {
    const res = await ksefFetch(
      `${base}/sessions/${encodeURIComponent(sessionRef)}/invoices/${encodeURIComponent(invoiceRef)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    const data = res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: data.title || data.exception?.exceptionDetailList?.[0]?.exceptionCode || 'upo_fetch_failed',
          details: data,
        }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ksefReferenceNumber: data.ksefNumber || invoiceRef,
        invoiceReferenceNumber: data.invoiceNumber || invoiceRef,
        acquisitionTimestamp: data.acquisitionDate || data.invoicingDate || null,
        hashSHA: data.invoiceHash || null,
        upoDownloadUrl: data.upoDownloadUrl || null,
        statusCode: data.status?.code ?? null,
        statusDescription: data.status?.description || null,
      }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = /ECONNREFUSED|ENOTFOUND|Timeout/.test(detail)
      ? `Nie można połączyć się z serwerem KSeF: ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
