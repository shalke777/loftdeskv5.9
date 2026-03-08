/**
 * ksef-http.js — HTTPS wrapper for KSeF Netlify functions.
 *
 * WHY a custom wrapper instead of fetch():
 * 1. Node 18/20 native fetch (undici) has its own TLS certificate bundle
 *    that may NOT include Polish government root CAs (NCCERT).
 * 2. We need explicit control over timeouts, retries, and error messages.
 * 3. KSeF API (especially test/demo) is often slow or drops connections.
 *
 * Features:
 * - Automatic retry on transient errors (socket hang up, ECONNRESET, ETIMEDOUT)
 * - 60s timeout (KSeF API is slow, 25s was too short)
 * - Required Accept + User-Agent headers for KSeF compatibility
 * - TLS minVersion TLSv1.2 for gov.pl servers
 */
const https = require('https')
const tls = require('tls')

const TIMEOUT_MS = 60000  // 60 seconds — KSeF is slow
const MAX_RETRIES = 2     // retry transient errors up to 2 times
const RETRY_DELAY = 1500  // 1.5s between retries

/** Errors worth retrying (server dropped connection, network hiccup) */
const RETRIABLE = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN',
  'UND_ERR_SOCKET', 'HPE_INVALID_CONSTANT',
])

function isRetriable(err) {
  if (!err) return false
  if (RETRIABLE.has(err.code)) return true
  const msg = (err.message || '').toLowerCase()
  return msg.includes('socket hang up') || msg.includes('econnreset')
    || msg.includes('aborted') || msg.includes('network')
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Single HTTPS request (no retry).
 */
function singleFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    let u
    try {
      u = new URL(url)
    } catch (e) {
      return reject(new Error(`Nieprawidłowy URL KSeF: ${url}`))
    }

    // Prepare body buffer
    let bodyBuf = null
    if (options.body != null) {
      bodyBuf = Buffer.isBuffer(options.body)
        ? options.body
        : Buffer.from(
            typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
            'utf8',
          )
    }

    // Default headers required by KSeF API
    const reqHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'LoftDesk/5.9 (Netlify Function)',
      ...options.headers,
    }
    if (bodyBuf) {
      reqHeaders['Content-Length'] = String(bodyBuf.length)
      if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json'
    }

    const reqOptions = {
      hostname: u.hostname,
      port: parseInt(u.port, 10) || 443,
      path: u.pathname + (u.search || ''),
      method: (options.method || 'GET').toUpperCase(),
      headers: reqHeaders,
      timeout: TIMEOUT_MS,
      // TLS settings for Polish gov servers
      minVersion: 'TLSv1.2',
    }

    const req = https.request(reqOptions, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          text: () => raw,
          json: () => {
            try { return JSON.parse(raw) }
            catch { return { error: 'invalid_json', raw: raw.slice(0, 500) } }
          },
        })
      })
      res.on('error', reject)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout (${TIMEOUT_MS / 1000}s) podczas połączenia z ${u.hostname}. Serwer KSeF nie odpowiedział w wymaganym czasie.`))
    })

    req.on('error', (err) => {
      let msg = `Błąd połączenia z ${u.hostname}: `
      if (err.code === 'ENOTFOUND')         msg += 'nie można rozwiązać adresu DNS — sprawdź czy serwer KSeF jest dostępny'
      else if (err.code === 'ECONNREFUSED')  msg += 'połączenie odrzucone — serwer KSeF może być wyłączony'
      else if (err.code === 'ECONNRESET')    msg += 'serwer KSeF zerwał połączenie (ECONNRESET)'
      else if (err.code === 'ETIMEDOUT')     msg += 'timeout połączenia — serwer KSeF nie odpowiada'
      else if (err.code === 'CERT_HAS_EXPIRED') msg += 'certyfikat SSL serwera wygasł'
      else if (err.code && err.code.startsWith('CERT')) msg += `błąd certyfikatu SSL (${err.code})`
      else if (err.message && err.message.includes('socket hang up'))
        msg += 'serwer KSeF zamknął połączenie (socket hang up) — może być przeciążony lub w trakcie konserwacji'
      else msg += err.message || err.code || 'nieznany błąd'

      const wrapped = new Error(msg)
      wrapped.code = err.code
      reject(wrapped)
    })

    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

/**
 * Fetch with automatic retry on transient errors.
 *
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<{status:number, ok:boolean, text:()=>string, json:()=>any}>}
 */
async function ksefFetch(url, options = {}) {
  let lastErr
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_DELAY * attempt)
    }
    try {
      return await singleFetch(url, options)
    } catch (err) {
      lastErr = err
      if (!isRetriable(err) || attempt === MAX_RETRIES) throw err
      // Retriable error — will retry
    }
  }
  throw lastErr
}

module.exports = { ksefFetch }
