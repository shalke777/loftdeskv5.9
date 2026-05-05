// =============================================================================
// Netlify Function: send-invitation
// =============================================================================
// Sends team invitation email via Resend.
// Called server-side after INSERT into company_invitations.
// No auth required — token is the secret; company_name is display-only.
//
// Request: POST /.netlify/functions/send-invitation
//   { email, token, role, company_name, origin? }
//
// Response 200: { sent: true }
// Response 200: { sent: false, reason: string }   ← non-fatal, never blocks invite
// Response 4xx: { error: string }
// =============================================================================

import type { Handler } from '@netlify/functions'

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) }
}

const ROLE_LABELS: Record<string, string> = {
  owner:      'właściciel',
  admin:      'administrator',
  manager:    'kierownik',
  worker:     'pracownik',
  accountant: 'księgowy',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method Not Allowed' })

  // Auth guard — endpoint is called internally by inviteMember() with a Bearer JWT.
  // Prevents external abuse (spam / phishing from LoftDesk domain).
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'Unauthorized: Bearer token required' })
  }

  let body: { email?: string; token?: string; role?: string; company_name?: string; origin?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const { email, token, role, company_name, origin } = body
  if (!email || !token) return json(400, { error: 'email and token are required' })

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[send-invitation] RESEND_API_KEY not configured — skipping email')
    return json(200, { sent: false, reason: 'email_provider_not_configured' })
  }

  const fromEmail  = process.env.RESEND_FROM_EMAIL ?? 'noreply@mail.loftdesk.pl'
  const appOrigin  = origin ?? 'https://app.loftdesk.pl'
  const joinUrl    = `${appOrigin}/join/${token}`
  const rolePl     = ROLE_LABELS[role ?? ''] ?? role ?? 'członek'
  const companyPl  = company_name ?? 'LoftDesk'

  const html = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>Zaproszenie do zespołu ${companyPl}</title></head>
<body style="margin:0;padding:0;background:#eef0f3;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#202125;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">LoftDesk</span>
          <span style="color:#9ca3af;font-size:13px;margin-left:12px">Zaproszenie do zespołu</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 16px">
            👋 Zostałeś zaproszony do zespołu
          </p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 18px;margin-bottom:20px">
            <p style="margin:0 0 4px;font-size:13px;color:#0369a1;font-weight:600">Firma</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#0c4a6e">${companyPl}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td style="padding:8px 12px;background:#f9fafb;border-radius:6px 0 0 6px;font-size:12px;color:#6b7280;font-weight:600;width:40%">ROLA</td>
              <td style="padding:8px 12px;background:#f9fafb;font-size:13px;font-weight:600;color:#111;text-transform:capitalize">${rolePl}</td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
            <tr>
              <td style="background:#202125;border-radius:10px;padding:14px 32px">
                <a href="${joinUrl}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none">
                  Dołącz do zespołu →
                </a>
              </td>
            </tr>
          </table>
          <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.6">
            Link jest jednorazowy i wygasa po 7 dniach.<br>
            Jeśli nie oczekiwałeś tego zaproszenia, zignoruj tę wiadomość.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:11px;color:#9ca3af">Zaproszenie wysłane przez LoftDesk • ${companyPl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `LoftDesk <${fromEmail}>`,
        to: [email],
        subject: `Zaproszenie do zespołu ${companyPl} — LoftDesk`,
        html,
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error('[send-invitation] Resend error:', err)
      return json(200, { sent: false, reason: 'resend_error', detail: err })
    }

    return json(200, { sent: true })
  } catch (err) {
    console.error('[send-invitation] fetch error:', err)
    return json(200, { sent: false, reason: 'network_error' })
  }
}
