/**
 * Netlify function: ksef-send
 * KSeF MF API — send a single invoice in an active online session.
 *
 * The invoice XML is sent as base64-encoded plaintext (or AES-encrypted for prod).
 * SHA-256 hash of the invoice XML is included in the payload.
 *
 * Endpoint: POST /online/Invoice/Send
 *
 * Input:  { sessionToken, xmlPayload (UTF-8 string), invoiceNumber, env }
 * Output: { ksefRef, invoiceNumber }
 */
const crypto = require('crypto')
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

  const { sessionToken, xmlPayload, invoiceNumber, env = 'test' } = body
  if (!sessionToken || !xmlPayload) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak tokena sesji lub treści faktury XML.' }) }
  }

  const base = BASE[env] || BASE.test

  try {
    const xmlBuf = Buffer.from(xmlPayload, 'utf8')

    // SHA-256 of the invoice XML
    const invoiceHash = crypto.createHash('sha256').update(xmlBuf).digest('base64')

    const res = await ksefFetch(
      `${base}/online/Invoice/Send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          SessionToken: sessionToken,
        },
        body: JSON.stringify({
          invoiceHash: {
            hashSHA: {
              algorithm: 'SHA-256',
              encoding: 'Base64',
              value: invoiceHash,
            },
            fileSize: xmlBuf.length,
          },
          invoicePayload: {
            type: 'plain',
            invoiceBody: xmlBuf.toString('base64'),
          },
        }),
      },
    )

    const result = res.json()
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error:
            result.exception?.exceptionDetailList?.[0]?.exceptionDescription ||
            result.exception?.exceptionDetailList?.[0]?.exceptionCode ||
            result.message ||
            'Nie udało się wysłać faktury do KSeF.',
          details: result,
        }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ksefRef: result.elementReferenceNumber || result.referenceNumber || '',
        invoiceNumber,
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
