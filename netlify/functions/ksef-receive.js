/**
 * Netlify function: ksef-receive
 * Proxy for receiving invoice documents from KSeF /online/Query/Invoice/Sync
 * Returns documents issued in the last 30 days.
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

  const { nip, sessionToken, env = 'test', pageSize = 50, pageOffset = 0 } = body
  if (!sessionToken) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_session_token' }) }
  }

  const base = BASE[env] || BASE.test
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const res = await fetch(`${base}/online/Query/Invoice/Sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        SessionToken: sessionToken,
      },
      body: JSON.stringify({
        queryCriteria: {
          subjectBy: {
            issuedBySubject: { identifier: { type: 'onip', identifier: nip || '' } },
          },
          acquisitionTimestampThresholdFrom: from,
        },
        size: pageSize,
        offset: pageOffset,
      }),
    })
    const result = await res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error:
            result.exception?.exceptionDetailList?.[0]?.exceptionCode || 'receive_failed',
          details: result,
        }),
      }
    }

    const documents = (result.invoiceHeaderList || []).map((inv) => ({
      ksefRef: inv.ksefReferenceNumber || '',
      invoiceNumber: inv.invoiceReferenceNumber || '—',
      issuerNip: inv.subjectBy?.issuedBySubject?.identifier?.identifier || nip || '',
      issueDate: inv.invoicingDate || '',
      receivedAt: new Date().toISOString(),
      grossAmount: inv.gross || inv.net || 0,
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ documents, total: result.numberOfElements || documents.length }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = detail.includes('fetch') || detail.includes('ECONNREFUSED') || detail.includes('ENOTFOUND')
      ? `Nie można połączyć się z serwerem KSeF (${detail}). Serwer MF może być chwilowo niedostępny.`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
