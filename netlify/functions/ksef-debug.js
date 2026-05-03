/**
 * Netlify function: ksef-debug
 *
 * Manual diagnostic endpoint — runs the full KSeF flow against a single invoice
 * and returns a step-by-step trace (no DB writes, no history append).
 *
 * Use this to compare DEMO vs PROD when the regular send pipeline fails
 * silently or produces unexpected results.
 *
 * INPUT  (POST JSON):
 *   {
 *     invoiceId: string,            // Supabase invoice id (read with service role)
 *     env: 'demo' | 'test' | 'prod',
 *     nip: string,                  // payer NIP (10 digits)
 *     token: string,                // KSeF API token (matching env)
 *     dryRun?: boolean              // default false; when true, stop after init
 *   }
 *
 * OUTPUT:
 *   {
 *     ok: boolean,
 *     env, invoiceId, invoiceNumber,
 *     totalDurationMs,
 *     steps: [
 *       { step: 'fetchInvoice',    status, durationMs, result },
 *       { step: 'buildXml',        status, durationMs, xmlSize, xmlPreview },
 *       { step: 'initSession',     status, durationMs, response },
 *       { step: 'sendInvoice',     status, durationMs, request, response },
 *       { step: 'closeSession',    status, durationMs, response },
 *     ],
 *     error?: string,
 *     finalStatus?: { ksefRef, status }
 *   }
 *
 * AUTH: requires Supabase JWT for a user whose company plan ∈ {pro,business,admin}
 *       (same gate as ksef-send).
 */
const { createClient } = require('@supabase/supabase-js')
const { ksefFetch } = require('./ksef-http')
const { requireKsefAccess } = require('./ksef-auth')

const BASE = {
  demo: 'https://api-demo.ksef.mf.gov.pl/v2',
  test: 'https://api-test.ksef.mf.gov.pl/v2',
  prod: 'https://api.ksef.mf.gov.pl/v2',
}

function sbAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Mask a JWT/token for logs: keep head:tail only. */
function mask(t) {
  if (!t || typeof t !== 'string') return '∅'
  if (t.length < 12) return `[len=${t.length}]`
  return `${t.slice(0, 4)}…${t.slice(-4)} (len=${t.length})`
}

function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Minimal FA(2) XML for diagnostic — same shape as ksef.service.ts but server-side. */
function buildDiagnosticXml(invoice, items, seller, buyer) {
  const issueDate = invoice.issue_date || new Date().toISOString().slice(0, 10)
  const saleDate = invoice.sale_date || issueDate
  const [year, month] = issueDate.split('-')
  const lines = (items || []).map((it, i) => `    <fa:FaWiersz>
      <fa:NrWierszaFa>${i + 1}</fa:NrWierszaFa>
      <fa:P_7>${escXml(it.description)}</fa:P_7>
      <fa:P_8A>${escXml(it.unit || 'kpl')}</fa:P_8A>
      <fa:P_8B>${it.quantity}</fa:P_8B>
      <fa:P_9A>${Number(it.unit_price).toFixed(2)}</fa:P_9A>
      <fa:P_12>${it.vat_rate}</fa:P_12>
    </fa:FaWiersz>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<fa:Faktura xmlns:fa="http://crd.gov.pl/wzor/2023/12/13/13644/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <fa:Naglowek>
    <fa:KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</fa:KodFormularza>
    <fa:WariantFormularza>3</fa:WariantFormularza>
    <fa:DataWytworzeniaFa>${new Date().toISOString().slice(0, 23)}</fa:DataWytworzeniaFa>
    <fa:SystemInfo>LoftDesk v5.9 (debug)</fa:SystemInfo>
  </fa:Naglowek>
  <fa:Podmiot1><fa:DaneIdentyfikacyjne><fa:NIP>${escXml(seller.nip)}</fa:NIP><fa:Nazwa>${escXml(seller.name)}</fa:Nazwa></fa:DaneIdentyfikacyjne><fa:RolaPodmiotu1>1</fa:RolaPodmiotu1></fa:Podmiot1>
  <fa:Podmiot2><fa:DaneIdentyfikacyjne>${buyer.nip ? `<fa:NIP>${escXml(buyer.nip)}</fa:NIP>` : '<fa:BrakID>1</fa:BrakID>'}<fa:Nazwa>${escXml(buyer.name)}</fa:Nazwa></fa:DaneIdentyfikacyjne><fa:RolaPodmiotu2>2</fa:RolaPodmiotu2></fa:Podmiot2>
  <fa:Fa>
    <fa:KodWaluty>PLN</fa:KodWaluty>
    <fa:P_1>${issueDate}</fa:P_1><fa:P_1M>${month}</fa:P_1M><fa:P_1R>${year}</fa:P_1R>
    <fa:P_2>${escXml(invoice.number || `DEBUG-${invoice.id.slice(0, 8)}`)}</fa:P_2>
    <fa:P_6>${saleDate}</fa:P_6>
    <fa:RodzajFaktury>VAT</fa:RodzajFaktury>
${lines}
    <fa:Rozliczenie><fa:P_15>${Number(invoice.total_gross || 0).toFixed(2)}</fa:P_15></fa:Rozliczenie>
    <fa:Platnosc><fa:Zaplacono>2</fa:Zaplacono></fa:Platnosc>
    <fa:Adnotacje><fa:P_16>2</fa:P_16><fa:P_17>2</fa:P_17><fa:Zwolnienie><fa:P_19N>0</fa:P_19N></fa:Zwolnienie><fa:NoweSrodkiTransportu><fa:P_22N>0</fa:P_22N></fa:NoweSrodkiTransportu></fa:Adnotacje>
  </fa:Fa>
</fa:Faktura>`
}

async function timed(label, fn) {
  const t0 = Date.now()
  try {
    const value = await fn()
    return { step: label, status: 'ok', durationMs: Date.now() - t0, ...value }
  } catch (e) {
    return { step: label, status: 'error', durationMs: Date.now() - t0, error: e.message || String(e) }
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  // Plan + auth gate (same as ksef-send / ksef-session)
  const authResult = await requireKsefAccess(event)
  if (authResult.error) {
    return { statusCode: authResult.status, headers, body: JSON.stringify({ error: authResult.error, code: authResult.code }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) }
  }
  const { invoiceId, env = 'demo', nip, token, dryRun = false } = body
  if (!invoiceId || !nip || !token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invoiceId, nip, token required' }) }
  }

  const t0 = Date.now()
  const steps = []
  const sb = sbAdmin()
  if (!sb) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase service role not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing on this Netlify env)' }) }
  }

  // STEP 1 — fetch invoice + items
  let invoice, items, sellerProfile, buyer
  steps.push(await timed('fetchInvoice', async () => {
    const { data: inv, error } = await sb.from('invoices')
      .select('id, number, status, issue_date, sale_date, total_gross, total_net, ksef_status, ksef_ref, company_id, client_id')
      .eq('id', invoiceId).maybeSingle()
    if (error || !inv) throw new Error(`Invoice not found: ${error?.message || 'no row'}`)
    invoice = inv
    const { data: it } = await sb.from('invoice_items').select('description, unit, quantity, unit_price, vat_rate').eq('invoice_id', invoiceId)
    items = it || []
    const { data: company } = await sb.from('companies').select('name, plan').eq('id', inv.company_id).maybeSingle()
    const { data: profile } = await sb.from('company_profiles').select('*').eq('company_id', inv.company_id).maybeSingle()
    sellerProfile = profile || {}
    const { data: client } = await sb.from('clients').select('name, nip, address').eq('id', inv.client_id).maybeSingle()
    buyer = client || {}
    return {
      result: {
        invoiceNumber: inv.number,
        invoiceStatus: inv.status,
        ksefStatus: inv.ksef_status,
        ksefRef: inv.ksef_ref,
        itemCount: items.length,
        totalGross: inv.total_gross,
        companyName: company?.name,
        companyPlan: company?.plan,
        sellerNip: profile?.nip || profile?.ksef_nip,
        buyerNip: client?.nip,
      },
    }
  }))
  if (steps[0].status === 'error') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, env, invoiceId, totalDurationMs: Date.now() - t0, steps, error: steps[0].error }) }
  }

  // STEP 2 — build XML
  steps.push(await timed('buildXml', async () => {
    const seller = {
      nip: sellerProfile.nip || sellerProfile.ksef_nip || '',
      name: sellerProfile.company_name || '',
    }
    const xml = buildDiagnosticXml(invoice, items, seller, { nip: buyer.nip || '', name: buyer.name || '' })
    return { xmlSize: xml.length, xmlPreview: xml.slice(0, 400), _xml: xml }
  }))
  if (steps[1].status === 'error') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, env, invoiceId, totalDurationMs: Date.now() - t0, steps, error: steps[1].error }) }
  }
  const xmlPayload = steps[1]._xml
  delete steps[1]._xml // do not return raw XML in response

  const base = BASE[env] || BASE.test
  console.log(`[ksef-debug] starting trace for invoice=${invoice.id} env=${env} base=${base} token=${mask(token)} nip=${nip}`)

  // STEP 3 — initSession (call ksef-session function inline by re-using its logic)
  // We make an HTTP call back to ourselves so the trace mirrors production exactly.
  let sessionData = null
  steps.push(await timed('initSession', async () => {
    const proxyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888'
    const res = await ksefFetch(`${proxyUrl}/.netlify/functions/ksef-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: event.headers['authorization'] || event.headers['Authorization'] || '',
      },
      body: JSON.stringify({ action: 'init', nip, token, env }),
    })
    const data = res.json()
    if (!res.ok) {
      return { httpStatus: res.status, response: data, _ok: false }
    }
    sessionData = data
    return {
      httpStatus: res.status,
      response: {
        sessionToken: mask(data.sessionToken),
        referenceNumber: data.referenceNumber,
        validUntil: data.validUntil,
        hasSymmetricKey: !!data.symmetricKey,
      },
      _ok: true,
    }
  }))
  if (!sessionData) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, env, invoiceId, invoiceNumber: invoice.number, totalDurationMs: Date.now() - t0, steps, error: 'initSession failed' }) }
  }
  if (dryRun) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, env, invoiceId, invoiceNumber: invoice.number, dryRun: true, totalDurationMs: Date.now() - t0, steps }) }
  }

  // STEP 4 — sendInvoice
  steps.push(await timed('sendInvoice', async () => {
    const proxyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888'
    const res = await ksefFetch(`${proxyUrl}/.netlify/functions/ksef-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: event.headers['authorization'] || event.headers['Authorization'] || '',
      },
      body: JSON.stringify({
        sessionToken: sessionData.sessionToken,
        xmlPayload,
        invoiceNumber: invoice.number || `DEBUG-${invoice.id.slice(0, 8)}`,
        referenceNumber: sessionData.referenceNumber,
        symmetricKey: sessionData.symmetricKey,
        iv: sessionData.iv,
        env,
      }),
    })
    const data = res.json()
    return { httpStatus: res.status, response: data, request: { invoiceNumber: invoice.number, xmlSize: xmlPayload.length, env, referenceNumber: sessionData.referenceNumber } }
  }))

  // STEP 5 — closeSession (best effort)
  steps.push(await timed('closeSession', async () => {
    const proxyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888'
    const res = await ksefFetch(`${proxyUrl}/.netlify/functions/ksef-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: event.headers['authorization'] || event.headers['Authorization'] || '',
      },
      body: JSON.stringify({ action: 'close', sessionToken: sessionData.sessionToken, referenceNumber: sessionData.referenceNumber, env }),
    })
    return { httpStatus: res.status, response: res.json() }
  }))

  const sendStep = steps.find((s) => s.step === 'sendInvoice')
  const ok = sendStep && sendStep.status === 'ok' && sendStep.httpStatus >= 200 && sendStep.httpStatus < 300

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok,
      env,
      invoiceId,
      invoiceNumber: invoice.number,
      totalDurationMs: Date.now() - t0,
      steps,
      finalStatus: ok ? { ksefRef: sendStep.response?.ksefRef, status: 'sent' } : null,
      error: ok ? null : (sendStep?.response?.error || sendStep?.error || 'unknown'),
    }),
  }
}
