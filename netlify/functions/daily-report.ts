// daily-report.ts — Raport dzienny projektu
// POST { project_id: string, date?: string (YYYY-MM-DD, default: today) } + Bearer auth
// Returns HTML blob suitable for print/PDF
import type { Handler } from '@netlify/functions'
import { assertProjectAccess, isScopeError, scopeErrorResponse } from '../lib/scope/assertProjectAccess'

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '—'
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(val)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function buildHtml(data: {
  projectName: string
  projectNumber: string
  date: string
  photos: Array<{ title: string; image_url: string; category: string; note?: string | null }>
  expenses: Array<{ vendor?: string | null; invoice_number?: string | null; amount_gross?: number | null; description?: string | null }>
  voiceNotes: Array<{ title: string; summary?: string | null; decisions?: string[]; amounts?: Array<{ description: string; amount: number; currency?: string }> }>
  notes: string[]
}): string {
  const dateFormatted = new Date(data.date).toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const totalExpenses = data.expenses.reduce((s, e) => s + (e.amount_gross ?? 0), 0)

  const photosHtml = data.photos.length === 0 ? '<p style="color:#888;font-size:13px;">Brak zdjęć</p>' : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:12px;">
      ${data.photos.map(p => `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <img src="${p.image_url}" alt="${p.title}" style="width:100%;height:120px;object-fit:cover;display:block;" />
          <div style="padding:8px;">
            <div style="font-size:12px;font-weight:600;">${p.title || '(bez tytułu)'}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">${p.category}</div>
            ${p.note ? `<div style="font-size:11px;color:#374151;margin-top:4px;">${p.note}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`

  const expensesHtml = data.expenses.length === 0 ? '<p style="color:#888;font-size:13px;">Brak kosztów</p>' : `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Dostawca</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Nr faktury</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Opis</th>
        <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">Kwota brutto</th>
      </tr></thead>
      <tbody>
        ${data.expenses.map((e, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
            <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${e.vendor ?? '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${e.invoice_number ?? '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${e.description ?? '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${formatCurrency(e.amount_gross)}</td>
          </tr>`).join('')}
        <tr style="background:#f0fdf4;">
          <td colspan="3" style="padding:10px;font-weight:700;border-top:2px solid #e5e7eb;">SUMA KOSZTÓW DNIA</td>
          <td style="padding:10px;text-align:right;font-weight:700;border-top:2px solid #e5e7eb;color:#059669;">${formatCurrency(totalExpenses)}</td>
        </tr>
      </tbody>
    </table>`

  const voiceNotesHtml = data.voiceNotes.length === 0 ? '<p style="color:#888;font-size:13px;">Brak notatek głosowych</p>' : data.voiceNotes.map(n => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">🎤 ${n.title}</div>
      ${n.summary ? `<p style="font-size:13px;color:#374151;margin:0 0 8px;">${n.summary}</p>` : ''}
      ${n.decisions?.length ? `<div style="font-size:12px;"><strong>Ustalenia:</strong><ul style="margin:4px 0 0 0;padding-left:16px;">${n.decisions.map(d => `<li>${d}</li>`).join('')}</ul></div>` : ''}
      ${n.amounts?.length ? `<div style="font-size:12px;margin-top:6px;"><strong>Kwoty:</strong><ul style="margin:4px 0 0 0;padding-left:16px;">${n.amounts.map(a => `<li>${a.description}: ${a.amount} ${a.currency ?? 'PLN'}</li>`).join('')}</ul></div>` : ''}
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Raport dzienny — ${data.projectName} — ${data.date}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #111827; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 15px; font-weight: 700; margin: 24px 0 0; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; color: #111827; }
    .meta { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
    .badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: #d1fae5; color: #065f46; margin-left: 8px; }
    .summary-row { display: flex; gap: 20px; margin: 16px 0; flex-wrap: wrap; }
    .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; min-width: 120px; text-align: center; }
    .summary-card .num { font-size: 24px; font-weight: 700; color: #111827; }
    .summary-card .lbl { font-size: 11px; color: #6b7280; margin-top: 2px; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
    <div>
      <h1>${data.projectName} <span style="font-size:14px;color:#6b7280;font-weight:400;">${data.projectNumber}</span></h1>
      <div class="meta">📅 Raport dzienny — ${dateFormatted}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 18px;background:#111827;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">🖨️ Drukuj / PDF</button>
  </div>

  <div class="summary-row">
    <div class="summary-card"><div class="num">${data.photos.length}</div><div class="lbl">Zdjęcia</div></div>
    <div class="summary-card"><div class="num">${data.expenses.length}</div><div class="lbl">Koszty</div></div>
    <div class="summary-card"><div class="num" style="color:#059669;">${formatCurrency(totalExpenses)}</div><div class="lbl">Suma kosztów</div></div>
    <div class="summary-card"><div class="num">${data.voiceNotes.length}</div><div class="lbl">Notatki głosowe</div></div>
  </div>

  <h2>📸 Zdjęcia (${data.photos.length})</h2>
  ${photosHtml}

  <h2>💰 Koszty (${data.expenses.length})</h2>
  ${expensesHtml}

  <h2>🎤 Notatki głosowe (${data.voiceNotes.length})</h2>
  ${voiceNotesHtml}

  <footer>Wygenerowano przez LoftDesk · ${new Date().toLocaleString('pl-PL')}</footer>
</body>
</html>`
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const anonKey    = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  void supabaseUrl; void anonKey; void serviceKey

  let body: { project_id?: string; date?: string }
  try { body = JSON.parse(event.body ?? '{}') } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }
  if (!body.project_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'project_id required' }) }

  // Sprint P2-FIX: scoped access — JWT + membership + project ownership.
  const scope = await assertProjectAccess(event, body.project_id)
  if (isScopeError(scope)) return scopeErrorResponse(scope, cors)
  const { sb, project: projectRow } = scope
  const projectId = projectRow.id as string

  const date = body.date ?? new Date().toISOString().slice(0, 10)

  const project = projectRow as { id: string; name?: string; number?: string }
  if (!project) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Project not found' }) }

  // Fetch all data for the day in parallel
  const [photosRes, expensesRes, voiceRes] = await Promise.all([
    sb.from('project_photo_docs')
      .select('title, image_url, category, note')
      .eq('project_id', projectId)
      .gte('created_at', `${date}T00:00:00.000Z`)
      .lte('created_at', `${date}T23:59:59.999Z`)
      .order('created_at', { ascending: true }),

    sb.from('expense_invoices')
      .select('vendor, invoice_number, amount_gross, description')
      .eq('project_id', projectId)
      .gte('created_at', `${date}T00:00:00.000Z`)
      .lte('created_at', `${date}T23:59:59.999Z`)
      .order('created_at', { ascending: true }),

    sb.from('voice_notes')
      .select('title, extracted_result')
      .eq('project_id', projectId)
      .eq('status', 'processed')
      .gte('created_at', `${date}T00:00:00.000Z`)
      .lte('created_at', `${date}T23:59:59.999Z`)
      .order('created_at', { ascending: true }),
  ])

  const photos = photosRes.data ?? []
  const expenses = expensesRes.data ?? []
  const voiceNotes = (voiceRes.data ?? []).map((n: any) => ({
    title: n.title,
    summary: n.extracted_result?.summary ?? null,
    decisions: n.extracted_result?.decisions ?? [],
    amounts: n.extracted_result?.amounts ?? [],
  }))

  const html = buildHtml({
    projectName: project.name ?? '',
    projectNumber: project.number ?? '',
    date,
    photos,
    expenses,
    voiceNotes,
    notes: [],
  })

  const summary = {
    photos: photos.length,
    expenses: expenses.length,
    voiceNotes: voiceNotes.length,
    totalExpenses: expenses.reduce((s: number, e: any) => s + (e.amount_gross ?? 0), 0),
  }

  return {
    statusCode: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ html, summary, date }),
  }
}
