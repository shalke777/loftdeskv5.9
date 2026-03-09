/**
 * Netlify function: ksef-session
 * KSeF MF API v2 — token-based auth + interactive session management.
 *
 * INIT flow (action: 'init'):
 *   1. GET  /security/public-key-certificates → fetch MF encryption keys
 *   2. POST /auth/challenge → get challenge + timestampMs
 *   3. RSA-OAEP encrypt token|timestampMs with KsefTokenEncryption key
 *   4. POST /auth/ksef-token → get JWT Bearer token + authRef
 *   5. Poll GET /auth/{authRef} → wait until status.code === 200
 *   6. Generate AES-256 key + IV, RSA-OAEP encrypt key with SymmetricKeyEncryption key
 *   7. POST /sessions/online → open interactive session, get sessionRef
 *  Returns: { sessionToken (JWT), referenceNumber (sessionRef), symmetricKey, iv, validUntil }
 *
 * CLOSE flow (action: 'close'):
 *   POST /sessions/online/{referenceNumber}/close → close interactive session
 *   DELETE /auth/sessions/current → invalidate auth session
 *
 * Environments (v2):
 *   demo: https://api-demo.ksef.mf.gov.pl/v2
 *   test: https://api-test.ksef.mf.gov.pl/v2
 *   prod: https://api.ksef.mf.gov.pl/v2
 */
const crypto = require('crypto')
const { ksefFetch } = require('./ksef-http')
const { checkKsefAvailability } = require('./ksef-schedule')
const { mockApi } = require('./ksef-mock')

const BASE = {
  demo: 'https://api-demo.ksef.mf.gov.pl/v2',
  test: 'https://api-test.ksef.mf.gov.pl/v2',
  prod: 'https://api.ksef.mf.gov.pl/v2',
}

/**
 * Fetch MF public keys for encryption from /security/public-key-certificates.
 * Returns array of { certificate, validFrom, validTo, usage[] }.
 */
async function fetchPublicKeys(base) {
  const res = await ksefFetch(`${base}/security/public-key-certificates`, { method: 'GET' })
  if (!res.ok) throw new Error('Nie udało się pobrać kluczy publicznych MF z KSeF.')
  const keys = res.json()
  if (!Array.isArray(keys) || keys.length === 0) throw new Error('Brak kluczy publicznych KSeF.')
  return keys
}

/**
 * Find a currently-valid key by usage type ('KsefTokenEncryption' | 'SymmetricKeyEncryption').
 */
function findKey(keys, usage) {
  const now = new Date()
  return keys.find(
    (k) => k.usage && k.usage.includes(usage) && new Date(k.validFrom) <= now && new Date(k.validTo) >= now,
  )
}

/**
 * RSA-OAEP (SHA-256) encrypt data with a base64-encoded key from KSeF.
 * KSeF returns X.509 certificates (DER). We extract the public key from the cert.
 * Falls back to raw SPKI if parsing as X.509 fails.
 */
function rsaOaepEncrypt(data, derKeyBase64) {
  const keyBuffer = Buffer.from(derKeyBase64, 'base64')
  let publicKey
  try {
    // KSeF returns DER-encoded X.509 certificates — extract public key
    const cert = new crypto.X509Certificate(keyBuffer)
    publicKey = cert.publicKey
  } catch {
    // Fallback: try as raw SPKI (in case KSeF changes format)
    try {
      publicKey = crypto.createPublicKey({ key: keyBuffer, format: 'der', type: 'spki' })
    } catch (e2) {
      throw new Error(`Nie można odczytać klucza publicznego KSeF: ${e2.message}`)
    }
  }
  return crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'),
  )
}

/**
 * Poll auth status until code 200 (success) or ≥400 (failure).
 * Waits up to ~15s (30 × 500ms).
 */
async function pollAuthStatus(base, referenceNumber, bearerToken) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const res = await ksefFetch(`${base}/auth/${encodeURIComponent(referenceNumber)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
    if (!res.ok) continue
    const data = res.json()
    if (data.status?.code === 200) return data
    if (data.status?.code >= 400) {
      const details = (data.status?.details || []).join('; ')
      throw new Error(data.status?.description + (details ? ` (${details})` : '') || 'Uwierzytelnienie zakończone niepowodzeniem.')
    }
  }
  throw new Error('Timeout oczekiwania na uwierzytelnienie KSeF (15s). Spróbuj ponownie.')
}

/**
 * Extract a user-friendly error message from v2 exception response.
 */
function extractError(data, fallback) {
  return data.exception?.exceptionDescription
    || data.exception?.exceptionDetailList?.[0]?.exceptionDescription
    || data.title || data.message || fallback
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

  const { action, nip, token, sessionToken, referenceNumber, env = 'test' } = body
  const base = BASE[env] || BASE.test

  try {
    // ── Init: v2 two-phase auth + session open ─────────────────────
    if (action === 'init') {
      if (!nip || !token) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak NIP lub tokena autoryzacyjnego.' }) }
      }

      // 1. Fetch MF public keys
      const keys = await fetchPublicKeys(base)
      const tokenEncKey = findKey(keys, 'KsefTokenEncryption')
      const symEncKey = findKey(keys, 'SymmetricKeyEncryption')
      if (!tokenEncKey) throw new Error('Nie znaleziono aktualnego klucza KsefTokenEncryption w KSeF.')
      if (!symEncKey) throw new Error('Nie znaleziono aktualnego klucza SymmetricKeyEncryption w KSeF.')

      // ── Diagnostic: token & NIP check ──────────────────────────
      const tokenLen = token ? token.length : 0
      const tokenHead = token ? token.slice(0, 4) : '??'
      const tokenTail = token ? token.slice(-4) : '??'
      console.log(`[ksef-session] INIT diagnostic:`)
      console.log(`  env       = ${env}`)
      console.log(`  base      = ${base}`)
      console.log(`  nip       = ${nip}`)
      console.log(`  token     = exists:${!!token} len:${tokenLen} head:${tokenHead} tail:${tokenTail}`)
      console.log(`  typeof    = nip:${typeof nip} token:${typeof token}`)

      // 2. Get authorisation challenge (v2: contextIdentifier required)
      const contextId = { type: 'Nip', value: String(nip) }
      console.log(`[ksef-session] Step 2: POST ${base}/auth/challenge`, JSON.stringify({ contextIdentifier: contextId }))
      const challengeRes = await ksefFetch(`${base}/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextIdentifier: contextId }),
      })
      const challengeData = challengeRes.json()
      if (!challengeRes.ok) {
        return {
          statusCode: challengeRes.status,
          headers,
          body: JSON.stringify({
            error: extractError(challengeData, 'Nie udało się pobrać challenge z KSeF.'),
            details: challengeData,
          }),
        }
      }

      const challenge = challengeData.challenge
      const timestampMs = challengeData.timestampMs

      // 3. RSA-OAEP encrypt token|timestampMs with KsefTokenEncryption key
      const tokenPayload = `${token}|${timestampMs}`
      const encryptedToken = rsaOaepEncrypt(tokenPayload, tokenEncKey.certificate).toString('base64')
      console.log(`[ksef-session] Step 3: encrypted token payload len=${tokenPayload.length} → cipher len=${encryptedToken.length}`)

      // 4. Authenticate with KSeF token (v2: contextIdentifier { type: 'Nip', value: nip })
      const authBody = {
        challenge,
        contextIdentifier: contextId,
        encryptedToken,
      }
      console.log(`[ksef-session] Step 4: POST ${base}/auth/ksef-token`, JSON.stringify({
        challenge: challenge?.slice(0, 8) + '...',
        contextIdentifier: contextId,
        encryptedToken: encryptedToken.slice(0, 12) + '...[' + encryptedToken.length + ' chars]',
      }))
      const authRes = await ksefFetch(`${base}/auth/ksef-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody),
      })
      const authData = authRes.json()
      if (!authRes.ok) {
        return {
          statusCode: authRes.status,
          headers,
          body: JSON.stringify({
            error: extractError(authData, 'Nie udało się uwierzytelnić w KSeF.'),
            details: authData,
          }),
        }
      }

      const authRef = authData.referenceNumber
      const jwt = authData.authenticationToken?.token
      console.log(`[ksef-session] Step 4 result: authRef=${authRef} jwt=${jwt ? 'exists len=' + jwt.length : 'MISSING!'}`)
      if (!jwt) throw new Error('KSeF nie zwrócił tokenu uwierzytelnienia (JWT).')

      // 5. Poll auth status until authentication succeeds
      console.log(`[ksef-session] Step 5: polling auth status for ref=${authRef}`)
      await pollAuthStatus(base, authRef, jwt)
      console.log(`[ksef-session] Step 5: auth confirmed OK`)

      // 6. Generate AES-256 key + IV for invoice encryption
      const aesKey = crypto.randomBytes(32)
      const iv = crypto.randomBytes(16)

      // 7. RSA-OAEP encrypt AES key with SymmetricKeyEncryption key
      const encryptedAesKey = rsaOaepEncrypt(aesKey, symEncKey.certificate).toString('base64')

      // 8. Open online interactive session (context already bound to JWT from auth step)
      const sessionBody = {
        formCode: { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' },
        encryption: {
          encryptedSymmetricKey: encryptedAesKey,
          initializationVector: iv.toString('base64'),
        },
      }
      console.log(`[ksef-session] Step 8: POST ${base}/sessions/online`, JSON.stringify({
        formCode: sessionBody.formCode,
        encryption: { encryptedSymmetricKey: encryptedAesKey.slice(0, 12) + '...', initializationVector: sessionBody.encryption.initializationVector },
      }))
      const sessionRes = await ksefFetch(`${base}/sessions/online`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(sessionBody),
      })
      const sessionData = sessionRes.json()
      console.log(`[ksef-session] Step 8 result: status=${sessionRes.status}`, JSON.stringify(sessionData).slice(0, 500))
      if (!sessionRes.ok) {
        return {
          statusCode: sessionRes.status,
          headers,
          body: JSON.stringify({
            error: extractError(sessionData, 'Nie udało się otworzyć sesji interaktywnej KSeF.'),
            details: sessionData,
          }),
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          sessionToken: jwt,
          referenceNumber: sessionData.referenceNumber,
          symmetricKey: aesKey.toString('base64'),
          iv: iv.toString('base64'),
          validUntil: sessionData.validUntil || authData.authenticationToken?.validUntil,
        }),
      }
    }

    // ── Close / terminate session ────────────────────────────────────
    if (action === 'close') {
      if (!sessionToken) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Brak tokena sesji.' }) }
      }
      // Close the online interactive session (if referenceNumber provided)
      if (referenceNumber) {
        await ksefFetch(`${base}/sessions/online/${encodeURIComponent(referenceNumber)}/close`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      }
      // Invalidate the auth session
      await ksefFetch(`${base}/auth/sessions/current`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      return { statusCode: 200, headers, body: JSON.stringify({ closed: true }) }
    }

    // ── Check availability ─────────────────────────────────────────
    if (action === 'check-availability') {
      const availability = checkKsefAvailability(env);
      return { statusCode: 200, headers, body: JSON.stringify(availability) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nieznana akcja. Użyj "init", "close" lub "check-availability".' }) }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const isConnectionError = /ECONNREFUSED|ENOTFOUND|Timeout|nie można|socket hang up|ECONNRESET|503|502/i.test(detail)

    // Auto-fallback to mock when KSeF is unreachable (non-prod only)
    if (isConnectionError && env !== 'prod') {
      console.warn(`[ksef-session] Connection failed (${env}), falling back to mock:`, detail)
      if (action === 'init') {
        const mock = mockApi.initSession(nip);
        return { statusCode: mock.statusCode, headers, body: JSON.stringify(mock.body) };
      }
      if (action === 'close') {
        const mock = mockApi.closeSession(referenceNumber);
        return { statusCode: mock.statusCode, headers, body: JSON.stringify(mock.body) };
      }
    }

    const friendly = isConnectionError
      ? `Nie można połączyć się z serwerem KSeF (${env}). ${detail}`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
