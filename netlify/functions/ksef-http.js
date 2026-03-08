/**
 * ksef-http.js — thin HTTPS wrapper for KSeF Netlify functions.
 *
 * WHY: Node 18 native fetch (undici) has its own TLS certificate bundle that
 * does NOT include Polish government root CAs (NCCERT). This causes a
 * "fetch failed" / SSL error when connecting to ksef.mf.gov.pl and
 * ksef-test.mf.gov.pl. Node's built-in `https` module uses the system / Node
 * certificate store which correctly handles the MF certificate chain.
 */
const https = require('https')

/**
 * Minimal fetch-like wrapper using https.request.
 *
 * Returns an object with:
 *   .status   {number}  HTTP status code
 *   .ok       {boolean} status 200-299
 *   .text()   {string}  raw response body (synchronous)
 *   .json()   {any}     parsed JSON (synchronous, throws on bad JSON)
 *
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.headers]
 * @param {Buffer|string|null} [options.body]
 * @returns {Promise<{status:number, ok:boolean, text:()=>string, json:()=>any}>}
 */
function ksefFetch(url, options = {}) {
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

    const reqHeaders = { ...options.headers }
    if (bodyBuf) reqHeaders['Content-Length'] = String(bodyBuf.length)

    const reqOptions = {
      hostname: u.hostname,
      port: parseInt(u.port, 10) || 443,
      path: u.pathname + (u.search || ''),
      method: (options.method || 'GET').toUpperCase(),
      headers: reqHeaders,
      timeout: 25000,
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
          json: () => JSON.parse(raw),
        })
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout (25s) podczas połączenia z ${u.hostname}`))
    })

    req.on('error', (err) => {
      // Give a meaningful error instead of raw Node error codes
      let msg = `Błąd połączenia z ${u.hostname}: `
      if (err.code === 'ENOTFOUND')    msg += 'nie można rozwiązać adresu DNS'
      else if (err.code === 'ECONNREFUSED') msg += 'połączenie odrzucone'
      else if (err.code === 'CERT_HAS_EXPIRED') msg += 'certyfikat SSL serwera wygasł'
      else if (err.code && err.code.startsWith('CERT')) msg += `błąd certyfikatu SSL (${err.code})`
      else msg += err.message
      reject(new Error(msg))
    })

    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

module.exports = { ksefFetch }
