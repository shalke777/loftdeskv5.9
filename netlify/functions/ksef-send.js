/**
 * Netlify function: ksef-send
 * Proxy for sending FA(2) invoice XML to KSeF /online/Invoice/Send
 */
const fetch = require('node-fetch')
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

  const { sessionToken, xmlPayload, invoiceNumber, env = 'test' } = body
  if (!sessionToken || !xmlPayload) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_fields' }) }
  }

  const base = BASE[env] || BASE.test

  try {
    const res = await fetch(`${base}/online/Invoice/Send`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        accept: 'application/json',
        SessionToken: sessionToken,
      },
      body: Buffer.from(xmlPayload, 'utf8'),
    })
    const result = await res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error:
            result.exception?.exceptionDetailList?.[0]?.exceptionCode || 'send_failed',
          details: result,
        }),
      }
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ksefRef: result.elementReferenceNumber, invoiceNumber }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = detail.includes('fetch') || detail.includes('ECONNREFUSED') || detail.includes('ENOTFOUND')
      ? `Nie można połączyć się z serwerem KSeF (${detail}). Serwer MF może być chwilowo niedostępny.`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
