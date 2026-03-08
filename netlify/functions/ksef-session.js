/**
 * Netlify function: ksef-session
 * KSeF API v2 — auth + session management.
 *
 * INIT flow (action: 'init'):
 *   1. GET  /security/public-key-certificates   → get MF public key certs
 *   2. POST /auth/challenge                      → get challenge + timestampMs
 *   3. Encrypt `token|timestampMs` with KsefTokenEncryption cert (RSA-OAEP SHA-256)
 *   4. POST /auth/ksef-token                     → get authenticationToken + referenceNumber
 *   5. Poll GET /auth/{referenceNumber}          → wait until status.code !== 100
 *   6. POST /auth/token/redeem                  → get accessToken + refreshToken (one-time)
 *   7. Generate random 32-byte AES key + 16-byte IV
 *   8. Encrypt AES key with SymmetricKeyEncryption cert (RSA-OAEP SHA-256)
 *   9. POST /sessions/online                    → open online session
 *  Returns: { accessToken, sessionRef, symmetricKey (base64), iv (base64), validUntil }
 *
 * CLOSE flow (action: 'close'):
 *   POST /sessions/online/{sessionRef}/close
 *
 * Base URL TEST: https://api-test.ksef.mf.gov.pl/v2
 */
const crypto = require('crypto')
const { X509Certificate } = require('crypto')
const { ksefFetch } = require('./ksef-http')

const BASE = {
  test: 'https://api-test.ksef.mf.gov.pl/v2',
  prod: 'https://api.ksef.mf.gov.pl/v2',
}

/** Fetch MF public-key certificates array from /security/public-key-certificates */
async function getPublicKeyCerts(base) {
  const res = await ksefFetch(`${base}/security/public-key-certificates`)
  if (!res.ok) throw new Error(`Nie można pobrać certyfikatów MF: HTTP ${res.status}`)
  return res.json() // Array of { certificate (DER base64), validFrom, validTo, usage[] }
}

/** Find the first cert that has the given usage string in its usage array */
function findCertByUsage(certs, usage) {
  const cert = certs.find((c) => Array.isArray(c.usage) && c.usage.includes(usage))
  if (!cert) throw new Error(`Brak certyfikatu MF dla operacji: ${usage}`)
  return cert
}

/** Encrypt plain buffer with RSA-OAEP SHA-256 using DER certificate (base64 encoded) */
function encryptRsaOaep(certDerBase64, plainBuf) {
  const cert = new X509Certificate(Buffer.from(certDerBase64, 'base64'))
  return crypto
    .publicEncrypt(
      { key: cert.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.isBuffer(plainBuf) ? plainBuf : Buffer.from(plainBuf),
    )
    .toString('base64')
}

/**
 * Poll GET /auth/{referenceNumber} until status.code !== 100 (in-progress).
 * Waits up to ~6 seconds (20 × 300ms).
 */
async function pollAuthStatus(base, referenceNumber, authToken) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300))
    const res = await ksefFetch(`${base}/auth/${encodeURIComponent(referenceNumber)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (!res.ok) continue
    const data = res.json()
    // code 100 = "Uwierzytelnianie w toku" (still processing)
    if (!data.status || data.status.code !== 100) return data
  }
  throw new Error('Timeout oczekiwania na uwierzytelnienie KSeF (6s). Spróbuj ponownie.')
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

  const { action, nip, token, accessToken, sessionRef, env = 'test' } = body
  const base = BASE[env] || BASE.test

  try {
    // ── Init: authenticate (4-step) + open online session ─────────────
    if (action === 'init') {
      if (!nip || !token) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_nip_or_token' }) }
      }

      // 1. Fetch MF public-key certificates
      const certs = await getPublicKeyCerts(base)
      const tokenEncCert = findCertByUsage(certs, 'KsefTokenEncryption')
      const symKeyCert = findCertByUsage(certs, 'SymmetricKeyEncryption')

      // 2. Get challenge
      const challengeRes = await ksefFetch(`${base}/auth/challenge`, { method: 'POST' })
      const challengeData = challengeRes.json()
      if (!challengeRes.ok) {
        return {
          statusCode: challengeRes.status,
          headers,
          body: JSON.stringify({ error: 'challenge_failed', details: challengeData }),
        }
      }

      // 3. Encrypt `token|timestampMs` with KsefTokenEncryption cert
      //    Format per MF docs: "token|timestamp" where timestamp = unix ms
      const plaintext = `${token}|${challengeData.timestampMs}`
      const encryptedToken = encryptRsaOaep(tokenEncCert.certificate, Buffer.from(plaintext))

      // 4. Submit ksef-token auth request
      const authRes = await ksefFetch(`${base}/auth/ksef-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge: challengeData.challenge,
          contextIdentifier: { type: 'Nip', value: nip },
          encryptedToken,
        }),
      })
      const authData = authRes.json()
      if (!authRes.ok) {
        return {
          statusCode: authRes.status,
          headers,
          body: JSON.stringify({ error: 'auth_failed', details: authData }),
        }
      }

      const authToken = authData.authenticationToken.token
      const authRef = authData.referenceNumber

      // 5. Poll auth status until processing completes
      await pollAuthStatus(base, authRef, authToken)

      // 6. Redeem tokens (one-time — gives accessToken + refreshToken)
      const redeemRes = await ksefFetch(`${base}/auth/token/redeem`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const redeemData = redeemRes.json()
      if (!redeemRes.ok) {
        return {
          statusCode: redeemRes.status,
          headers,
          body: JSON.stringify({ error: 'token_redeem_failed', details: redeemData }),
        }
      }

      const finalAccessToken = redeemData.accessToken.token

      // 7. Generate AES-256 symmetric key (32 bytes) + IV (16 bytes) for this session
      const symmetricKeyBuf = crypto.randomBytes(32)
      const ivBuf = crypto.randomBytes(16)

      // 8. Encrypt symmetric key with SymmetricKeyEncryption cert (RSA-OAEP SHA-256)
      const encryptedSymmetricKey = encryptRsaOaep(symKeyCert.certificate, symmetricKeyBuf)

      // 9. Open online session (FA(2) schema, with encrypted symmetric key)
      const openRes = await ksefFetch(`${base}/sessions/online`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finalAccessToken}`,
        },
        body: JSON.stringify({
          formCode: { systemCode: 'FA (2)', schemaVersion: '1-0E', value: 'FA' },
          encryption: {
            encryptedSymmetricKey,
            initializationVector: ivBuf.toString('base64'),
          },
        }),
      })
      const openData = openRes.json()
      if (!openRes.ok) {
        return {
          statusCode: openRes.status,
          headers,
          body: JSON.stringify({ error: 'open_session_failed', details: openData }),
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          accessToken: finalAccessToken,
          sessionRef: openData.referenceNumber,
          symmetricKey: symmetricKeyBuf.toString('base64'),
          iv: ivBuf.toString('base64'),
          validUntil: openData.validUntil,
        }),
      }
    }

    // ── Close session ────────────────────────────────────────────────
    if (action === 'close') {
      if (!accessToken || !sessionRef) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_access_token_or_session_ref' }) }
      }
      await ksefFetch(`${base}/sessions/online/${encodeURIComponent(sessionRef)}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return { statusCode: 200, headers, body: JSON.stringify({ closed: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown_action' }) }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = /ECONNREFUSED|ENOTFOUND|Timeout/.test(detail)
      ? `Nie można połączyć się z serwerem KSeF: ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
