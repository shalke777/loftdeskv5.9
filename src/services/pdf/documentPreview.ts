import type { Estimate } from '@/entities/estimate/model'
import type { Invoice } from '@/entities/invoice/model'
import type { Contract } from '@/entities/contract/model'
import type { HandoverProtocol } from '@/entities/documentation/model'
import type { Project } from '@/entities/project/model'
import type { Client } from '@/entities/client/model'
import { formatCurrency } from '@/shared/lib/formatters'

type Party = {
  name?: string
  address?: string
  postalCity?: string
  nip?: string
  email?: string
  phone?: string
}

type CompanyMeta = Party & {
  bankAccount?: string
  logoUrl?: string
}

function replaceEvery(value: string, search: string, replacement: string) {
  return value.split(search).join(replacement)
}

function escapeHtml(value: string) {
  return replaceEvery(replaceEvery(replaceEvery(replaceEvery(replaceEvery(value, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), "'", '&#39;')
}

function pageShell(title: string, subtitle: string, content: string) {
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  :root { --accent:#16A34A; --ink:#0F172A; --muted:#6B7280; --line:#E5E7EB; --soft:#F9FAFB; }
  * { box-sizing:border-box; }
  body { margin:0; font-family: Inter, Arial, sans-serif; background:#eef2f7; color:var(--ink); font-size:13px; line-height:1.55; }
  .doc { width: 900px; margin: 24px auto; background:#fff; box-shadow: 0 18px 50px rgba(15,23,42,.12); }
  .page { min-height: 1260px; display:flex; flex-direction:column; background:#fff; }
  .topbar { height: 74px; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:space-between; padding: 0 42px; }
  .topbar__title { font-size: 18px; font-weight: 600; letter-spacing: .01em; }
  .content { padding: 44px 54px 36px; flex:1; }
  .footer { margin-top:auto; background:var(--accent); color:#fff; padding: 16px 42px; font-size:11px; display:flex; justify-content:center; gap: 18px; }
  /* H1 — 26pt SemiBold */
  .doc-title { text-align:center; color:var(--accent); font-size: 26px; font-weight: 700; margin: 8px 0 18px; }
  /* H2 — 18pt SemiBold */
  .doc-number { text-align:center; font-size: 18px; font-weight: 600; margin-top: -8px; margin-bottom: 24px; }
  /* Meta — 11pt Regular */
  .meta { text-align:center; color:var(--muted); font-size: 11px; font-weight: 400; margin-bottom: 18px; }
  .party-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin: 18px 0 24px; }
  .party-box { border:1px solid var(--line); border-radius: 18px; padding: 18px; background: #fbfcff; }
  /* H3 — 14pt Medium */
  .party-box h3 { margin:0 0 10px; color:var(--accent); font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing:.04em; }
  /* H2 inside party */
  .party-box strong { display:block; margin-bottom: 8px; font-size: 18px; font-weight: 600; }
  /* Body — 13pt Regular */
  .party-box p { margin: 5px 0; color:var(--muted); font-size: 13px; font-weight: 400; line-height: 1.45; }
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 18px;
    border-radius: 14px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 2px 8px rgba(31,41,55,0.04);
  }
  /* Body in cells */
  th, td {
    border: none;
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 400;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  /* H3 in table header */
  thead th {
    background: #f3f4f6;
    color: var(--ink);
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
    letter-spacing: .01em;
    border-bottom: 2px solid #e5e7eb;
  }
  thead th:first-child { border-top-left-radius: 14px; }
  thead th:last-child { border-top-right-radius: 14px; }
  tbody tr:not(:last-child) td {
    border-bottom: 1px solid #e5e7eb;
  }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  td.num, th.num { text-align: right; }
  td.center, th.center { text-align: center; }
  .totals-box { margin-left:auto; width: 340px; border: 3px solid var(--accent); border-radius: 18px; padding: 18px 20px; margin-top: 28px; }
  .totals-line { display:flex; justify-content:space-between; gap:16px; padding: 8px 0; font-weight: 600; font-size: 13px; }
  /* BRUTTO — H1 equivalent */
  .totals-line strong { color: var(--accent); font-size: 26px; font-weight: 700; }
  .notice { margin-top: 30px; padding: 16px 20px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 14px; color: #92400e; text-align:center; font-size: 13px; }
  .section { margin-top: 28px; }
  /* H2 for section headings — professional legal doc style */
  .section h2 { margin: 0 0 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; text-align: left; padding-bottom: 6px; border-bottom: 1.5px solid var(--accent); color: var(--ink); }
  /* Body for paragraphs — justified for professional legal appearance */
  .section p, .section li { color: var(--ink); line-height: 1.7; font-size: 13px; font-weight: 400; text-align: justify; hyphens: auto; }
  .section ol { padding-left: 24px; margin: 6px 0; }
  .section ol li { margin-bottom: 5px; }
  /* Meta */
  .small { color: var(--muted); font-size: 11px; font-weight: 400; }
  .signature-grid { display:grid; grid-template-columns:1fr 1fr; gap: 36px; margin-top: 80px; }
  .signature { padding-top: 14px; border-top: 1px solid var(--ink); color:var(--ink); font-size: 13px; }
  .logo-mark { width:54px; height:54px; border-radius:999px; border:4px solid #111; background:var(--accent); color:#fff; display:grid; place-items:center; font-weight:800; }
  .invoice-head { display:flex; justify-content:space-between; align-items:flex-start; gap: 18px; }
  .summary-table { width: 330px; margin-left: auto; margin-top: 20px; }
  /* Body for summary rows */
  .summary-table td { font-size: 13px; font-weight: 400; }
  /* H1 for total row */
  .summary-table tr:last-child td { font-weight: 700; font-size: 18px; }
  .page-break { page-break-before: always; }
  .checklist { display:grid; gap:10px; margin-top:18px; }
  .check { border:1px solid var(--line); border-radius:14px; padding:12px 14px; display:flex; justify-content:space-between; gap:16px; font-size: 13px; }
  .chip { display:inline-flex; padding:6px 10px; border-radius:999px; background:#e8f5ee; color:var(--accent); font-size:14px; font-weight: 500; }
  @page { size: A4 portrait; margin: 12mm 10mm 10mm; }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .doc { width: 100%; margin: 0; box-shadow: none; padding-bottom: 22mm; }
    .page { min-height: auto; break-after: page; }
    .topbar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Footer fixed at very bottom of each printed page, separated from content */
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding-top: 8mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* Allow tables to flow across page breaks instead of cutting mid-row */
    table {
      overflow: visible !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      page-break-inside: auto;
    }
    /* Keep individual rows together — never split a row across pages */
    tr { page-break-inside: avoid; break-inside: avoid; }
    /* Repeat table header on every page */
    thead { display: table-header-group; }
    /* td/th: remove overflow:hidden so content isn't clipped at page boundary */
    td, th { overflow: visible; }
    .party-grid { break-inside: avoid; }
    .totals-box { break-inside: avoid; }
    .signature-grid { break-inside: avoid; }
    /* Keep section heading attached to its first paragraph — never orphan an h2 at page bottom */
    .section h2 { break-after: avoid; page-break-after: avoid; }
    /* Keep small sections (≤ ~3 lines) together entirely */
    .section { break-inside: auto; }
    /* Tranche table rows — avoid splitting a payment row */
    .section table tr { page-break-inside: avoid; break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="doc" aria-label="${escapeHtml(subtitle)}">${content}</div>
</body>
</html>`
}

function footer(company?: CompanyMeta) {
  const phone = company?.phone || ''
  const email = company?.email || ''
  if (!phone && !email) return ''
  return `<div class="footer">${phone ? `<span>${escapeHtml(phone)}</span>` : ''}${phone && email ? '<span>|</span>' : ''}${email ? `<span>${escapeHtml(email)}</span>` : ''}</div>`
}

function partyBox(title: string, party?: Party, fallbackName?: string) {
  return `<div class="party-box">
    <h3>${escapeHtml(title)}</h3>
    <strong>${escapeHtml(party?.name || fallbackName || '—')}</strong>
    <p>${escapeHtml(party?.address || '—')}</p>
    <p>${escapeHtml(party?.postalCity || '')}</p>
    <p>${party?.nip ? `NIP ${escapeHtml(party.nip)}` : 'NIP —'}</p>
    ${party?.email ? `<p>${escapeHtml(party.email)}</p>` : ''}
    ${party?.phone ? `<p>${escapeHtml(party.phone)}</p>` : ''}
  </div>`
}

function defaultCompany(company?: CompanyMeta): CompanyMeta {
  return {
    name: company?.name || 'Uzupełnij nazwę firmy',
    address: company?.address || 'Uzupełnij adres w ustawieniach',
    postalCity: company?.postalCity || '',
    nip: company?.nip || '',
    email: company?.email || '',
    phone: company?.phone || '',
    bankAccount: company?.bankAccount || '',
    logoUrl: company?.logoUrl || '',
  }
}

function logoMark(company: CompanyMeta, style?: string): string {
  if (company.logoUrl) {
    return `<img src="${escapeHtml(company.logoUrl)}" alt="Logo" style="max-width:120px; max-height:60px; object-fit:contain;${style ? ' ' + style : ''}" />`
  }
  return `<div class="logo-mark"${style ? ` style="${style}"` : ''}>LD</div>`
}

export function buildEstimatePreview(estimate: Estimate, client?: Party, companyInput?: CompanyMeta) {
  const company = defaultCompany(companyInput)
  const rows = estimate.items
    .map((item) => {
      const net = item.quantity * item.unit_price
      const gross = net * (1 + item.vat_rate / 100)
      return `<tr>
        <td>${escapeHtml(item.name)}${item.description ? `<div class="small">${escapeHtml(item.description)}</div>` : ''}</td>
        <td class="num">${item.quantity.toFixed(2)}</td>
        <td class="center">${escapeHtml(item.unit)}</td>
        <td class="num">${formatCurrency(item.unit_price)}</td>
        <td class="center">${item.vat_rate}%</td>
        <td class="num">${formatCurrency(net)}</td>
        <td class="num">${formatCurrency(gross)}</td>
      </tr>`
    })
    .join('')
  const vatRate = estimate.items[0]?.vat_rate ?? 23
  const totalVat = estimate.total_gross - estimate.total_net
  const page = `<section class="page">
    <div class="topbar"><div class="topbar__title">WYCENA</div>${logoMark(company)}</div>
    <div class="content">
      <div class="doc-title">WYCENA</div>
      <div class="meta">Numer: ${escapeHtml(estimate.number)}<br/>Data wystawienia: ${escapeHtml((estimate.created_at || '').slice(0, 10))}</div>
      <div class="party-grid">
        ${partyBox('Wykonawca', company, company.name)}
        ${partyBox('Nabywca', client, client?.name)}
      </div>
      <table>
        <colgroup>
          <col style="width:38%"/>
          <col style="width:8%"/>
          <col style="width:8%"/>
          <col style="width:12%"/>
          <col style="width:7%"/>
          <col style="width:13%"/>
          <col style="width:14%"/>
        </colgroup>
        <thead><tr>
          <th>Pozycja / Opis</th>
          <th class="num">Ilość</th>
          <th class="center">J.m.</th>
          <th class="num">Cena jedn.</th>
          <th class="center">VAT</th>
          <th class="num">Netto</th>
          <th class="num">Brutto</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals-box">
        <div class="totals-line"><span>Razem netto:</span><span>${formatCurrency(estimate.total_net)}</span></div>
        <div class="totals-line"><span>Razem VAT (${vatRate}%):</span><span>${formatCurrency(totalVat)}</span></div>
        <div class="totals-line"><strong>RAZEM BRUTTO:</strong><strong>${formatCurrency(estimate.total_gross)}</strong></div>
      </div>
      ${estimate.estimate_type !== 'final' ? '<div class="notice"><strong>Uwaga:</strong> Wycena ma charakter informacyjny. Ostateczna cena może ulec zmianie po wizji lokalnej.</div>' : ''}
    </div>
    ${footer(company)}
  </section>`
  return pageShell(estimate.number, estimate.name, page)
}

type InvoiceContractMeta = { contractNumber?: string; contractLocation?: string }

export function buildInvoicePreview(invoice: Invoice, client?: Party, contractMeta?: InvoiceContractMeta, companyInput?: CompanyMeta) {
  const company = defaultCompany(companyInput)
  const invoiceType = invoice.invoice_type ?? 'standard'

  const typeTitles: Record<string, string> = {
    standard: 'FAKTURA VAT',
    advance: 'FAKTURA ZALICZKOWA',
    final: 'FAKTURA KO\u0143COWA',
    partial: 'FAKTURA CZ\u0118\u015aCIOWA',
    correction: 'FAKTURA KORYGUJ\u0104CA',
  }
  const typeTagBg: Record<string, string> = {
    standard: '#1d4ed8',
    advance: '#7c3aed',
    final: '#065f46',
    partial: '#92400e',
    correction: '#991b1b',
  }
  const invoiceTitle = typeTitles[invoiceType] ?? 'FAKTURA VAT'
  const tagBg = typeTagBg[invoiceType] ?? '#1d4ed8'

  // 9-column items table
  const itemRows = invoice.items.map((item, idx) => {
    const net = item.quantity * item.unit_price
    const vatAmt = net * item.vat_rate / 100
    const gross = net + vatAmt
    return `<tr>
      <td class="center">${idx + 1}</td>
      <td>${escapeHtml(item.description)}${item.tranche_label ? `<br/><span class="small">${escapeHtml(item.tranche_label)}</span>` : ''}</td>
      <td class="center">${escapeHtml(item.unit)}</td>
      <td class="num">${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)}</td>
      <td class="num">${formatCurrency(item.unit_price)}</td>
      <td class="num">${formatCurrency(net)}</td>
      <td class="center">${item.vat_rate === 0 ? 'ZW' : item.vat_rate + '%'}</td>
      <td class="num">${formatCurrency(vatAmt)}</td>
      <td class="num">${formatCurrency(gross)}</td>
    </tr>`
  }).join('')

  // VAT breakdown grouped by rate
  const vatMap: Record<string, { net: number; vatAmt: number; gross: number }> = {}
  for (const item of invoice.items) {
    const k = String(item.vat_rate)
    const net = item.quantity * item.unit_price
    const vatAmt = net * item.vat_rate / 100
    if (!vatMap[k]) vatMap[k] = { net: 0, vatAmt: 0, gross: 0 }
    vatMap[k].net += net; vatMap[k].vatAmt += vatAmt; vatMap[k].gross += net + vatAmt
  }
  const vatRows = Object.entries(vatMap).map(([rate, g]) => `<tr>
    <td class="center">${Number(rate) === 0 ? 'ZW' : rate + '%'}</td>
    <td class="num">${formatCurrency(g.net)}</td>
    <td class="num">${formatCurrency(g.vatAmt)}</td>
    <td class="num">${formatCurrency(g.gross)}</td>
  </tr>`).join('')

  const totalVat = invoice.total_gross - invoice.total_net
  const advanceTotal = invoice.advance_total ?? 0
  const remainsToPay = Math.max(0, invoice.total_gross - advanceTotal)

  const paymentMethod = invoice.payment_method ?? 'transfer'
  const paymentMethodLabel = ({ transfer: 'Przelew bankowy', cash: 'Got\u00f3wka', card: 'Karta p\u0142atnicza' } as Record<string, string>)[paymentMethod] ?? 'Przelew bankowy'
  const bankAccount = invoice.bank_account || company.bankAccount || ''

  const contractRefHtml = contractMeta?.contractNumber
    ? `<div style="margin:18px 0; padding:10px 18px; background:var(--soft); border-radius:10px; border-left:4px solid var(--red); font-size:14px;">
        ${invoiceType === 'advance' ? 'Faktura zaliczkowa na poczet realizacji'
          : invoiceType === 'final' ? 'Faktura ko\u0144cowa \u2013 rozliczenie'
          : invoiceType === 'partial' ? 'Faktura cz\u0105stkowa \u2013 realizacja'
          : 'Faktura dotycz\u0105ca'}
        <strong> umowy nr ${escapeHtml(contractMeta.contractNumber)}</strong>${contractMeta.contractLocation ? ` &nbsp;\u00b7&nbsp; Inwestycja: <em>${escapeHtml(contractMeta.contractLocation)}</em>` : ''}
      </div>`
    : ''

  const advanceDeductionHtml = invoiceType === 'final' && advanceTotal > 0
    ? `<div class="totals-line" style="font-size:14px; color:var(--muted);"><span>Wcze\u015bniejsze zaliczki:</span><span>\u2212&nbsp;${formatCurrency(advanceTotal)}</span></div>
       <div class="totals-line" style="border-top:2px solid var(--red); padding-top:8px; margin-top:4px;"><strong>POZOSTA\u0141O DO ZAP\u0141ATY:</strong><strong style="color:var(--red);">${formatCurrency(remainsToPay)}</strong></div>`
    : ''

  const ksefInfo = invoice.ksef_status === 'ksef_sent'
    ? `Faktura wyeksportowana do KSeF \u00b7 Ref: ${escapeHtml(invoice.ksef_ref || '\u2014')}`
    : 'Faktura oczekuje na wysy\u0142k\u0119 do KSeF'

  // ── Correction: header data comparison table ─────────────────────────────────
  const headerCorrectionHtml: string = (() => {
    if (invoiceType !== 'correction' || !invoice.original_data) return ''
    const od = invoice.original_data as Record<string, string | null>
    const LABELS: Record<string, string> = {
      client_name: 'Nabywca', client_nip: 'NIP nabywcy', client_address: 'Adres nabywcy',
      issue_date: 'Data wystawienia', sale_date: 'Data sprzeda\u017cy',
      due_date: 'Termin p\u0142atno\u015bci', issue_place: 'Miejsce wystawienia',
      payment_method: 'Forma p\u0142atno\u015bci', bank_account: 'Nr rachunku bankowego',
      notes: 'Uwagi',
    }
    const currentData: Record<string, string | null> = {
      client_name: client?.name ?? null, client_nip: client?.nip ?? null,
      client_address: client?.address ?? null,
      issue_date: invoice.issue_date ?? null, sale_date: invoice.sale_date ?? null,
      due_date: invoice.due_date ?? null, issue_place: invoice.issue_place ?? null,
      payment_method: invoice.payment_method ?? null, bank_account: invoice.bank_account ?? null,
      notes: invoice.notes ?? null,
    }
    const changed = Object.entries(LABELS).filter(([k]) => (od[k] ?? null) !== (currentData[k] ?? null))
    if (changed.length === 0) return ''
    const rows = changed.map(([k, label]) => `<tr>
      <td style="font-size:13px;">${escapeHtml(label)}</td>
      <td style="font-size:13px; color:#991b1b;">${escapeHtml(od[k] ?? '\u2014')}</td>
      <td style="font-size:13px; color:#166534;">${escapeHtml(currentData[k] ?? '\u2014')}</td>
    </tr>`).join('')
    return `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">Korygowane dane nag\u0142\u00f3wkowe</div>
      <table>
        <thead><tr>
          <th style="width:25%;">Pole</th>
          <th style="background:rgba(153,27,27,0.08); color:#991b1b;">Przed korekt\u0105</th>
          <th style="background:rgba(22,101,52,0.08); color:#166534;">Po korekcie</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  })()

  const page = `<section class="page">
    <div class="topbar">
      <div class="topbar__title">${invoiceTitle}</div>
      <span style="background:rgba(255,255,255,.2); padding:4px 16px; border-radius:999px; font-size:14px; font-weight:700;">Nr ${escapeHtml(invoice.number ?? 'Szkic')}</span>
    </div>
    <div class="content">
      <div class="invoice-head" style="margin-bottom:18px;">
        <div>
          <div style="display:inline-block; padding:3px 14px; border-radius:999px; background:${tagBg}; color:#fff; font-size:12px; font-weight:700; margin-bottom:12px; letter-spacing:.03em;">${invoiceTitle}</div>
          <div style="font-size:14px; line-height:2.1;">
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Numer faktury:</span> <strong>${escapeHtml(invoice.number ?? 'Szkic')}</strong></div>
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Data wystawienia:</span> ${escapeHtml(invoice.issue_date)}</div>
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Data sprzeda\u017cy / us\u0142ugi:</span> ${escapeHtml(invoice.sale_date || invoice.issue_date)}</div>
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Miejsce wystawienia:</span> ${escapeHtml(invoice.issue_place || contractMeta?.contractLocation || '\u2014')}</div>
            ${contractMeta?.contractNumber ? `<div><span style="color:var(--muted); display:inline-block; width:210px;">Nr umowy:</span> <strong>${escapeHtml(contractMeta.contractNumber)}</strong></div>` : ''}
            ${invoiceType === 'correction' ? `<div style="margin-top:4px;"><span style="color:#991b1b; display:inline-block; width:210px; font-weight:600;">Korekta do faktury:</span> <strong>${escapeHtml(invoice.correction_reason ? '' : '')}</strong><span style="font-style:italic; color:var(--muted);">— patrz zestawienie poniżej</span></div>` : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="margin-left:auto; margin-bottom:14px;">${logoMark(company)}</div>
          <div style="font-size:12px; color:var(--muted);">Termin p\u0142atno\u015bci</div>
          <div style="font-size:22px; font-weight:800; color:var(--red);">${escapeHtml(invoice.due_date || '\u2014')}</div>
        </div>
      </div>

      <div class="party-grid">
        ${partyBox('Sprzedawca', company, company.name)}
        ${partyBox('Nabywca', client, 'Dane klienta')}
      </div>

      ${contractRefHtml}

      ${headerCorrectionHtml}

      ${invoiceType === 'correction' && invoice.original_items?.length ? (() => {
        // Correction invoice: show before/after comparison table
        const origItems = invoice.original_items!
        const corrItems = invoice.items

        function itemGross(item: { quantity: number; unit_price: number; vat_rate: number }) {
          const net = item.quantity * item.unit_price
          return net + net * item.vat_rate / 100
        }
        const origGross = origItems.reduce((s, i) => s + itemGross(i), 0)
        const corrGross = corrItems.reduce((s, i) => s + itemGross(i), 0)
        const diff = corrGross - origGross

        const maxLen = Math.max(origItems.length, corrItems.length)
        const compRows = Array.from({ length: maxLen }, (_, idx) => {
          const o = origItems[idx]
          const c = corrItems[idx]
          const oBrutto = o ? itemGross(o) : null
          const cBrutto = c ? itemGross(c) : null
          const rowDiff = (cBrutto ?? 0) - (oBrutto ?? 0)
          return `<tr>
            <td class="center">${idx + 1}</td>
            <td>${o ? escapeHtml(o.description) : '<em style="color:var(--muted)">—</em>'}</td>
            <td class="num">${o ? o.quantity : '—'}</td>
            <td class="num">${o ? formatCurrency(o.unit_price) : '—'}</td>
            <td class="num" style="color:#991b1b;">${o ? formatCurrency(oBrutto!) : '—'}</td>
            <td style="width:2%;background:#f0f9ff;"></td>
            <td>${c ? escapeHtml(c.description) : '<em style="color:var(--muted)">—</em>'}</td>
            <td class="num">${c ? c.quantity : '—'}</td>
            <td class="num">${c ? formatCurrency(c.unit_price) : '—'}</td>
            <td class="num" style="color:#166534;">${c ? formatCurrency(cBrutto!) : '—'}</td>
            <td class="num" style="font-weight:700; color:${rowDiff >= 0 ? '#166534' : '#991b1b'};">${rowDiff >= 0 ? '+' : ''}${formatCurrency(rowDiff)}</td>
          </tr>`
        }).join('')

        return `
        <div style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; margin-top:4px;">Zestawienie korekty</div>
        <table>
          <colgroup>
            <col style="width:3%"/>
            <col style="width:20%"/>
            <col style="width:6%"/>
            <col style="width:9%"/>
            <col style="width:10%"/>
            <col style="width:1%"/>
            <col style="width:20%"/>
            <col style="width:6%"/>
            <col style="width:9%"/>
            <col style="width:10%"/>
            <col style="width:6%"/>
          </colgroup>
          <thead>
            <tr>
              <th class="center" rowspan="2">Lp.</th>
              <th colspan="4" style="background:rgba(153,27,27,0.08); color:#991b1b; text-align:center; padding:6px;">Przed korektą</th>
              <th style="background:#f0f9ff;"></th>
              <th colspan="4" style="background:rgba(22,101,52,0.08); color:#166534; text-align:center; padding:6px;">Po korekcie</th>
              <th class="num" rowspan="2" style="font-size:11px;">Różnica brutto</th>
            </tr>
            <tr>
              <th>Nazwa</th><th class="num">Ilość</th><th class="num">Cena netto</th><th class="num">Brutto</th>
              <th style="background:#f0f9ff;"></th>
              <th>Nazwa</th><th class="num">Ilość</th><th class="num">Cena netto</th><th class="num">Brutto</th>
            </tr>
          </thead>
          <tbody>${compRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right; padding-right:8px; font-weight:600; color:var(--muted);">Razem brutto przed:</td>
              <td class="num" style="font-weight:700; color:#991b1b;">${formatCurrency(origGross)}</td>
              <td style="background:#f0f9ff;"></td>
              <td colspan="3" style="text-align:right; padding-right:8px; font-weight:600; color:var(--muted);">Razem brutto po:</td>
              <td class="num" style="font-weight:700; color:#166534;">${formatCurrency(corrGross)}</td>
              <td class="num" style="font-weight:800; border-top:2px solid var(--red); color:${diff >= 0 ? '#166534' : '#991b1b'};">${diff >= 0 ? '+' : ''}${formatCurrency(diff)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:14px; padding:10px 16px; background:${diff < 0 ? 'rgba(153,27,27,0.06)' : 'rgba(22,101,52,0.06)'}; border:1px solid ${diff < 0 ? 'rgba(153,27,27,0.2)' : 'rgba(22,101,52,0.2)'}; border-radius:8px; font-size:14px;">
          ${diff < 0
            ? `<strong style="color:#991b1b;">Do zwrotu nabywcy: ${formatCurrency(Math.abs(diff))}</strong>`
            : `<strong style="color:#166534;">Dopłata nabywcy: ${formatCurrency(diff)}</strong>`}
        </div>`
      })() : `
      <table>
        <colgroup>
          <col style="width:4%"/>
          <col style="width:26%"/>
          <col style="width:5%"/>
          <col style="width:7%"/>
          <col style="width:11%"/>
          <col style="width:11%"/>
          <col style="width:7%"/>
          <col style="width:11%"/>
          <col style="width:18%"/>
        </colgroup>
        <thead>
          <tr>
            <th class="center">Lp.</th>
            <th>Nazwa us\u0142ugi / towar</th>
            <th class="center">J.m.</th>
            <th class="num">Ilo\u015b\u0107</th>
            <th class="num">Cena netto</th>
            <th class="num">Warto\u015b\u0107 netto</th>
            <th class="center">St. VAT</th>
            <th class="num">Kwota VAT</th>
            <th class="num">Warto\u015b\u0107 brutto</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="display:flex; gap:28px; margin-top:28px; align-items:flex-start; flex-wrap:wrap;">
        <div style="flex:1; min-width:260px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:8px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em;">Zestawienie VAT</div>
          <table>
            <thead><tr><th class="center">Stawka</th><th class="num">Netto</th><th class="num">VAT</th><th class="num">Brutto</th></tr></thead>
            <tbody>${vatRows}</tbody>
          </table>
        </div>
        <div class="totals-box" style="margin-top:0; flex-shrink:0;">
          <div class="totals-line"><span>Razem netto:</span><span>${formatCurrency(invoice.total_net)}</span></div>
          <div class="totals-line"><span>Razem VAT:</span><span>${formatCurrency(totalVat)}</span></div>
          <div class="totals-line"><strong>DO ZAP\u0141ATY (brutto):</strong><strong>${formatCurrency(invoice.total_gross)}</strong></div>
          ${advanceDeductionHtml}
        </div>
      </div>`}

      <div style="margin-top:22px; padding:14px 20px; background:#f9fafb; border-radius:12px; border:1px solid var(--line); display:grid; grid-template-columns:1fr 1fr; gap:10px 32px; font-size:14px;">
        <div><span style="color:var(--muted);">Forma p\u0142atno\u015bci: </span><strong>${paymentMethodLabel}</strong></div>
        <div><span style="color:var(--muted);">Termin p\u0142atno\u015bci: </span><strong>${escapeHtml(invoice.due_date || '\u2014')}</strong></div>
        ${paymentMethod === 'transfer' ? `<div style="grid-column:span 2;"><span style="color:var(--muted);">Rachunek bankowy: </span><strong style="color:var(--red); font-family:monospace; font-size:15px;">${escapeHtml(bankAccount)}</strong></div>` : ''}
        <div><span style="color:var(--muted);">Status: </span><strong>${invoice.status === 'paid' ? '\u2713 Zap\u0142acona' : 'Oczekuje na p\u0142atno\u015b\u0107'}</strong></div>
      </div>

      ${invoice.notes ? `<div style="margin-top:18px; padding:12px 16px; border:1px solid var(--line); border-radius:10px; font-size:14px;"><strong>Uwagi: </strong>${escapeHtml(invoice.notes)}</div>` : ''}

      ${invoiceType === 'correction' && invoice.correction_reason ? `<div style="margin-top:16px; padding:12px 16px; border:1px solid rgba(153,27,27,0.25); border-radius:10px; font-size:14px; background:rgba(153,27,27,0.04);"><strong style="color:#991b1b;">Powód korekty: </strong>${escapeHtml(invoice.correction_reason)}</div>` : ''}

      <div class="small" style="margin-top:16px; text-align:center; color:var(--muted);">${ksefInfo}</div>

      <div class="signature-grid" style="margin-top:50px;">
        <div class="signature"><div class="small" style="margin-top:4px;">Wystawi\u0142 / Sprzedawca</div></div>
        <div class="signature"><div class="small" style="margin-top:4px;">Odebra\u0142 / Nabywca</div></div>
      </div>
    </div>
    ${footer(company)}
  </section>`
  return pageShell(invoice.number ?? 'Szkic', invoiceTitle, page)
}

export function buildInvoiceXml(invoice: Invoice) {
  const typeAttr = invoice.invoice_type ? ` type="${invoice.invoice_type}"` : ''
  const items = invoice.items
    .map((item) => `    <Item><Description>${escapeXml(item.description)}</Description><Quantity>${item.quantity}</Quantity><Unit>${escapeXml(item.unit)}</Unit><UnitPriceNet>${item.unit_price}</UnitPriceNet><VatRate>${item.vat_rate}</VatRate><Label>${escapeXml(item.tranche_label || '')}</Label></Item>`)
    .join('\n')
  const correctionFields = invoice.invoice_type === 'correction'
    ? `  <CorrectedInvoiceId>${escapeXml(invoice.corrected_invoice_id || '')}</CorrectedInvoiceId>\n  <CorrectionReason>${escapeXml(invoice.correction_reason || '')}</CorrectionReason>\n`
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice${typeAttr}>
  <Number>${invoice.number}</Number>
  <Type>${invoice.invoice_type ?? 'standard'}</Type>
  <Status>${invoice.status}</Status>
  <IssueDate>${invoice.issue_date}</IssueDate>
  <SaleDate>${invoice.sale_date || invoice.issue_date}</SaleDate>
  <DueDate>${invoice.due_date || ''}</DueDate>
  <IssuePlace>${escapeXml(invoice.issue_place || '')}</IssuePlace>
  <PaymentMethod>${invoice.payment_method ?? 'transfer'}</PaymentMethod>
  <BankAccount>${escapeXml(invoice.bank_account || '')}</BankAccount>
  <TotalNet>${invoice.total_net}</TotalNet>
  <TotalGross>${invoice.total_gross}</TotalGross>
  <ContractId>${invoice.contract_id || ''}</ContractId>
  <TrancheId>${invoice.tranche_id || ''}</TrancheId>
  <AdvanceTotal>${invoice.advance_total ?? 0}</AdvanceTotal>
  <KsefStatus>${invoice.ksef_status || ''}</KsefStatus>
  <KsefRef>${invoice.ksef_ref || ''}</KsefRef>
${correctionFields}  <Items>
${items}
  </Items>
</Invoice>`
}

function renderContractTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((acc, [key, value]) => replaceEvery(acc, `{{${key}}}`, value), template)
}

interface ContractClientMeta {
  name: string
  address?: string
  postal_code?: string
  city?: string
  phone?: string
  email?: string
  nip?: string
  pesel?: string
  contact_person?: string
}

function contractPartiesHtml(clientMeta: ContractClientMeta, company: CompanyMeta) {
  const idLine = clientMeta.nip ? `NIP: ${escapeHtml(clientMeta.nip)}` : clientMeta.pesel ? `PESEL: ${escapeHtml(clientMeta.pesel)}` : ''
  const addrLine = [clientMeta.address, clientMeta.postal_code && clientMeta.city ? `${clientMeta.postal_code} ${clientMeta.city}` : clientMeta.city || clientMeta.postal_code].filter(Boolean).join(', ')
  return `<div class="party-grid">
    <div class="party-box">
      <h3>Inwestor</h3>
      <strong>${escapeHtml(clientMeta.name)}</strong>
      ${addrLine ? `<p>${escapeHtml(addrLine)}</p>` : ''}
      ${idLine ? `<p>${idLine}</p>` : ''}
      ${clientMeta.phone ? `<p>tel.: ${escapeHtml(clientMeta.phone)}</p>` : ''}
      ${clientMeta.email ? `<p>${escapeHtml(clientMeta.email)}</p>` : ''}
    </div>
    <div class="party-box">
      <h3>Wykonawca</h3>
      <strong>${escapeHtml(company.name || '—')}</strong>
      ${company.address ? `<p>${escapeHtml(company.address)}</p>` : ''}
      ${company.nip ? `<p>NIP: ${escapeHtml(company.nip)}</p>` : ''}
      ${company.email ? `<p>${escapeHtml(company.email)}</p>` : ''}
    </div>
  </div>`
}

function contractTranchesTable(tranches: import('@/entities/contract/model').ContractTranche[], totalGross: number): string {
  if (!tranches.length) return '<p class="small">Brak harmonogramu transz.</p>'
  const rows = tranches.map((t, i) => {
    const pct = (t as any).percent != null ? (t as any).percent : Math.round((t.amount / Math.max(totalGross, 1)) * 100)
    const condition = (t as any).condition || '—'
    return `<tr>
      <td class="center">${i + 1}</td>
      <td>${escapeHtml(t.label)}</td>
      <td class="center">${pct}%</td>
      <td class="num">${formatCurrency(t.amount)}</td>
      <td>${escapeHtml(t.due_date || 'Do ustalenia')}</td>
      <td>${escapeHtml(condition)}</td>
    </tr>`
  }).join('')
  return `<table>
    <thead><tr><th class="center">Nr</th><th>Nazwa transzy</th><th class="center">Udział</th><th class="num">Kwota brutto</th><th>Termin</th><th>Warunek / etap</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function buildFullContractHtml(
  contract: import('@/entities/contract/model').Contract,
  clientMeta: ContractClientMeta,
  estimateName: string,
  company: CompanyMeta,
  estimateNumber?: string,
): string {
  const net = contract.value_net ?? contract.value
  const gross = contract.value
  // Always derive VAT rate from gross/net ratio — stored vat_rate may have been
  // saved incorrectly (e.g. defaulted to 23 before the derivation fix).
  const vatRate: number = (net > 0 && gross > net)
    ? Math.round((gross / net - 1) * 100)
    : (contract.vat_rate ?? 0)
  const vatAmt = gross - net
  const customParas = (contract.custom_paragraphs ?? [])
  const nCustom = customParas.length

  const penaltyPerDay = contract.penalty_per_day_pct ?? 0.1
  const maxPenalty    = contract.max_penalty_pct ?? 5

  // Custom paragraphs inserted between §7 and §8 (Gwarancja)
  const customParaSections = customParas.map((p, i) => `
    <div class="section">
      <h2>§${8 + i} ${escapeHtml(p.title || 'Postanowienie dodatkowe')}</h2>
      <ol>${p.content.split('\n').filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join('') || `<li>${escapeHtml(p.content)}</li>`}</ol>
    </div>`).join('')

  // Fixed-section numbers shift when custom paragraphs are present
  const s8  = 8  + nCustom  // Gwarancja i rękojmia
  const s9  = 9  + nCustom  // Siła wyższa
  const s10 = 10 + nCustom  // Zmiany umowy
  const s11 = 11 + nCustom  // Załączniki
  const s12 = 12 + nCustom  // Postanowienia końcowe

  const estimateRef = estimateNumber
    ? `Kosztorysie nr <strong>${escapeHtml(estimateNumber)}</strong>, stanowiącym Załącznik nr 1 do niniejszej umowy`
    : `kosztorysie stanowiącym Załącznik nr 1 do niniejszej umowy`

  return `
    <div class="section">
      <h2>§1 Strony umowy</h2>
      ${contractPartiesHtml(clientMeta, company)}
    </div>

    <div class="section">
      <h2>§2 Przedmiot umowy</h2>
      <ol>
        <li>Wykonawca zobowiązuje się do wykonania na rzecz Inwestora robót budowlanych, remontowych oraz wykończeniowych zgodnie z zakresem określonym w ${estimateRef}.</li>
        <li>Roboty realizowane będą w lokalu / obiekcie położonym pod adresem: <strong>${escapeHtml(contract.location || '…………………………………………………')}</strong>.</li>
        <li>Szczegółowy zakres prac, standard wykonania, materiały oraz sposób rozliczenia określa kosztorys stanowiący integralną część niniejszej umowy.</li>
        <li>Wszelkie prace niewskazane wyraźnie w kosztorysie lub dokumentacji stanowią prace dodatkowe.</li>
        <li>Wykonawca oświadcza, że posiada kwalifikacje, doświadczenie oraz zaplecze techniczne niezbędne do prawidłowej realizacji przedmiotu umowy zgodnie z zasadami sztuki budowlanej.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§3 Termin realizacji</h2>
      <ol>
        <li>Strony ustalają następujące terminy realizacji:<br/>
          a) rozpoczęcie robót: <strong>${escapeHtml(contract.start_date || '………………………………')}</strong><br/>
          b) zakończenie robót i zgłoszenie gotowości do odbioru końcowego: <strong>${escapeHtml(contract.end_date || '………………………………')}</strong>
        </li>
        <li>Termin realizacji ulega odpowiedniemu wydłużeniu o czas wynikający z:
          <ul>
            <li>zmian zakresu robót,</li>
            <li>prac dodatkowych,</li>
            <li>opóźnień lub działań Inwestora,</li>
            <li>braku decyzji materiałowych lub projektowych,</li>
            <li>opóźnień dostaw materiałów,</li>
            <li>niedostępności frontu robót,</li>
            <li>prac wykonywanych przez osoby trzecie,</li>
            <li>koniecznych przerw technologicznych,</li>
            <li>działania siły wyższej,</li>
            <li>innych okoliczności niezależnych od Wykonawcy.</li>
          </ul>
        </li>
        <li>Wykonawca poinformuje Inwestora o wpływie powyższych okoliczności na termin realizacji.</li>
        <li>W przypadku opóźnienia realizacji robót wyłącznie z winy Wykonawcy, Inwestor może naliczyć karę umowną w wysokości <strong>${penaltyPerDay}%</strong> wynagrodzenia brutto za każdy dzień zwłoki, nie więcej jednak niż <strong>${maxPenalty}%</strong> całkowitego wynagrodzenia brutto.</li>
        <li>Zapłata kar umownych wyczerpuje wszelkie roszczenia Inwestora związane z opóźnieniem realizacji robót.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§4 Wynagrodzenie i płatności</h2>
      <ol>
        <li>Strony ustalają wynagrodzenie ryczałtowe za wykonanie przedmiotu umowy w wysokości:</li>
      </ol>
      <div class="totals-box" style="margin-top:14px;margin-bottom:14px;">
        <div class="totals-line"><span>Wartość netto:</span><span>${formatCurrency(net)}</span></div>
        <div class="totals-line"><span>Podatek VAT (${vatRate}%):</span><span>${formatCurrency(vatAmt)}</span></div>
        <div class="totals-line"><strong>RAZEM BRUTTO:</strong><strong>${formatCurrency(gross)}</strong></div>
      </div>
      <ol start="2">
        <li>Wynagrodzenie płatne będzie w następujących transzach:
          ${contractTranchesTable(contract.tranches ?? [], gross)}
        </li>
        <li>Wpłaty dokonywane przez Inwestora mają charakter zaliczek na poczet realizacji umowy.</li>
        <li>Każda transza płatna jest z góry.</li>
        <li>Po otrzymaniu płatności na rachunek bankowy Wykonawcy, Wykonawca wystawi fakturę VAT zgodnie z obowiązującymi przepisami prawa podatkowego.</li>
        <li>Brak płatności przekraczający 3 dni robocze od ustalonego terminu uprawnia Wykonawcę do:
          <ul>
            <li>wstrzymania robót,</li>
            <li>odpowiedniego wydłużenia terminu realizacji,</li>
            <li>odmowy dalszego wykonywania prac do czasu uregulowania zaległości.</li>
          </ul>
        </li>
        <li>W okresie wstrzymania robót Wykonawca nie pozostaje w zwłoce.</li>
        <li>W przypadku opóźnienia płatności Wykonawca ma prawo naliczać odsetki ustawowe za opóźnienie.</li>
        <li>Drobne usterki lub wady nieistotne nie stanowią podstawy do odmowy zapłaty wynagrodzenia.</li>
        <li>Wykonawca może uzależnić podpisanie protokołu odbioru końcowego oraz wydanie frontu robót od uprzedniego uregulowania całości wynagrodzenia.</li>
        <li>Materiały, transport, wniesienie, logistyka oraz koszty dostaw nie są wliczone w wynagrodzenie, chyba że Strony postanowią inaczej w formie pisemnej.</li>
        <li>W przypadku wzrostu cen materiałów, energii, paliw lub kosztów realizacji przekraczających 10% względem dnia zawarcia umowy, Strony dopuszczają odpowiednią waloryzację wynagrodzenia.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§5 Obowiązki Inwestora</h2>
      <ol>
        <li>Inwestor zobowiązuje się do:
          <ul>
            <li>terminowego przekazania frontu robót,</li>
            <li>zapewnienia dostępu do energii elektrycznej i wody,</li>
            <li>terminowego dokonywania płatności,</li>
            <li>podejmowania bieżących decyzji materiałowych i projektowych,</li>
            <li>współpracy niezbędnej do prawidłowej realizacji robót.</li>
          </ul>
        </li>
        <li>Inwestor zobowiązuje się nie utrudniać realizacji prac poprzez równoległe prowadzenie robót przez osoby trzecie bez uzgodnienia z Wykonawcą.</li>
        <li>Koszty mediów oraz utylizacji odpadów budowlanych ponosi Inwestor.</li>
        <li>Inwestor odpowiada za zabezpieczenie rzeczy ruchomych pozostawionych w lokalu.</li>
        <li>Wykonawca ma prawo wykonywać dokumentację fotograficzną realizacji robót do celów dowodowych, reklamacyjnych oraz prezentacji portfolio, z wyłączeniem danych osobowych oraz elementów naruszających prywatność Inwestora.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§6 Prace dodatkowe</h2>
      <ol>
        <li>Wszelkie prace wykraczające poza zakres określony w kosztorysie stanowią prace dodatkowe.</li>
        <li>Prace dodatkowe wymagają akceptacji Inwestora co do zakresu oraz wyceny.</li>
        <li>Dopuszcza się akceptację prac dodatkowych również w formie dokumentowej, w szczególności poprzez:
          <ul>
            <li>wiadomość e-mail,</li>
            <li>wiadomość SMS,</li>
            <li>komunikator internetowy,</li>
            <li>akceptację elektroniczną.</li>
          </ul>
        </li>
        <li>Prace dodatkowe mogą wpływać na termin realizacji oraz wysokość wynagrodzenia.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§7 Odbiór robót</h2>
      <ol>
        <li>Wykonawca zgłasza gotowość do odbioru robót po zakończeniu danego etapu lub całości prac.</li>
        <li>Inwestor zobowiązuje się przystąpić do odbioru w terminie 3 dni roboczych od zgłoszenia gotowości odbioru.</li>
        <li>Odmowa odbioru wymaga pisemnego wskazania istotnych wad uniemożliwiających prawidłowe użytkowanie przedmiotu umowy.</li>
        <li>Nie stanowią podstawy odmowy odbioru drobne usterki lub niedoskonałości nie wpływające na funkcjonalność oraz możliwość użytkowania.</li>
        <li>Brak przystąpienia do odbioru lub brak podpisania protokołu mimo możliwości użytkowania robót uznaje się za dokonanie odbioru.</li>
        <li>Zakrycie wykonanych robót przez kolejne etapy prac uniemożliwiające ich dalszą weryfikację uznaje się za odbiór częściowy danego zakresu, z wyjątkiem wad ukrytych.</li>
        <li>Brak zgłoszenia zastrzeżeń do danego etapu robót przed rozpoczęciem kolejnego etapu oznacza akceptację wykonanych prac w zakresie umożliwiającym kontynuację realizacji.</li>
      </ol>
    </div>

    ${customParaSections}

    <div class="section">
      <h2>§${s8} Gwarancja i rękojmia</h2>
      <ol>
        <li>Wykonawca udziela gwarancji jakości na okres <strong>24 miesięcy</strong> od dnia odbioru końcowego.</li>
        <li>Rękojmia za wady wykonywana jest zgodnie z przepisami Kodeksu cywilnego.</li>
        <li>Usterki zgłaszane będą w formie dokumentowej.</li>
        <li>Wykonawca usunie zasadne usterki w terminie uzgodnionym z Inwestorem, uwzględniającym charakter oraz technologię napraw.</li>
        <li>Gwarancja nie obejmuje:
          <ul>
            <li>uszkodzeń mechanicznych,</li>
            <li>niewłaściwego użytkowania,</li>
            <li>działania osób trzecich,</li>
            <li>naturalnego zużycia,</li>
            <li>zdarzeń losowych,</li>
            <li>ingerencji innych wykonawców.</li>
          </ul>
        </li>
      </ol>
    </div>

    <div class="section">
      <h2>§${s9} Siła wyższa</h2>
      <ol>
        <li>Przez siłę wyższą rozumie się zdarzenia niezależne od Stron, niemożliwe do przewidzenia lub zapobieżenia, w szczególności:
          <ul>
            <li>klęski żywiołowe,</li>
            <li>pożary,</li>
            <li>awarie sieci,</li>
            <li>wojny,</li>
            <li>epidemie,</li>
            <li>ograniczenia administracyjne,</li>
            <li>przerwy dostaw materiałów,</li>
            <li>długotrwałe warunki atmosferyczne uniemożliwiające prowadzenie prac.</li>
          </ul>
        </li>
        <li>Wystąpienie siły wyższej powoduje odpowiednie wydłużenie terminu realizacji.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§${s10} Zmiany umowy</h2>
      <ol>
        <li>Wszelkie zmiany niniejszej umowy wymagają formy pisemnej lub dokumentowej pod rygorem nieważności.</li>
        <li>Za formę dokumentową Strony uznają również wiadomości e-mail oraz komunikację elektroniczną umożliwiającą identyfikację nadawcy.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§${s11} Załączniki</h2>
      <ol>
        <li>Integralną część umowy stanowią:
          <ul>
            <li>Załącznik nr 1 – kosztorys / wycena${contract.template_name ? ` (${escapeHtml(contract.template_name)})` : ''},</li>
            <li>Załącznik nr 2 – dokumentacja projektowa (jeżeli występuje).</li>
          </ul>
        </li>
      </ol>
    </div>

    <div class="section">
      <h2>§${s12} Postanowienia końcowe</h2>
      <ol>
        <li>W sprawach nieuregulowanych niniejszą umową zastosowanie mają przepisy prawa polskiego, w szczególności przepisy Kodeksu cywilnego.</li>
        <li>Strony zobowiązują się dążyć do polubownego rozwiązania sporów.</li>
        <li>Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.</li>
        <li>Umowa wchodzi w życie z dniem podpisania.</li>
      </ol>
    </div>

    <div class="signature-grid" style="margin-top:60px;">
      <div class="signature">
        <strong>${escapeHtml(clientMeta.name)}</strong>
        <div class="small" style="margin-top:4px;">Inwestor</div>
      </div>
      <div class="signature">
        <strong>${escapeHtml(company.name || 'Wykonawca')}</strong>
        <div class="small" style="margin-top:4px;">Wykonawca</div>
      </div>
    </div>
  `
}

export function buildContractPreview(contract: import('@/entities/contract/model').Contract, clientName?: string, estimateName?: string, companyInput?: CompanyMeta, estimateNumber?: string, clientData?: ContractClientMeta) {
  const company = defaultCompany(companyInput)
  const locationOrCity = contract.location || '—'
  const clientMeta: ContractClientMeta = clientData ?? { name: clientName || 'Klient' }

  const page = `<section class="page">
    <div class="topbar">
      <div class="topbar__title">UMOWA O WYKONANIE ROBÓT BUDOWLANYCH</div>
      ${logoMark(company)}
      <div style="font-size:14px; font-weight:600;">nr ${escapeHtml(contract.number)}</div>
    </div>
    <div class="content">
      <div class="meta">
        zawarta dnia <strong>${escapeHtml(contract.sign_date || '— do ustalenia —')}</strong> w <strong>${escapeHtml(locationOrCity)}</strong>
      </div>
      ${buildFullContractHtml(contract, clientMeta, estimateName || contract.notes || 'roboty wykończeniowe', company, estimateNumber)}
      ${contract.notes ? `<div class="section small" style="margin-top:24px;"><strong>Notatki:</strong> ${escapeHtml(contract.notes)}</div>` : ''}
    </div>
    ${footer(company)}
  </section>`
  return pageShell(contract.number, 'Umowa', page)
}

export function buildProtocolPreview(protocol: HandoverProtocol, clientName?: string, projectName?: string, companyInput?: CompanyMeta) {
  const company = defaultCompany(companyInput)
  const checklist = protocol.checklist.length
    ? protocol.checklist.map((item) => `<div class="check"><span>${escapeHtml(item.label)}</span><strong>${item.accepted ? 'OK' : 'Do sprawdzenia'}</strong></div>`).join('')
    : '<div class="check"><span>Brak dodanej checklisty</span><strong>—</strong></div>'

  const page = `<section class="page">
    <div class="topbar"><div class="topbar__title">PROTOKÓŁ ODBIORU</div>${logoMark(company)}</div>
    <div class="content">
      <div class="doc-title" style="margin-bottom:10px;">PROTOKÓŁ ODBIORU</div>
      <div class="doc-number">${escapeHtml(protocol.title)}</div>
      <div class="party-grid">
        ${partyBox('Wykonawca', company, company.name)}
        ${partyBox('Inwestor', { name: clientName || 'Klient', address: projectName ? `Projekt: ${projectName}` : '', postalCity: protocol.protocol_date ? `Data odbioru: ${protocol.protocol_date}` : '' }, clientName || 'Klient')}
      </div>
      <div class="section"><span class="chip">Status: ${escapeHtml(protocol.status)}</span><p style="margin-top:12px;">${escapeHtml(protocol.summary || 'Odbiór częściowy / końcowy robót zgodnie z zakresem wykonania.')}</p></div>
      <div class="section"><h2>CHECKLISTA ODBIORU</h2><div class="checklist">${checklist}</div></div>
      <div class="section"><h2>UWAGI</h2><p>${escapeHtml(protocol.notes || 'Brak uwag zgłoszonych przy odbiorze.')}</p></div>
      <div class="signature-grid"><div class="signature">Podpis Inwestora</div><div class="signature">Podpis Wykonawcy</div></div>
    </div>
    ${footer(company)}
  </section>`
  return pageShell(protocol.title, 'Protokół odbioru', page)
}

// ─── Budget Report ────────────────────────────────────────────────────────────

export interface BudgetReportData {
  projectName:  string
  projectNumber: string
  /** Reference source label, e.g. "umowa podpisana", "wycena (draft)" */
  source:        string | null
  plannedGross:  number
  plannedNet:    number
  actualGross:   number
  actualNet:     number
  diff:          number
  diffPct:       number | null
  overBudget:    boolean
  revenue:       number
  margin:        number | null
  marginPct:     number | null
  byCategory:    Record<string, number>
  byApproval:    Record<string, number>
  tranches:      Array<{ label: string; amount: number; status: string; due_date?: string | null }>
  expenseCount:  number
  generatedAt:   string
}

const COST_TYPE_LABEL_PDF: Record<string, string> = {
  material:  'Materiały',
  service:   'Usługi',
  equipment: 'Sprzęt',
  labor:     'Robocizna',
  transport: 'Transport',
  other:     'Inne',
}

const APPROVAL_LABEL_PDF: Record<string, string> = {
  accepted:       'Zaakceptowane',
  not_sent:       'Nierozesłane',
  pending_client: 'Oczekuje na zatwierdzenie',
  questioned:     'Zakwestionowane',
  rejected:       'Odrzucone',
}

export function buildBudgetReportPreview(data: BudgetReportData, companyInput?: CompanyMeta): string {
  const company = defaultCompany(companyInput)

  const fmt = (n: number) => formatCurrency(n)
  const pct = (n: number | null) => n !== null ? `${n}%` : '—'

  // Status badge
  const budgetStatus = data.overBudget
    ? `<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;">⚠ Budżet przekroczony</span>`
    : data.diffPct !== null && data.diffPct < 15
      ? `<span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;">Uwaga: niski bufor (${data.diffPct}%)</span>`
      : `<span style="background:#d1fae5;color:#065f46;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;">✓ Budżet zachowany (${pct(data.diffPct)} wolne)</span>`

  // Main summary rows
  const summaryRows = [
    ['Plan (brutto)',       fmt(data.plannedGross), ''],
    ['Plan (netto)',        fmt(data.plannedNet),   ''],
    ['Wykonanie (brutto)', fmt(data.actualGross),  data.overBudget ? 'color:#991b1b' : ''],
    ['Wykonanie (netto)',  fmt(data.actualNet),     ''],
    ['Różnica',            (data.overBudget ? '-' : '+') + fmt(Math.abs(data.diff)), data.overBudget ? 'color:#991b1b' : 'color:#065f46'],
  ].map(([label, value, style]) =>
    `<tr><td>${escapeHtml(label as string)}</td><td class="num" style="${style}">${escapeHtml(value as string)}</td></tr>`
  ).join('')

  // Margin section
  const marginSection = data.margin !== null ? `
    <div class="section">
      <h2>Marża projektu</h2>
      <table>
        <thead><tr><th>Pozycja</th><th class="num">Wartość</th></tr></thead>
        <tbody>
          <tr><td>Przychód (umowa)</td><td class="num">${fmt(data.revenue)}</td></tr>
          <tr><td>Koszty łączne</td><td class="num">${fmt(data.actualGross)}</td></tr>
          <tr><td><strong>Marża brutto</strong></td><td class="num"><strong style="${data.margin < 0 ? 'color:#991b1b' : data.margin < data.revenue * 0.1 ? 'color:#92400e' : 'color:#065f46'}">${fmt(data.margin)} (${pct(data.marginPct)})</strong></td></tr>
        </tbody>
      </table>
    </div>` : ''

  // Categories
  const sortedCats = Object.entries(data.byCategory).sort(([, a], [, b]) => b - a)
  const categoryRows = sortedCats.map(([cat, amount]) => {
    const pctOfTotal = data.actualGross > 0 ? Math.round((amount / data.actualGross) * 100) : 0
    return `<tr><td>${escapeHtml(COST_TYPE_LABEL_PDF[cat] ?? cat)}</td><td class="num">${fmt(amount)}</td><td class="num">${pctOfTotal}%</td></tr>`
  }).join('')

  const categoriesSection = sortedCats.length > 0 ? `
    <div class="section">
      <h2>Koszty wg kategorii</h2>
      <table>
        <thead><tr><th>Kategoria</th><th class="num">Kwota brutto</th><th class="num">Udział</th></tr></thead>
        <tbody>${categoryRows}<tr><td><strong>Łącznie (${data.expenseCount} poz.)</strong></td><td class="num"><strong>${fmt(data.actualGross)}</strong></td><td class="num"><strong>100%</strong></td></tr></tbody>
      </table>
    </div>` : ''

  // Approvals
  const approvalEntries = Object.entries(data.byApproval).filter(([k]) => k !== 'not_sent' || data.byApproval['not_sent'] > 0)
  const approvalRows = approvalEntries
    .sort(([a], [b]) => ['accepted','pending_client','questioned','rejected','not_sent'].indexOf(a) - ['accepted','pending_client','questioned','rejected','not_sent'].indexOf(b))
    .map(([status, amount]) =>
      `<tr><td>${escapeHtml(APPROVAL_LABEL_PDF[status] ?? status)}</td><td class="num">${fmt(amount)}</td></tr>`
    ).join('')

  const approvalsSection = approvalEntries.length > 1 ? `
    <div class="section">
      <h2>Status zatwierdzeń kosztów</h2>
      <table>
        <thead><tr><th>Status</th><th class="num">Kwota brutto</th></tr></thead>
        <tbody>${approvalRows}</tbody>
      </table>
    </div>` : ''

  // Tranches
  const trancheRows = data.tranches.map(t =>
    `<tr><td>${escapeHtml(t.label)}</td><td class="num">${fmt(t.amount)}</td><td>${t.status === 'paid' ? '✓ Opłacona' : t.status === 'invoiced' ? 'Zafakturowana' : t.due_date ? `Termin: ${t.due_date}` : 'Oczekuje'}</td></tr>`
  ).join('')

  const tranchesSection = data.tranches.length > 0 ? `
    <div class="section">
      <h2>Transze umowy</h2>
      <table>
        <thead><tr><th>Transza</th><th class="num">Kwota</th><th>Status</th></tr></thead>
        <tbody>${trancheRows}</tbody>
      </table>
    </div>` : ''

  const page = `<section class="page">
    <div class="topbar"><div class="topbar__title">RAPORT BUDŻETOWY</div>${logoMark(company)}</div>
    <div class="content">
      <div class="doc-title">RAPORT BUDŻETOWY</div>
      <div class="doc-number">${escapeHtml(data.projectNumber)} · ${escapeHtml(data.projectName)}</div>
      <div class="meta">
        ${data.source ? `Podstawa: ${escapeHtml(data.source)}<br/>` : ''}
        Wygenerowano: ${escapeHtml(data.generatedAt)}
      </div>
      <div style="text-align:center;margin:12px 0 20px;">${budgetStatus}</div>

      <div class="section">
        <h2>Podsumowanie budżetu</h2>
        <table>
          <thead><tr><th>Pozycja</th><th class="num">Wartość</th></tr></thead>
          <tbody>${summaryRows}</tbody>
        </table>
      </div>

      ${marginSection}
      ${categoriesSection}
      ${approvalsSection}
      ${tranchesSection}

      <div class="signature-grid" style="margin-top:40px;">
        <div class="signature">Sporządził(a)</div>
        <div class="signature">Zatwierdził(a)</div>
      </div>
    </div>
    ${footer(company)}
  </section>`

  return pageShell(`Raport budżetowy — ${data.projectNumber}`, data.projectName, page)
}

// ─── PROJECT REPORT (zbiorczy) ────────────────────────────────────────────────

export interface ProjectReportData {
  project: Project
  estimates: Estimate[]
  contracts: Contract[]
  invoices: Invoice[]
  client: Client | null
}

const STATUS_LABEL_PR: Record<string, string> = {
  offer: 'Oferta', active: 'W realizacji', done: 'Zakończony', cancelled: 'Anulowany',
}
const INVOICE_STATUS_PR: Record<string, string> = {
  draft: 'Szkic', unpaid: 'Nieopłacona', paid: 'Opłacona', overdue: 'Zaległa',
}
const EST_STATUS_PR: Record<string, string> = {
  draft: 'Szkic', sent: 'Wysłana', accepted: 'Zaakceptowana', rejected: 'Odrzucona',
}
const CON_STATUS_PR: Record<string, string> = {
  unsigned: 'Niepodpisana', signed: 'Podpisana',
}

export function buildProjectReportPreview(data: ProjectReportData, company?: CompanyMeta): string {
  const { project, estimates, contracts, invoices, client } = data
  const fmt = (v: number | null | undefined) => formatCurrency(v ?? 0)
  const today = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Nagłówek projektu ──────────────────────────────────────────────────────
  const projectStatus = STATUS_LABEL_PR[project.status] ?? project.status
  const clientInfo = client
    ? `${escapeHtml(client.name)}${client.email ? ` · ${escapeHtml(client.email)}` : ''}${client.phone ? ` · ${escapeHtml(client.phone)}` : ''}`
    : '—'

  const headerSection = `
    <div class="section">
      <table>
        <thead><tr><th>Pole</th><th>Wartość</th></tr></thead>
        <tbody>
          <tr><td>Numer projektu</td><td>${escapeHtml(project.number ?? '—')}</td></tr>
          <tr><td>Nazwa</td><td>${escapeHtml(project.name)}</td></tr>
          <tr><td>Status</td><td>${escapeHtml(projectStatus)}</td></tr>
          <tr><td>Adres</td><td>${escapeHtml(project.address ?? '—')}</td></tr>
          <tr><td>Data rozpoczęcia</td><td>${escapeHtml(project.start_date ?? '—')}</td></tr>
          <tr><td>Data zakończenia</td><td>${escapeHtml(project.end_date ?? '—')}</td></tr>
          <tr><td>Klient</td><td>${clientInfo}</td></tr>
        </tbody>
      </table>
    </div>`

  // ── Wyceny ─────────────────────────────────────────────────────────────────
  const estRows = estimates.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:#888;">Brak wycen</td></tr>'
    : estimates.map(e => {
        return `<tr><td>${escapeHtml(e.number ?? '—')}</td><td>${escapeHtml(EST_STATUS_PR[e.status] ?? e.status)}</td><td class="num">${fmt(e.total_gross)}</td><td>${escapeHtml(e.created_at?.slice(0, 10) ?? '—')}</td></tr>`
      }).join('')
  const estimatesSection = `
    <div class="section">
      <h2>Wyceny (${estimates.length})</h2>
      <table>
        <thead><tr><th>Numer</th><th>Status</th><th class="num">Wartość</th><th>Data</th></tr></thead>
        <tbody>${estRows}</tbody>
      </table>
    </div>`

  // ── Umowy ──────────────────────────────────────────────────────────────────
  const conRows = contracts.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:#888;">Brak umów</td></tr>'
    : contracts.map(c => {
        return `<tr><td>${escapeHtml(c.number ?? '—')}</td><td>${escapeHtml(CON_STATUS_PR[c.status] ?? c.status)}</td><td class="num">${fmt(c.value)}</td><td>${escapeHtml(c.created_at?.slice(0, 10) ?? '—')}</td></tr>`
      }).join('')
  const contractsSection = `
    <div class="section">
      <h2>Umowy (${contracts.length})</h2>
      <table>
        <thead><tr><th>Numer</th><th>Status</th><th class="num">Wartość</th><th>Data</th></tr></thead>
        <tbody>${conRows}</tbody>
      </table>
    </div>`

  // ── Faktury ────────────────────────────────────────────────────────────────
  const invRows = invoices.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:#888;">Brak faktur</td></tr>'
    : invoices.map(i => {
        return `<tr><td>${escapeHtml(i.number ?? '—')}</td><td>${escapeHtml(INVOICE_STATUS_PR[i.status] ?? i.status)}</td><td class="num">${fmt(i.total_gross)}</td><td>${escapeHtml(i.issue_date ?? '—')}</td><td>${i.due_date ? escapeHtml(i.due_date) : '—'}</td></tr>`
      }).join('')
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_gross ?? 0), 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_gross ?? 0), 0)
  const invoicesSection = `
    <div class="section">
      <h2>Faktury (${invoices.length})</h2>
      <table>
        <thead><tr><th>Numer</th><th>Status</th><th class="num">Kwota brutto</th><th>Wystawiona</th><th>Termin</th></tr></thead>
        <tbody>${invRows}</tbody>
        ${invoices.length > 0 ? `<tfoot><tr><td colspan="2"><strong>Suma</strong></td><td class="num"><strong>${fmt(totalInvoiced)}</strong></td><td colspan="2"></td></tr><tr><td colspan="2">Opłacone</td><td class="num">${fmt(totalPaid)}</td><td colspan="2"></td></tr></tfoot>` : ''}
      </table>
    </div>`

  // ── Strona ─────────────────────────────────────────────────────────────────
  const page = `<section class="page">
    <div class="topbar"><div class="topbar__title">RAPORT PROJEKTU</div>${logoMark(company ?? {})}</div>
    <div class="content">
      <div class="doc-title">RAPORT PROJEKTU</div>
      <div class="doc-number">${escapeHtml(project.number ?? '')} · ${escapeHtml(project.name)}</div>
      <div class="meta">Wygenerowano: ${escapeHtml(today)}</div>
      ${company?.name ? `<div class="meta">Firma: ${escapeHtml(company.name)}</div>` : ''}
      ${headerSection}
      ${estimatesSection}
      ${contractsSection}
      ${invoicesSection}
      <div class="signature-grid" style="margin-top:40px;">
        <div class="signature">Sporządził(a)</div>
        <div class="signature">Zatwierdził(a)</div>
      </div>
    </div>
    ${footer(company)}
  </section>`

  return pageShell(`Raport projektu — ${project.number ?? project.id}`, project.name, page)
}

function escapeXml(value: string) {
  return replaceEvery(replaceEvery(replaceEvery(replaceEvery(replaceEvery(value, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), "'", '&apos;')
}