/**
 * Netlify function: ksef-upo
 * KSeF MF API v2 — fetch invoice status and UPO data from a session.
 *
 * Endpoint: GET /sessions/{referenceNumber}/invoices (list with UPO URLs)
 * Auth: Bearer JWT token
 *
 * Input:  { ksefRef, sessionToken (JWT), referenceNumber (session ref), env }
 * Output: { ksefReferenceNumber, invoiceReferenceNumber, acquisitionTimestamp,
 *           hashSHA, upoDownloadUrl?, statusCode, statusDescription }
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

  const { ksefRef, sessionToken, accessToken, referenceNumber, env = 'test' } = body
  const token = sessionToken || accessToken
  if (!ksefRef || !token || !referenceNumber) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak numeru referencyjnego faktury, tokena sesji lub numeru referencyjnego sesji.' }) }
  }

  const base = BASE[env] || BASE.test

  try {
    // Get session invoices list to find UPO info for the specific invoice
    const res = await ksefFetch(
      `${base}/sessions/${encodeURIComponent(referenceNumber)}/invoices?pageSize=1000`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    const data = res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: data.exception?.exceptionDescription || data.title || data.message || 'Nie udało się pobrać UPO z KSeF.',
          details: data,
        }),
      }
    }

    // Find the specific invoice by ksefNumber or invoice referenceNumber
    const invoices = data.invoices || []
    const invoice = invoices.find(
      (inv) => inv.ksefNumber === ksefRef || inv.referenceNumber === ksefRef,
    )

    if (!invoice) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Nie znaleziono faktury ${ksefRef} w sesji ${referenceNumber}.` }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ksefReferenceNumber: invoice.ksefNumber || ksefRef,
        invoiceReferenceNumber: invoice.invoiceNumber || ksefRef,
        acquisitionTimestamp: invoice.acquisitionDate || invoice.invoicingDate || null,
        hashSHA: invoice.invoiceHash || null,
        upoDownloadUrl: invoice.upoDownloadUrl || null,
        statusCode: invoice.status?.code ?? null,
        statusDescription: invoice.status?.description || null,
      }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const isConnectionError = /ECONNREFUSED|ENOTFOUND|Timeout|nie można|socket hang up|ECONNRESET|503|502/i.test(detail)

    if (isConnectionError && env !== 'prod') {
      console.warn(`[ksef-upo] Connection failed (${env}), falling back to mock:`, detail)
      const mock = mockApi.fetchUpo(ksefRef);
      return { statusCode: 200, headers, body: JSON.stringify(mock.body) };
    }

    const friendly = isConnectionError
      ? `Nie można połączyć się z serwerem KSeF. ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
