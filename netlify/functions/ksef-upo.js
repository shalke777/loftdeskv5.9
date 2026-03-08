/**
 * Netlify function: ksef-upo
 * Proxy for fetching UPO (Urzędowe Poświadczenie Odbioru) for a sent invoice.
 * KSeF endpoint: GET /api/online/Invoice/{ksefReferenceNumber}/UPO
 */
const { ksefFetch } = require('./ksef-http')
const BASE = {
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

  const { ksefRef, sessionToken, env = 'test' } = body
  if (!ksefRef || !sessionToken) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_fields' }) }
  }

  const base = BASE[env] || BASE.test

  try {
    const res = await ksefFetch(
      `${base}/online/Invoice/${encodeURIComponent(ksefRef)}/UPO`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          SessionToken: sessionToken,
        },
      },
    )
    if (!res.ok) {
      let err = {}
      try { err = res.json() } catch {}
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error:
            err.exception?.exceptionDetailList?.[0]?.exceptionCode || 'upo_fetch_failed',
          details: err,
        }),
      }
    }
    const result = res.json()
    return { statusCode: 200, headers, body: JSON.stringify(result) }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = detail.includes('fetch') || detail.includes('ECONNREFUSED') || detail.includes('ENOTFOUND')
      ? `Nie można połączyć się z serwerem KSeF (${detail}). Serwer MF może być chwilowo niedostępny.`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
