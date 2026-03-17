// =============================================================================
// Netlify Function: send-document
// =============================================================================
// Sends a document notification email via Resend.
// Authorization: Bearer <operator_jwt> (same pattern as client-identify).
//
// Request: POST /.netlify/functions/send-document
//   { to_email, document_type, document_name, message? }
//
// Response 200: { ok: true, email_sent: true }
// Response 200: { ok: false, email_sent: false, error: 'email_provider_not_configured' }
// Response 4xx: { ok: false, error: string }
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import type { Handler, HandlerEvent } from '@netlify/functions'

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) }
}

function sbPublic() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function sbAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

const DOC_LABEL_PL: Record<string, string> = {
  estimate: 'Wycena',
  contract: 'Umowa',
  invoice:  'Faktura',
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST')    return json(405, { ok: false, error: 'method_not_allowed' })

  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = event.headers['authorization'] ?? event.headers['Authorization']
  if (!auth?.startsWith('Bearer ')) return json(401, { ok: false, error: 'unauthorized' })
  const jwt = auth.slice(7)

  let operatorEmail: string | null = null
  let companyName = 'LoftDesk'
  try {
    const pub = sbPublic()
    const { data: { user }, error } = await pub.auth.getUser(jwt)
    if (error || !user) return json(401, { ok: false, error: 'unauthorized' })

    // Fetch operator email + company name (best-effort, non-fatal if missing)
    const sb = sbAdmin()
    const { data: member } = await sb
      .from('company_members')
      .select('profiles(email, full_name), companies(name)')
      .eq('user_id', user.id)
      .maybeSingle()
    if (member) {
      operatorEmail = (member as any)?.profiles?.email ?? null
      companyName   = (member as any)?.companies?.name ?? 'LoftDesk'
    }
  } catch {
    return json(401, { ok: false, error: 'unauthorized' })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let toEmail: string, documentType: string, documentName: string, userMessage: string | null, documentUrl: string | null
  try {
    const b = JSON.parse(event.body ?? '{}') as Record<string, unknown>
    toEmail       = ((b.to_email       ?? '') as string).trim().toLowerCase()
    documentType  = ((b.document_type  ?? '') as string).trim()
    documentName  = ((b.document_name  ?? '') as string).trim()
    userMessage   = typeof b.message === 'string' ? b.message.trim() : null
    documentUrl   = typeof b.document_url === 'string' && b.document_url.trim() ? b.document_url.trim() : null
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!toEmail || !EMAIL_RE.test(toEmail)) return json(400, { ok: false, error: 'invalid_email' })
  if (!documentName) return json(400, { ok: false, error: 'document_name_required' })

  // ── Send via Resend ───────────────────────────────────────────────────────
  const FROM_FALLBACK = 'noreply@mail.loftdesk.pl'
  const envFrom   = process.env.RESEND_FROM_EMAIL ?? ''
  const fromEmail = EMAIL_RE.test(envFrom) ? envFrom : FROM_FALLBACK
  if (envFrom && !EMAIL_RE.test(envFrom)) {
    console.warn(`[send-document] RESEND_FROM_EMAIL='${envFrom}' is not a valid email — using fallback '${FROM_FALLBACK}'`)
  }
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.error('[send-document] Missing RESEND_API_KEY env var')
    return json(200, { ok: false, email_sent: false, error: 'email_provider_not_configured' })
  }

  const docLabel  = DOC_LABEL_PL[documentType] ?? 'Dokument'
  const greeting  = `Przesyłamy ${docLabel.toLowerCase()}`
  const msgBlock  = userMessage
    ? `<p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 20px">${userMessage.replace(/\n/g, '<br />')}</p>`
    : ''

  const html = `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <title>${docLabel}: ${documentName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#1a5c32;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">LoftDesk</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 16px">${greeting} od <strong>${companyName}</strong>:</p>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin-bottom:24px">
            <p style="margin:0;font-size:15px;font-weight:700;color:#15803d">${docLabel}: ${documentName}</p>
          </div>
          ${msgBlock}
          ${documentUrl ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td align="center" style="background:#1a5c32;border-radius:10px;padding:14px 32px"><a href="${documentUrl}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:-.2px">Otw\u00f3rz dokument w portalu &rarr;</a></td></tr></table>` : ''}
          <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.6">
            W razie pytań skontaktuj się z nami.
            ${operatorEmail ? `Możesz odpowiedzieć bezpośrednio na ten email: <a href="mailto:${operatorEmail}" style="color:#1a5c32">${operatorEmail}</a>` : ''}
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">Wiadomość wysłana przez <strong>${companyName}</strong> za pośrednictwem LoftDesk.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const fromLabel = `${companyName} (przez LoftDesk)`
  const payload = {
    from:     `${fromLabel} <${fromEmail}>`,
    to:       [toEmail],
    reply_to: operatorEmail ?? undefined,
    subject:  `${docLabel}: ${documentName}`,
    html,
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    console.error('[send-document] Resend error:', resp.status, txt)
    return json(500, { ok: false, error: `email_send_failed: ${resp.status}` })
  }

  return json(200, { ok: true, email_sent: true })
}
