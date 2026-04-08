// =============================================================================
// check-overdue-invoices.ts — Scheduled daily: mark overdue + send reminders
// =============================================================================
// Runs daily at 08:30 UTC.
//
// Step 1 — Auto-mark overdue:
//   Find invoices with status='unpaid' AND due_date < today → set status='overdue'
//
// Step 2 — Send reminders at day 1, 7, 14 after due_date:
//   For each overdue invoice that hasn't received reminder N yet:
//     - Fetch client email
//     - Send Resend email to client
//     - Insert into invoice_reminders
//     - Update invoices.reminder_count + last_reminder_at
//     - Create operator_notification of type 'payment_reminder'
//
// Requires env vars:
//   SUPABASE_URL or VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL (optional, fallback: noreply@mail.loftdesk.pl)
// =============================================================================

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// Days after due_date when each reminder fires
const REMINDER_DAYS = [1, 7, 14] as const
type ReminderNumber = 1 | 2 | 3

const FROM_FALLBACK = 'noreply@mail.loftdesk.pl'
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_INVOICES  = 500

function diffDays(dueDateStr: string): number {
  const due  = new Date(dueDateStr)
  const now  = new Date()
  due.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - due.getTime()) / 86_400_000)
}

function reminderHtml(params: {
  companyName: string
  invoiceNumber: string
  totalGross: number
  dueDate: string
  daysOverdue: number
  reminderNumber: number
  operatorEmail: string | null
}): string {
  const { companyName, invoiceNumber, totalGross, dueDate, daysOverdue, reminderNumber, operatorEmail } = params
  const formatted = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(totalGross)
  const urgency   = reminderNumber === 3
    ? `⚠️ <strong>Ostatnie przypomnienie</strong> — termin płatności minął ${daysOverdue} dni temu.`
    : reminderNumber === 2
      ? `Uprzejmie przypominamy, że termin płatności minął <strong>${daysOverdue} dni temu</strong>.`
      : `Informujemy, że termin płatności minął <strong>${daysOverdue} dzień temu</strong>.`
  const replyBlock = operatorEmail
    ? `Odpowiedz na ten email lub skontaktuj się bezpośrednio: <a href="mailto:${operatorEmail}" style="color:#4a8f5e">${operatorEmail}</a>`
    : 'Skontaktuj się z nami w celu uregulowania płatności.'

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8" /><title>Przypomnienie o płatności</title></head>
<body style="margin:0;padding:0;background:#eef0f3;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#202125;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">LoftDesk</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 16px">
            Przypomnienie o płatności od <strong>${companyName}</strong>
          </p>
          <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 18px;margin-bottom:20px">
            <p style="margin:0 0 6px;font-size:13px;color:#713f12">Faktura</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#92400e">${invoiceNumber}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:6px 0;border-bottom:1px solid #f3f4f6">Kwota do zapłaty</td>
              <td align="right" style="font-size:14px;font-weight:700;color:#111;padding:6px 0;border-bottom:1px solid #f3f4f6">${formatted}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:6px 0;border-bottom:1px solid #f3f4f6">Termin płatności</td>
              <td align="right" style="font-size:14px;font-weight:600;color:#dc2626;padding:6px 0;border-bottom:1px solid #f3f4f6">${dueDate}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:6px 0">Dni po terminie</td>
              <td align="right" style="font-size:14px;font-weight:700;color:#dc2626;padding:6px 0">${daysOverdue}</td>
            </tr>
          </table>
          <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 20px">${urgency}</p>
          <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.6">${replyBlock}</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            Wiadomość wysłana przez <strong>${companyName}</strong> za pośrednictwem LoftDesk.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export const handler: Handler = async () => {
  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey      = process.env.RESEND_API_KEY
  const envFrom        = process.env.RESEND_FROM_EMAIL ?? ''
  const fromEmail      = EMAIL_RE.test(envFrom) ? envFrom : FROM_FALLBACK

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[check-overdue-invoices] Missing Supabase env vars — skipping')
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'missing_config' }) }
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const todayStr = new Date().toISOString().slice(0, 10)

  // ── Step 1: Mark unpaid invoices as overdue ────────────────────────────────
  const { data: nowOverdue, error: markError } = await sb
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'unpaid')
    .lt('due_date', todayStr)
    .select('id')

  if (markError) {
    console.error('[check-overdue-invoices] Failed to mark overdue:', markError)
  } else {
    console.log(`[check-overdue-invoices] Marked ${nowOverdue?.length ?? 0} invoices as overdue`)
  }

  if (!resendKey) {
    console.warn('[check-overdue-invoices] No RESEND_API_KEY — skipping email reminders')
    return { statusCode: 200, body: JSON.stringify({ marked_overdue: nowOverdue?.length ?? 0, reminders_sent: 0 }) }
  }

  // ── Step 2: Find overdue invoices needing a reminder ───────────────────────
  const { data: overdueInvoices, error: fetchError } = await sb
    .from('invoices')
    .select(`
      id, number, total_gross, due_date, company_id, client_id, reminder_count,
      clients ( name, email ),
      companies ( name, owner_user_id )
    `)
    .eq('status', 'overdue')
    .not('due_date', 'is', null)
    .lt('reminder_count', 3)
    .limit(MAX_INVOICES)

  if (fetchError) {
    console.error('[check-overdue-invoices] Failed to fetch overdue invoices:', fetchError)
    return { statusCode: 500, body: JSON.stringify({ error: fetchError.message }) }
  }

  let remindersSent = 0
  let remindersSkipped = 0

  for (const inv of (overdueInvoices ?? [])) {
    if (!inv.due_date) continue

    const daysOverdue    = diffDays(inv.due_date)
    const currentCount   = inv.reminder_count as number
    // Which reminder number should fire now?
    // reminder_count = 0 → check if day 1+ → fire reminder 1
    // reminder_count = 1 → check if day 7+ → fire reminder 2
    // reminder_count = 2 → check if day 14+ → fire reminder 3
    const nextReminder   = (currentCount + 1) as ReminderNumber
    const daysThreshold  = REMINDER_DAYS[currentCount] // [1,7,14][index]

    if (daysThreshold === undefined || daysOverdue < daysThreshold) {
      remindersSkipped++
      continue
    }

    const clientRecord   = (inv as any).clients as { name?: string; email?: string } | null
    const companyRecord  = (inv as any).companies as { name?: string; owner_user_id?: string } | null
    const clientEmail    = clientRecord?.email?.trim().toLowerCase() ?? null
    const companyName    = companyRecord?.name ?? 'Wykonawca'

    // Fetch operator email for reply-to
    let operatorEmail: string | null = null
    if (companyRecord?.owner_user_id) {
      const { data: profile } = await sb
        .from('profiles')
        .select('email')
        .eq('user_id', companyRecord.owner_user_id)
        .maybeSingle()
      operatorEmail = (profile as any)?.email ?? null
    }

    const invoiceNumber = (inv as any).number ?? 'bez numeru'
    const totalGross    = (inv as any).total_gross as number ?? 0

    let emailStatus: 'sent' | 'failed' = 'failed'
    let emailError: string | null = null

    // Send email if client has email
    if (clientEmail && EMAIL_RE.test(clientEmail)) {
      try {
        const html = reminderHtml({
          companyName,
          invoiceNumber,
          totalGross,
          dueDate: inv.due_date,
          daysOverdue,
          reminderNumber: nextReminder,
          operatorEmail,
        })

        const subject = nextReminder === 3
          ? `⚠️ Ostatnie przypomnienie: Faktura ${invoiceNumber} — płatność przeterminowana`
          : `Przypomnienie o płatności: Faktura ${invoiceNumber}`

        const payload: Record<string, unknown> = {
          from:    `${companyName} (przez LoftDesk) <${fromEmail}>`,
          to:      [clientEmail],
          subject,
          html,
        }
        if (operatorEmail) payload.reply_to = operatorEmail

        const res = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })

        if (res.ok) {
          emailStatus = 'sent'
          remindersSent++
        } else {
          const errBody = await res.text()
          emailError = `HTTP ${res.status}: ${errBody.slice(0, 200)}`
          console.warn(`[check-overdue-invoices] Resend error for invoice ${inv.id}:`, emailError)
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err)
        console.error(`[check-overdue-invoices] Email send exception for invoice ${inv.id}:`, emailError)
      }
    }

    // Always record reminder attempt + update invoice counter
    await sb.from('invoice_reminders').insert({
      company_id:      inv.company_id,
      invoice_id:      inv.id,
      reminder_number: nextReminder,
      recipient_email: clientEmail,
      status:          emailStatus,
      error_message:   emailError,
    })

    await sb.from('invoices').update({
      reminder_count:   nextReminder,
      last_reminder_at: new Date().toISOString(),
    }).eq('id', inv.id)

    // Create operator notification
    await sb.from('operator_notifications').insert({
      company_id:     inv.company_id,
      type:           'payment_reminder',
      title:          `Przypomnienie ${nextReminder}/3 wysłane`,
      body:           `Faktura ${invoiceNumber} — ${daysOverdue} dni po terminie. ${emailStatus === 'sent' ? 'Email do klienta wysłany.' : 'Błąd wysyłki email.'}`,
      reference_type: 'invoice',
      reference_id:   inv.id,
    })
  }

  const result = {
    marked_overdue:    nowOverdue?.length ?? 0,
    reminders_sent:    remindersSent,
    reminders_skipped: remindersSkipped,
    checked:           overdueInvoices?.length ?? 0,
  }
  console.log('[check-overdue-invoices] Done:', result)
  return { statusCode: 200, body: JSON.stringify(result) }
}
