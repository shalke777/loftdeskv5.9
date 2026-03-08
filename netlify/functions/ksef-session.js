/**
 * Netlify function: ksef-session
 * KSeF MF API — token-based auth + interactive session management.
 *
 * INIT flow (action: 'init'):
 *   1. POST /online/Session/AuthorisationChallenge → get challenge + timestamp
 *   2. Encrypt `token|timestamp` with MF RSA public key (if available)
 *   3. POST /online/Session/InitToken → open session, get sessionToken + referenceNumber
 *   4. Poll GET /online/Session/Status/{ref} → wait until processingCode === 315
 *  Returns: { sessionToken, referenceNumber }
 *
 * CLOSE flow (action: 'close'):
 *   POST /online/Session/Terminate
 *
 * Environments:
 *   demo: https://ksef-demo.mf.gov.pl/api
 *   test: https://ksef-test.mf.gov.pl/api
 *   prod: https://ksef.mf.gov.pl/api
 */
const crypto = require('crypto')
const { ksefFetch } = require('./ksef-http')

const BASE = {
  demo: 'https://ksef-demo.mf.gov.pl/api',
  test: 'https://ksef-test.mf.gov.pl/api',
  prod: 'https://ksef.mf.gov.pl/api',
}

/**
 * Poll session init status until processingCode !== 310 (in progress).
 * 315 = session active. Waits up to ~15s (30 × 500ms).
 */
async function pollSessionStatus(base, referenceNumber) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const res = await ksefFetch(`${base}/online/Session/Status/${encodeURIComponent(referenceNumber)}`, {
      method: 'GET',
    })
    if (!res.ok) continue
    const data = res.json()
    // processingCode 310 = in progress, 315 = session active
    if (data.processingCode === 315 || (data.processingCode && data.processingCode !== 310)) {
      return data
    }
  }
  throw new Error('Timeout oczekiwania na sesję KSeF (15s). Spróbuj ponownie.')
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

  const { action, nip, token, sessionToken, referenceNumber, env = 'test' } = body
  const base = BASE[env] || BASE.test

  try {
    // ── Init: token-based authorisation ─────────────────────────────
    if (action === 'init') {
      if (!nip || !token) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak NIP lub tokena autoryzacyjnego.' }) }
      }

      // 1. Get authorisation challenge
      const challengeRes = await ksefFetch(`${base}/online/Session/AuthorisationChallenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextIdentifier: {
            type: 'onip',
            identifier: nip,
          },
        }),
      })
      const challengeData = challengeRes.json()
      if (!challengeRes.ok) {
        return {
          statusCode: challengeRes.status,
          headers,
          body: JSON.stringify({
            error: challengeData.exception?.exceptionDetailList?.[0]?.exceptionDescription
              || challengeData.message || 'Nie udało się pobrać challenge z KSeF.',
            details: challengeData,
          }),
        }
      }

      const challenge = challengeData.challenge
      const timestamp = challengeData.timestamp

      // 2. Encrypt token|timestamp with base64 (demo/test accept plaintext token)
      const encryptedToken = Buffer.from(`${token}|${timestamp}`).toString('base64')

      // 3. Init session with token
      const initRes = await ksefFetch(`${base}/online/Session/InitToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            challenge,
            identifier: {
              type: 'onip',
              identifier: nip,
            },
            documentType: {
              service: 'KSeF',
              formCode: {
                systemCode: 'FA (2)',
                schemaVersion: '1-0E',
                targetNamespace: 'http://crd.gov.pl/wzor/2023/06/29/12648/',
                value: 'FA',
              },
            },
            token: encryptedToken,
          },
        }),
      })
      const initData = initRes.json()
      if (!initRes.ok) {
        return {
          statusCode: initRes.status,
          headers,
          body: JSON.stringify({
            error: initData.exception?.exceptionDetailList?.[0]?.exceptionDescription
              || initData.message || 'Nie udało się zainicjować sesji KSeF.',
            details: initData,
          }),
        }
      }

      const refNumber = initData.referenceNumber
      const sessToken = initData.sessionToken?.token || initData.sessionToken

      // 4. Poll session status until active (if no immediate token returned)
      if (refNumber && !sessToken) {
        const status = await pollSessionStatus(base, refNumber)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            sessionToken: status.sessionToken?.token || status.sessionToken || refNumber,
            referenceNumber: refNumber,
            processingCode: status.processingCode,
          }),
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          sessionToken: sessToken || refNumber,
          referenceNumber: refNumber,
        }),
      }
    }

    // ── Close / terminate session ────────────────────────────────────
    if (action === 'close') {
      if (!sessionToken) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak tokena sesji.' }) }
      }
      await ksefFetch(`${base}/online/Session/Terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          SessionToken: sessionToken,
        },
      })
      return { statusCode: 200, headers, body: JSON.stringify({ closed: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nieznana akcja. Użyj "init" lub "close".' }) }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = /ECONNREFUSED|ENOTFOUND|Timeout|nie można|socket hang up|ECONNRESET/i.test(detail)
      ? `Nie można połączyć się z serwerem KSeF (${env}). ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
