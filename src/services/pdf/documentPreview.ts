import type { Estimate } from '@/entities/estimate/model'
import type { Invoice } from '@/entities/invoice/model'
import type { Contract } from '@/entities/contract/model'
import type { HandoverProtocol } from '@/entities/documentation/model'
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
  :root { --red:#e2231a; --ink:#1f2937; --muted:#5b6475; --line:#d7dde6; --soft:#f5f7fb; }
  * { box-sizing:border-box; }
  body { margin:0; font-family: Inter, Arial, sans-serif; background:#eef2f7; color:var(--ink); }
  .doc { width: 900px; margin: 24px auto; background:#fff; box-shadow: 0 18px 50px rgba(15,23,42,.12); }
  .page { min-height: 1260px; display:flex; flex-direction:column; background:#fff; }
  .topbar { height: 74px; background:var(--red); color:#fff; display:flex; align-items:center; justify-content:space-between; padding: 0 42px; }
  .topbar__title { font-size: 22px; font-weight: 700; letter-spacing: .01em; }
  .content { padding: 44px 54px 36px; flex:1; }
  .footer { margin-top:auto; background:var(--red); color:#fff; padding: 16px 42px; font-size:14px; display:flex; justify-content:center; gap: 18px; }
  .doc-title { text-align:center; color:var(--red); font-size: 34px; font-weight: 800; margin: 8px 0 18px; }
  .doc-number { text-align:center; font-size: 16px; font-weight: 700; margin-top: -8px; margin-bottom: 24px; }
  .meta { text-align:center; color:var(--muted); font-size: 14px; margin-bottom: 18px; }
  .party-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin: 18px 0 24px; }
  .party-box { border:1px solid var(--line); border-radius: 18px; padding: 18px; background: #fbfcff; }
  .party-box h3 { margin:0 0 10px; color:var(--red); font-size: 13px; text-transform: uppercase; letter-spacing:.04em; }
  .party-box strong { display:block; margin-bottom: 8px; font-size: 17px; }
  .party-box p { margin: 5px 0; color:var(--muted); line-height: 1.45; }
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
  th, td {
    border: none;
    padding: 7px 9px;
    font-size: 12px;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    white-space: normal;
    overflow: hidden;
  }
  thead th {
    background: #f3f4f6;
    color: #1f2937;
    text-align: left;
    font-weight: 700;
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
  td.num, th.num { text-align: right; }
  td.center, th.center { text-align: center; }
  .totals-box { margin-left:auto; width: 340px; border: 3px solid var(--red); border-radius: 18px; padding: 18px 20px; margin-top: 28px; }
  .totals-line { display:flex; justify-content:space-between; gap:16px; padding: 8px 0; font-weight:700; }
  .totals-line strong { color: var(--red); font-size: 18px; }
  .notice { margin-top: 30px; padding: 16px 20px; border: 1px solid #f3c7c4; background: #fff5f5; border-radius: 14px; color: #8a2f2b; text-align:center; }
  .section { margin-top: 24px; }
  .section h2 { margin: 0 0 10px; font-size: 15px; text-transform: uppercase; text-align:center; }
  .section p, .section li { color: var(--ink); line-height: 1.6; font-size: 15px; }
  .section ol { padding-left: 22px; margin: 0; }
  .small { color: var(--muted); font-size: 14px; }
  .signature-grid { display:grid; grid-template-columns:1fr 1fr; gap: 36px; margin-top: 80px; }
  .signature { padding-top: 14px; border-top: 1px solid var(--ink); color:var(--ink); }
  .logo-mark { width:54px; height:54px; border-radius:999px; border:4px solid #111; background:var(--red); color:#fff; display:grid; place-items:center; font-weight:800; }
  .invoice-head { display:flex; justify-content:space-between; align-items:flex-start; gap: 18px; }
  .summary-table { width: 330px; margin-left: auto; margin-top: 20px; }
  .summary-table td { font-size: 16px; }
  .summary-table tr:last-child td { font-weight:800; }
  .page-break { page-break-before: always; }
  .checklist { display:grid; gap:10px; margin-top:18px; }
  .check { border:1px solid var(--line); border-radius:14px; padding:12px 14px; display:flex; justify-content:space-between; gap:16px; }
  .chip { display:inline-flex; padding:6px 10px; border-radius:999px; background:#fff1f1; color:var(--red); font-size:12px; font-weight:700; }
  @page { size: A4 portrait; margin: 12mm 10mm; }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .doc { width: 100%; margin: 0; box-shadow: none; }
    .page { min-height: auto; break-after: page; }
    .topbar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { page-break-inside: avoid; }
    thead { display: table-header-group; }
    .party-grid { break-inside: avoid; }
    .totals-box { break-inside: avoid; }
    .signature-grid { break-inside: avoid; }
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
        <thead><tr><th>Pozycja</th><th class="num">Ilość</th><th class="center">J.m.</th><th class="num">Netto</th><th class="num">Brutto</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals-box">
        <div class="totals-line"><span>Razem netto:</span><span>${formatCurrency(estimate.total_net)}</span></div>
        <div class="totals-line"><span>Razem VAT (${vatRate}%):</span><span>${formatCurrency(totalVat)}</span></div>
        <div class="totals-line"><strong>RAZEM BRUTTO:</strong><strong>${formatCurrency(estimate.total_gross)}</strong></div>
      </div>
      <div class="notice"><strong>Uwaga:</strong> Wycena ma charakter informacyjny. Ostateczna cena może ulec zmianie po wizji lokalnej.</div>
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
  }
  const typeTagBg: Record<string, string> = {
    standard: '#1d4ed8',
    advance: '#7c3aed',
    final: '#065f46',
    partial: '#92400e',
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

  const page = `<section class="page">
    <div class="topbar">
      <div class="topbar__title">${invoiceTitle}</div>
      <span style="background:rgba(255,255,255,.2); padding:4px 16px; border-radius:999px; font-size:14px; font-weight:700;">Nr ${escapeHtml(invoice.number)}</span>
    </div>
    <div class="content">
      <div class="invoice-head" style="margin-bottom:18px;">
        <div>
          <div style="display:inline-block; padding:3px 14px; border-radius:999px; background:${tagBg}; color:#fff; font-size:12px; font-weight:700; margin-bottom:12px; letter-spacing:.03em;">${invoiceTitle}</div>
          <div style="font-size:14px; line-height:2.1;">
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Numer faktury:</span> <strong>${escapeHtml(invoice.number)}</strong></div>
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Data wystawienia:</span> ${escapeHtml(invoice.issue_date)}</div>
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Data sprzeda\u017cy / us\u0142ugi:</span> ${escapeHtml(invoice.sale_date || invoice.issue_date)}</div>
            <div><span style="color:var(--muted); display:inline-block; width:210px;">Miejsce wystawienia:</span> ${escapeHtml(invoice.issue_place || contractMeta?.contractLocation || '\u2014')}</div>
            ${contractMeta?.contractNumber ? `<div><span style="color:var(--muted); display:inline-block; width:210px;">Nr umowy:</span> <strong>${escapeHtml(contractMeta.contractNumber)}</strong></div>` : ''}
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
      </div>

      <div style="margin-top:22px; padding:14px 20px; background:#f9fafb; border-radius:12px; border:1px solid var(--line); display:grid; grid-template-columns:1fr 1fr; gap:10px 32px; font-size:14px;">
        <div><span style="color:var(--muted);">Forma p\u0142atno\u015bci: </span><strong>${paymentMethodLabel}</strong></div>
        <div><span style="color:var(--muted);">Termin p\u0142atno\u015bci: </span><strong>${escapeHtml(invoice.due_date || '\u2014')}</strong></div>
        ${paymentMethod === 'transfer' ? `<div style="grid-column:span 2;"><span style="color:var(--muted);">Rachunek bankowy: </span><strong style="color:var(--red); font-family:monospace; font-size:15px;">${escapeHtml(bankAccount)}</strong></div>` : ''}
        <div><span style="color:var(--muted);">Status: </span><strong>${invoice.status === 'paid' ? '\u2713 Zap\u0142acona' : 'Oczekuje na p\u0142atno\u015b\u0107'}</strong></div>
      </div>

      ${invoice.notes ? `<div style="margin-top:18px; padding:12px 16px; border:1px solid var(--line); border-radius:10px; font-size:14px;"><strong>Uwagi: </strong>${escapeHtml(invoice.notes)}</div>` : ''}

      <div class="small" style="margin-top:16px; text-align:center; color:var(--muted);">${ksefInfo}</div>

      <div class="signature-grid" style="margin-top:50px;">
        <div class="signature"><div class="small" style="margin-top:4px;">Wystawi\u0142 / Sprzedawca</div></div>
        <div class="signature"><div class="small" style="margin-top:4px;">Odebra\u0142 / Nabywca</div></div>
      </div>
    </div>
    ${footer(company)}
  </section>`
  return pageShell(invoice.number, invoiceTitle, page)
}

export function buildInvoiceXml(invoice: Invoice) {
  const typeAttr = invoice.invoice_type ? ` type="${invoice.invoice_type}"` : ''
  const items = invoice.items
    .map((item) => `    <Item><Description>${escapeXml(item.description)}</Description><Quantity>${item.quantity}</Quantity><Unit>${escapeXml(item.unit)}</Unit><UnitPriceNet>${item.unit_price}</UnitPriceNet><VatRate>${item.vat_rate}</VatRate><Label>${escapeXml(item.tranche_label || '')}</Label></Item>`)
    .join('\n')
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
  <Items>
${items}
  </Items>
</Invoice>`
}

function renderContractTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((acc, [key, value]) => replaceEvery(acc, `{{${key}}}`, value), template)
}

function contractPartiesHtml(clientName: string, company: CompanyMeta) {
  return `<div class="party-grid">
    <div class="party-box">
      <h3>Inwestor</h3>
      <strong>${escapeHtml(clientName)}</strong>
      <p>zwany/a dalej <strong>„Inwestorem"</strong></p>
    </div>
    <div class="party-box">
      <h3>Wykonawca</h3>
      <strong>${escapeHtml(company.name || '—')}</strong>
      ${company.address ? `<p>${escapeHtml(company.address)}</p>` : ''}
      ${company.nip ? `<p>NIP: ${escapeHtml(company.nip)}</p>` : ''}
      ${company.email ? `<p>${escapeHtml(company.email)}</p>` : ''}
      <p>zwany dalej <strong>„Wykonawcą"</strong></p>
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
  clientName: string,
  estimateName: string,
  company: CompanyMeta,
): string {
  const net = contract.value_net ?? contract.value
  const gross = contract.value
  const vatRate = contract.vat_rate ?? 23
  const vatAmt = gross - net
  const customParas = (contract.custom_paragraphs ?? [])
  const nCustom = customParas.length
  const zmOffset = 6 + nCustom

  const customParaSections = customParas.map((p, i) => `
    <div class="section">
      <h2>§${6 + i} ${escapeHtml(p.title || 'Postanowienie dodatkowe')}</h2>
      <ol>${p.content.split('\n').filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join('') || `<li>${escapeHtml(p.content)}</li>`}</ol>
    </div>`).join('')

  return `
    ${contractPartiesHtml(clientName, company)}

    <div class="section">
      <h2>§1 Przedmiot umowy</h2>
      <ol>
        <li>Wykonawca zobowiązuje się do wykonania na rzecz Inwestora robót budowlanych / wykończeniowych / remontowych polegających na: <strong>${escapeHtml(estimateName || contract.notes || 'robotach budowlano-wykończeniowych')}</strong>${contract.template_name ? `, zgodnie z kosztorysem stanowiącym Załącznik nr 1 do umowy` : ''}.</li>
        <li>Prace będą wykonane w obiekcie zlokalizowanym pod adresem: <strong>${escapeHtml(contract.location || 'do uzupełnienia')}</strong>.</li>
        <li>Szczegółowy zakres robót, materiały i sposób rozliczenia określa kosztorys stanowiący integralną część niniejszej umowy.</li>
        <li>Wykonawca oświadcza, że posiada niezbędne kwalifikacje i uprawnienia do wykonania przedmiotu umowy.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§2 Termin realizacji</h2>
      <ol>
        <li>Strony uzgadniają następujące terminy realizacji umowy:<br/>
          a) termin przekazania terenu / obiektu i rozpoczęcia robót: <strong>${escapeHtml(contract.start_date || 'do ustalenia')}</strong>,<br/>
          b) termin zakończenia robót i przekazania do odbioru końcowego: <strong>${escapeHtml(contract.end_date || 'do ustalenia')}</strong>.
        </li>
        <li>W przypadku niemożności zachowania powyższych terminów z przyczyn niezależnych od Wykonawcy (opóźnienia dostaw materiałów, okoliczności force majeure), termin ulega przedłużeniu o odpowiedni okres, pod warunkiem pisemnego powiadomienia Inwestora.</li>
        <li>Za opóźnienie w finalizacji robót z winy Wykonawcy, Inwestor może naliczyć karę umowną w wysokości 0,1% wartości wynagrodzenia brutto za każdy dzień zwłoki, nie więcej niż 10% wynagrodzenia brutto.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§3 Wynagrodzenie</h2>
      <ol>
        <li>Za wykonanie przedmiotu umowy Strony ustalają wynagrodzenie ryczałtowe w następującej wysokości:</li>
      </ol>
      <div class="totals-box" style="margin-top:14px;margin-bottom:14px;">
        <div class="totals-line"><span>Wartość netto:</span><span>${formatCurrency(net)}</span></div>
        <div class="totals-line"><span>Podatek VAT (${vatRate}%):</span><span>${formatCurrency(vatAmt)}</span></div>
        <div class="totals-line"><strong>RAZEM BRUTTO:</strong><strong>${formatCurrency(gross)}</strong></div>
      </div>
      <ol start="2">
        <li>Wynagrodzenie płatne jest w transzach, zgodnie z poniższym harmonogramem płatności:
          ${contractTranchesTable(contract.tranches ?? [], gross)}
        </li>
        <li>Każda transza płatna jest na podstawie faktury VAT lub rachunku wystawionego przez Wykonawcę, w terminie 7 dni od daty doręczenia dokumentu Inwestorowi.</li>
        <li>W przypadku nieterminowej zapłaty Wykonawca uprawniony jest do naliczania odsetek ustawowych za każdy dzień zwłoki.</li>
        <li>Materiały i ich transport niezbędne do realizacji robót wliczone są w wynagrodzenie, chyba że Strony w odrębnym aneksie postanowią inaczej.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§4 Gwarancja i rękojmia</h2>
      <ol>
        <li>Na wykonane roboty Wykonawca udziela gwarancji na okres <strong>24 (dwudziestu czterech) miesięcy</strong>, liczonych od daty bezusterkowego odbioru końcowego potwierdzonego protokołem.</li>
        <li>W ramach rękojmi Wykonawca odpowiada za wady fizyczne wykonanych robót przez okres 2 lat od daty odbioru końcowego, na zasadach Kodeksu cywilnego.</li>
        <li>Ujawnione usterki lub wady Wykonawca usunie w terminie uzgodnionym z Inwestorem, nie dłuższym niż 14 dni roboczych od daty zgłoszenia. W przypadkach wymagających dłuższego czasu z uwagi na specyfikę lub skalę usterki, strony ustalą termin pisemnie.</li>
        <li>Gwarancja nie obejmuje uszkodzeń powstałych wskutek nieprawidłowej eksploatacji, działania osób trzecich, wandalizmu lub zdarzeń losowych niezależnych od Wykonawcy.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§5 Obowiązki Inwestora</h2>
      <ol>
        <li>Inwestor zobowiązuje się do:
          <ol type="a">
            <li>udostępnienia Wykonawcy obiektu / terenu robót najpóźniej w dniu wskazanym jako termin rozpoczęcia prac,</li>
            <li>zapewnienia dostępu do energii elektrycznej i wody na czas trwania robót (koszty mediów ponosi Inwestor),</li>
            <li>terminowego dokonywania płatności zgodnie z harmonogramem transz określonym w §3,</li>
            <li>pisemnego informowania Wykonawcy o wszelkich okolicznościach mogących mieć wpływ na realizację prac,</li>
            <li>podejmowania bieżących decyzji dotyczących zakresu i materiałów niezwłocznie po ich zgłoszeniu przez Wykonawcę.</li>
          </ol>
        </li>
        <li>W trakcie realizacji robót Inwestor nie będzie ingerował w sposób wykonywania prac przez Wykonawcę i jego podwykonawców.</li>
        <li>Odbiór robót nastąpi na podstawie protokołu odbioru podpisanego przez obie Strony. Inwestor zobowiązuje się do uczestnictwa w odbiorze w terminie uzgodnionym przez Strony.</li>
      </ol>
    </div>

    ${customParaSections}

    <div class="section">
      <h2>§${zmOffset} Zmiany umowy</h2>
      <ol>
        <li>Wszelkie zmiany i uzupełnienia niniejszej umowy wymagają formy pisemnej pod rygorem nieważności.</li>
        <li>Prace dodatkowe, wykraczające poza zakres opisany w §1, realizowane będą wyłącznie na podstawie odrębnego pisemnego zlecenia zaakceptowanego przez obie Strony, zawierającego zakres i wycenę prac dodatkowych.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§${zmOffset + 1} Załączniki</h2>
      <ol>
        <li>Integralnymi częściami niniejszej umowy są następujące załączniki:
          <ol type="a">
            <li>Załącznik nr 1 – Kosztorys / wycena ofertowa${contract.template_name ? ` (${escapeHtml(contract.template_name)})` : ''},</li>
            <li>Załącznik nr 2 – Harmonogram transz płatności.</li>
          </ol>
        </li>
      </ol>
    </div>

    <div class="section">
      <h2>§${zmOffset + 2} Egzemplarze</h2>
      <ol>
        <li>Niniejszą umowę sporządzono w dwóch jednobrzmiących egzemplarzach – po jednym dla każdej ze Stron.</li>
      </ol>
    </div>

    <div class="section">
      <h2>§${zmOffset + 3} Postanowienia końcowe</h2>
      <ol>
        <li>W sprawach nieuregulowanych niniejszą umową zastosowanie mają przepisy Kodeksu cywilnego Rzeczypospolitej Polskiej, w szczególności przepisy dotyczące umowy o dzieło oraz umowy o roboty budowlane.</li>
        <li>Wszelkie spory wynikłe na tle wykonania niniejszej umowy Strony zobowiązują się rozstrzygać w pierwszej kolejności na drodze polubownej. W razie braku porozumienia spory będą kierowane do sądu powszechnego właściwego miejscowo dla siedziby Wykonawcy.</li>
        <li>Umowa wchodzi w życie z dniem jej podpisania przez obie Strony.</li>
      </ol>
    </div>

    <div class="signature-grid" style="margin-top:60px;">
      <div class="signature">
        <strong>${escapeHtml(clientName)}</strong>
        <div class="small" style="margin-top:4px;">Inwestor</div>
      </div>
      <div class="signature">
        <strong>${escapeHtml(company.name || 'Wykonawca')}</strong>
        <div class="small" style="margin-top:4px;">Wykonawca</div>
      </div>
    </div>
  `
}

export function buildContractPreview(contract: import('@/entities/contract/model').Contract, clientName?: string, estimateName?: string, companyInput?: CompanyMeta) {
  const company = defaultCompany(companyInput)
  const locationOrCity = contract.location || '—'

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
      ${buildFullContractHtml(contract, clientName || 'Klient', estimateName || contract.notes || 'roboty wykończeniowe', company)}
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

function escapeXml(value: string) {
  return replaceEvery(replaceEvery(replaceEvery(replaceEvery(replaceEvery(value, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), "'", '&apos;')
}
