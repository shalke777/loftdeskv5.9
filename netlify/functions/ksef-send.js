/**
 * Netlify function: ksef-send
 * KSeF MF API v2 — send a single invoice in an active online session.
 *
 * The invoice XML is AES-256-CBC encrypted with the session's symmetric key.
 * SHA-256 hashes of both plain and encrypted content are included in the payload.
 *
 * Endpoint: POST /sessions/online/{referenceNumber}/invoices
 * Auth: Bearer JWT token
 *
 * Input:  { sessionToken (JWT), xmlPayload (UTF-8), invoiceNumber, referenceNumber, symmetricKey, iv, env }
 * Output: { ksefRef, invoiceNumber }
 */
const crypto = require('crypto')
const { ksefFetch } = require('./ksef-http')
const { mockApi } = require('./ksef-mock')
const { requireKsefAccess } = require('./ksef-auth')

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

  // Plan gate: requires Pro+ plan and valid Supabase JWT
  const authResult = await requireKsefAccess(event)
  if (authResult.error) {
    return { statusCode: authResult.status, headers, body: JSON.stringify({ error: authResult.error, code: authResult.code, requiredPlan: authResult.requiredPlan }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) }
  }

  const { sessionToken, xmlPayload, invoiceNumber, referenceNumber, symmetricKey, iv, env = 'test' } = body
  if (!sessionToken || !xmlPayload || !referenceNumber) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak tokena sesji, numeru referencyjnego sesji lub treści faktury XML.' }) }
  }
  if (!symmetricKey || !iv) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak klucza szyfrującego (symmetricKey/iv). Otwórz nową sesję KSeF.' }) }
  }

  const base = BASE[env] || BASE.test

  console.log(`[ksef-send] START: env=${env} invoice=${invoiceNumber} ref=${referenceNumber?.slice(0,20)} token_len=${sessionToken?.length} xml_len=${xmlPayload?.length}`)

  try {
    const xmlBuf = Buffer.from(xmlPayload, 'utf8')

    // SHA-256 of the plain invoice XML
    const invoiceHash = crypto.createHash('sha256').update(xmlBuf).digest('base64')
    const invoiceSize = xmlBuf.length

    // AES-256-CBC encrypt the invoice
    const keyBuf = Buffer.from(symmetricKey, 'base64')
    const ivBuf = Buffer.from(iv, 'base64')
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, ivBuf)
    const encrypted = Buffer.concat([cipher.update(xmlBuf), cipher.final()])

    // SHA-256 of the encrypted content
    const encryptedInvoiceHash = crypto.createHash('sha256').update(encrypted).digest('base64')
    const encryptedInvoiceSize = encrypted.length
    const encryptedInvoiceContent = encrypted.toString('base64')

    const res = await ksefFetch(
      `${base}/sessions/online/${encodeURIComponent(referenceNumber)}/invoices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          invoiceHash,
          invoiceSize,
          encryptedInvoiceHash,
          encryptedInvoiceSize,
          encryptedInvoiceContent,
          offlineMode: false,
        }),
      },
    )

    const result = res.json()
    console.log(`[ksef-send] RESPONSE: status=${res.status}`, JSON.stringify(result).slice(0, 300))
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error:
            result.exception?.exceptionDescription ||
            result.exception?.exceptionDetailList?.[0]?.exceptionDescription ||
            result.message ||
            'Nie udało się wysłać faktury do KSeF.',
          details: result,
        }),
      }
    }

    const ksefRef = result.referenceNumber || result.elementReferenceNumber || ''
    console.log(`[ksef-send] OK: ksefRef=${ksefRef} invoice=${invoiceNumber}`)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ksefRef,
        invoiceNumber,
        // Full MF response — surfaced so client can persist it in ksef_events.meta
        // for forensic diagnostics (e.g. silent schema rejections after HTTP 202).
        mfResponse: result,
      }),
    }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const isConnectionError = /ECONNREFUSED|ENOTFOUND|Timeout|nie można|socket hang up|ECONNRESET|503|502/i.test(detail)

    // Mock fallback gated behind explicit env flag KSEF_ALLOW_MOCK=true.
    // Without the flag, ALL connection errors surface as real 502 — no fake success.
    const mockAllowed = process.env.KSEF_ALLOW_MOCK === 'true'
    if (isConnectionError && env !== 'prod' && mockAllowed) {
      console.warn(`[ksef-send] Connection failed (${env}), KSEF_ALLOW_MOCK=true → falling back to mock:`, detail)
      const mock = mockApi.sendInvoice(invoiceNumber, '')
      console.log(`[ksef-send] MOCK fallback: ksefRef=${mock.body.ksefRef}`)
      return { statusCode: 200, headers, body: JSON.stringify(mock.body) }
    }
    if (isConnectionError && env !== 'prod' && !mockAllowed) {
      console.error(`[ksef-send] Connection failed (${env}). Mock fallback DISABLED (set KSEF_ALLOW_MOCK=true to enable). Detail:`, detail)
    }

    const friendly = isConnectionError
      ? `Nie można połączyć się z serwerem KSeF. ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail, env, mockFallback: false }) }
  }
}
