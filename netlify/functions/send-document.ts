const { sendDocumentMail } = require('./shared/document-mail.cjs')
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
  let pdfBase64: string | null = null, pdfFilename: string | null = null
  try {
    const b = JSON.parse(event.body ?? '{}') as Record<string, unknown>
    toEmail       = ((b.to_email       ?? '') as string).trim().toLowerCase()
    documentType  = ((b.document_type  ?? '') as string).trim()
    documentName  = ((b.document_name  ?? '') as string).trim()
    userMessage   = typeof b.message === 'string' ? b.message.trim() : null
    const rawDocUrl = typeof b.document_url === 'string' ? b.document_url.trim() : ''
    documentUrl   = /^https?:\/\//i.test(rawDocUrl) ? rawDocUrl : null
    // PDF attachment support (base64-encoded PDF from client-side generator)
    if (typeof b.pdf_base64 === 'string' && b.pdf_base64.length > 0) {
      pdfBase64 = b.pdf_base64 as string
      pdfFilename = typeof b.pdf_filename === 'string' ? (b.pdf_filename as string).trim() : `${documentName}.pdf`
    }
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

  const resp = await sendDocumentMail({toEmail,documentType,documentName,userMessage,documentUrl,
    operatorEmail,companyName,attachments:pdfBase64 && pdfFilename ? [{filename:pdfFilename,content:pdfBase64}] : []})

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    console.error('[send-document] Resend error:', resp.status, txt)
    return json(500, { ok: false, error: `email_send_failed: ${resp.status}` })
  }

  return json(200, { ok: true, email_sent: true })
}
