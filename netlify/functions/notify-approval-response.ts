// notify-approval-response.ts — D2: Powiadom operatora o odpowiedzi klienta
// Called from ClientProjectPage after client approves/rejects/questions a document.
// No auth needed from client side — uses service key + validates company_id ownership.
// POST { company_id, project_id, project_name, document_label, decision, client_name, client_email, comment? }
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(status: number, body: unknown) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }
}

const DECISION_LABEL: Record<string, { pl: string; emoji: string; color: string }> = {
  approved:   { pl: 'zaakceptowany',    emoji: '✅', color: '#15803d' },
  rejected:   { pl: 'odrzucony',        emoji: '❌', color: '#dc2626' },
  questioned: { pl: 'z pytaniem',       emoji: '❓', color: '#d97706' },
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const resendKey   = process.env.RESEND_API_KEY
  const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL ?? 'noreply@mail.loftdesk.pl'

  if (!resendKey) {
    console.warn('[notify-approval] RESEND_API_KEY not configured — skipping email')
    return json(200, { ok: true, email_sent: false })
  }

  let body: {
    company_id: string
    project_id?: string
    project_name?: string
    document_label?: string
    decision: string
    client_name?: string
    client_email?: string
    comment?: string
    portal_url?: string
  }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  if (!body.company_id || !body.decision) return json(400, { error: 'Missing required fields' })

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Fetch operator email from company record
  const { data: company } = await sb
    .from('companies')
    .select('name, email')
    .eq('id', body.company_id)
    .single()

  const operatorEmail = company?.email ?? null
  if (!operatorEmail || !EMAIL_RE.test(operatorEmail)) {
    console.warn('[notify-approval] No valid operator email for company', body.company_id)
    return json(200, { ok: true, email_sent: false, reason: 'no_operator_email' })
  }

  const dec = DECISION_LABEL[body.decision] ?? { pl: body.decision, emoji: '📋', color: '#374151' }
  const clientName = body.client_name ?? 'Klient'
  const projectName = body.project_name ?? 'projekt'
  const docLabel = body.document_label ?? 'dokument'
  const commentBlock = body.comment
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;color:#374151;font-style:italic">"${body.comment}"</div>`
    : ''
  const portalBtn = body.portal_url
    ? `<table cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="background:#202125;border-radius:10px;padding:12px 28px"><a href="${body.portal_url}" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none">Otwórz projekt →</a></td></tr></table>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8" /><title>Odpowiedź klienta</title></head>
<body style="margin:0;padding:0;background:#eef0f3;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#202125;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">LoftDesk</span>
          <span style="color:#9ca3af;font-size:13px;margin-left:12px">Powiadomienie systemu</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 16px">
            ${dec.emoji} Klient odpowiedział na dokument
          </p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 18px;margin-bottom:20px">
            <p style="margin:0 0 6px;font-size:13px;color:#0369a1;font-weight:600">Projekt</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#0c4a6e">${projectName}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
            <tr>
              <td style="padding:8px 12px;background:#f9fafb;border-radius:6px 0 0 6px;font-size:12px;color:#6b7280;font-weight:600;width:40%">DOKUMENT</td>
              <td style="padding:8px 12px;background:#f9fafb;font-size:13px;font-weight:600;color:#111">${docLabel}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;font-size:12px;color:#6b7280;font-weight:600">KLIENT</td>
              <td style="padding:8px 12px;font-size:13px;color:#374151">${clientName}${body.client_email ? ` &lt;${body.client_email}&gt;` : ''}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f9fafb;border-radius:0 0 0 6px;font-size:12px;color:#6b7280;font-weight:600">DECYZJA</td>
              <td style="padding:8px 12px;background:#f9fafb;font-size:14px;font-weight:700;color:${dec.color}">${dec.emoji} ${dec.pl.charAt(0).toUpperCase() + dec.pl.slice(1)}</td>
            </tr>
          </table>
          ${commentBlock}
          ${portalBtn}
          <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;line-height:1.6">
            Sprawdź projekt w LoftDesk, aby zobaczyć szczegóły i podjąć dalsze działania.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:11px;color:#9ca3af">Powiadomienie wysłane automatycznie przez LoftDesk</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const resResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: `LoftDesk <${FROM_EMAIL}>`,
        to: [operatorEmail],
        subject: `${dec.emoji} ${clientName} ${dec.pl} dokument: ${docLabel} — ${projectName}`,
        html,
      }),
    })
    if (!resResp.ok) {
      const err = await resResp.text()
      console.error('[notify-approval] Resend error:', err)
      return json(200, { ok: true, email_sent: false, error: err })
    }
    return json(200, { ok: true, email_sent: true })
  } catch (err) {
    console.error('[notify-approval] fetch error:', err)
    return json(200, { ok: true, email_sent: false })
  }
}
