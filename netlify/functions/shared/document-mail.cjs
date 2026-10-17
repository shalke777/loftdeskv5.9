// Shared by the app's native send-document endpoint and its MCP integration.
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const DOC_LABEL_PL = {
  estimate: 'Wycena',
  contract: 'Umowa',
  invoice:  'Faktura',
  package:  'Pakiet dokumentów',
}

const DOC_ACCUSATIVE_PL = {
  estimate: 'wycenę',
  contract: 'umowę',
  invoice:  'fakturę',
  package:  'pakiet dokumentów',
}


async function sendDocumentMail(options, fetcher=fetch) {
  const {toEmail,documentType,attachments,idempotencyKey,subject}=options
  const documentName=escape(options.documentName)
  const companyName=escape(options.companyName || 'LoftDesk')
  const operatorEmail=escape(options.operatorEmail || '')
  const userMessage=options.userMessage ? escape(options.userMessage) : null
  const documentUrl=options.documentUrl ? escape(options.documentUrl) : null
  const fromEmail=process.env.RESEND_FROM_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(process.env.RESEND_FROM_EMAIL) ? process.env.RESEND_FROM_EMAIL : 'noreply@mail.loftdesk.pl'
  const docLabel  = DOC_LABEL_PL[documentType] ?? 'Dokument'
  const greeting  = `Przesyłamy ${DOC_ACCUSATIVE_PL[documentType] ?? docLabel.toLowerCase()}`
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
<body style="margin:0;padding:0;background:#eef0f3;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#202125;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">LoftDesk</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 16px">${greeting} od <strong>${companyName}</strong>:</p>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin-bottom:24px">
            <p style="margin:0;font-size:15px;font-weight:700;color:#15803d">${docLabel}: ${documentName}</p>
          </div>
          ${msgBlock}
          ${documentUrl ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td align="center" style="background:#77BA8A;border-radius:10px;padding:14px 32px"><a href="${documentUrl}" style="color:#202125;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:-.2px">Otw\u00f3rz dokument w portalu &rarr;</a></td></tr></table>` : ''}
          <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.6">
            W razie pytań skontaktuj się z nami.
            ${operatorEmail ? `Możesz odpowiedzieć bezpośrednio na ten email: <a href="mailto:${operatorEmail}" style="color:#4a8f5e">${operatorEmail}</a>` : ''}
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
    subject:  subject || `${docLabel}: ${documentName}`,
    html,
  }
  if (attachments?.length) payload.attachments = attachments

  // Plain-text headers must retain the original display name.
  payload.from = `${options.companyName || 'LoftDesk'} (przez LoftDesk) <${fromEmail}>`
  payload.subject = subject || `${DOC_LABEL_PL[documentType] || 'Dokument'}: ${options.documentName}`
  payload.reply_to = options.operatorEmail || undefined
  const headers={Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'}
  if(idempotencyKey) headers['Idempotency-Key']=idempotencyKey
  return fetcher('https://api.resend.com/emails',{method:'POST',headers,body:JSON.stringify(payload)})
}
module.exports={sendDocumentMail}
