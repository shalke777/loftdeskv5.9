/**
 * Netlify function: ksef-session
 * Proxy for KSeF session management (init / close).
 * Auth flow: AuthorisationChallenge → encrypt token with KSeF RSA pub key → InitToken
 */
const crypto = require('crypto')
const fetch = require('node-fetch')

const BASE = {
  test: 'https://ksef-test.mf.gov.pl/api',
  prod: 'https://ksef.mf.gov.pl/api',
}

async function getKsefPublicKey(base) {
  const res = await fetch(`${base}/common/Public/certificate`, {
    headers: { accept: 'text/plain' },
  })
  if (!res.ok) throw new Error(`Nie można pobrać certyfikatu KSeF: HTTP ${res.status}`)
  return res.text()
}

function encryptTokenRsa(tokenPlain, publicKeyPem) {
  return crypto
    .publicEncrypt(
      {
        key: crypto.createPublicKey(publicKeyPem),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(tokenPlain, 'utf8'),
    )
    .toString('base64')
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

  const { action, nip, token, sessionToken, env = 'test' } = body
  const base = BASE[env] || BASE.test

  try {
    // ── Init session ────────────────────────────────────────────────
    if (action === 'init') {
      if (!nip || !token) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_nip_or_token' }) }
      }

      // Step 1: get challenge
      const challengeRes = await fetch(`${base}/online/Session/AuthorisationChallenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ contextIdentifier: { type: 'onip', identifier: nip } }),
      })
      const challengeData = await challengeRes.json()
      if (!challengeRes.ok) {
        return {
          statusCode: challengeRes.status,
          headers,
          body: JSON.stringify({ error: challengeData.exceptionCode || 'challenge_failed', details: challengeData }),
        }
      }

      // Step 2: encrypt token with KSeF public key (RSAES-OAEP / SHA-256)
      const publicKeyPem = await getKsefPublicKey(base)
      const encryptedToken = encryptTokenRsa(token, publicKeyPem)

      // Step 3: InitToken
      const initRes = await fetch(`${base}/online/Session/InitToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          context: {
            challenge: challengeData.challenge,
            identifier: { type: 'onip', identifier: nip },
            token: { value: encryptedToken, type: 'T' },
          },
        }),
      })
      const sessionData = await initRes.json()
      if (!initRes.ok) {
        return {
          statusCode: initRes.status,
          headers,
          body: JSON.stringify({
            error:
              sessionData.exception?.exceptionDetailList?.[0]?.exceptionCode ||
              'init_session_failed',
            details: sessionData,
          }),
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          sessionToken: sessionData.sessionToken?.token,
          referenceNumber: sessionData.referenceNumber,
        }),
      }
    }

    // ── Close session ────────────────────────────────────────────────
    if (action === 'close') {
      if (!sessionToken) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_session_token' }) }
      }
      await fetch(`${base}/online/Session/Terminate`, {
        method: 'GET',
        headers: { accept: 'application/json', SessionToken: sessionToken },
      })
      return { statusCode: 200, headers, body: JSON.stringify({ closed: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown_action' }) }
  } catch (e) {
    const detail = e.message || 'upstream_error'
    const friendly = detail.includes('fetch') || detail.includes('ECONNREFUSED') || detail.includes('ENOTFOUND')
      ? `Nie można połączyć się z serwerem KSeF (${detail}). Serwer MF może być chwilowo niedostępny. Użyj trybu demo do testów.`
      : detail
    return { statusCode: 502, headers, body: JSON.stringify({ error: friendly, detail }) }
  }
}
