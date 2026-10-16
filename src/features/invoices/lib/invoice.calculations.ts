import type { InvoiceItem } from '@/entities/invoice/model'

type AmountItem = Pick<InvoiceItem, 'quantity' | 'unit_price'> & { vat_rate?: number }

/** Round each displayed net line and its VAT to grosze, identically in DB, PDF and XML. */
function cents(value: number) {
  if (!Number.isFinite(value)) return value
  const [significand, exponent = '0'] = Math.abs(value).toString().split('e')
  return Math.sign(value) * Math.round(Number(`${significand}e${Number(exponent) + 2}`))
}

export function calcInvoiceLine(item: AmountItem) {
  const netCents = cents(Number(item.quantity) * Number(item.unit_price))
  const vatCents = cents((netCents / 100) * Number(item.vat_rate ?? 23) / 100)
  return { net: netCents / 100, vat: vatCents / 100, gross: (netCents + vatCents) / 100 }
}

export function calcInvoiceTotals(items: AmountItem[]) {
  let netCents = 0
  let vatCents = 0
  for (const item of items) {
    const line = calcInvoiceLine(item)
    netCents += cents(line.net)
    vatCents += cents(line.vat)
  }
  return { totalNet: netCents / 100, totalVat: vatCents / 100, totalGross: (netCents + vatCents) / 100 }
}

export function calcInvoiceVatGroups(items: AmountItem[]) {
  const groups = new Map<number, { net: number; vat: number; gross: number }>()
  for (const item of items) {
    const rate = Number(item.vat_rate ?? 23)
    const line = calcInvoiceLine(item)
    const previous = groups.get(rate) ?? { net: 0, vat: 0, gross: 0 }
    const net = (cents(previous.net) + cents(line.net)) / 100
    const vat = (cents(previous.vat) + cents(line.vat)) / 100
    groups.set(rate, { net, vat, gross: (cents(net) + cents(vat)) / 100 })
  }
  return groups
}

/** Contract.value is gross. Older records may lack the explicit net amount. */
export function contractNetValue(contract: { value: number; value_net?: number | null; vat_rate?: number | null }) {
  if (contract.value_net != null && contract.value_net > 0) return contract.value_net
  const rate = Number(contract.vat_rate ?? 23)
  return cents(Number(contract.value ?? 0) / (1 + rate / 100)) / 100
}
