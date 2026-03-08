/**
 * Netlify function: ksef-send
 * KSeF API v2 — send a single invoice in an active online session.
 *
 * The invoice XML must be encrypted with AES-256-CBC (PKCS#7 padding) using the
 * symmetric key generated when the session was opened. SHA-256 hashes of both
 * the original and encrypted invoice are also required.
 *
 * Endpoint: POST /sessions/online/{sessionRef}/invoices
 *
 * Input:  { accessToken, sessionRef, symmetricKey (base64), iv (base64),
 *           xmlPayload (UTF-8 string), invoiceNumber, env }
 * Output: { ksefRef: "sessionRef|invoiceRef", invoiceNumber }
 */
const crypto = require('crypto')
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

  const { accessToken, sessionRef, symmetricKey, iv, xmlPayload, invoiceNumber, env = 'test' } = body
  if (!accessToken || !sessionRef || !symmetricKey || !iv || !xmlPayload) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_fields' }) }
  }

  const base = BASE[env] || BASE.test

  try {
    const xmlBuf = Buffer.from(xmlPayload, 'utf8')

    // SHA-256 of the original (plaintext) invoice XML
    const invoiceHash = crypto.createHash('sha256').update(xmlBuf).digest('base64')

    // Encrypt invoice XML with AES-256-CBC (PKCS#7 padding is default in Node crypto)
    const keyBuf = Buffer.from(symmetricKey, 'base64')
    const ivBuf = Buffer.from(iv, 'base64')
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, ivBuf)
    const encBuf = Buffer.concat([cipher.update(xmlBuf), cipher.final()])

    // SHA-256 of the encrypted content
    const encryptedInvoiceHash = crypto.createHash('sha256').update(encBuf).digest('base64')

    const res = await ksefFetch(
      `${base}/sessions/online/${encodeURIComponent(sessionRef)}/invoices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          invoiceHash,
          invoiceSize: xmlBuf.length,
          encryptedInvoiceHash,
          encryptedInvoiceSize: encBuf.length,
          encryptedInvoiceContent: encBuf.toString('base64'),
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
            result.exception?.exceptionDetailList?.[0]?.exceptionCode ||
            result.title ||
            'send_failed',
          details: result,
        }),
      }
    }

    // Store as "sessionRef|invoiceRef" so ksef-upo can resolve both parts later
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ksefRef: `${sessionRef}|${result.referenceNumber}`,
        invoiceNumber,
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
