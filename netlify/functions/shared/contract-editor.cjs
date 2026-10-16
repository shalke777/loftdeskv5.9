const { checked } = require('./private-runtime.cjs')

function validateDates(patch, current) {
  const merged = { ...current, ...patch }
  for (const key of ['start_date', 'end_date', 'sign_date']) {
    const date = merged[key]
    if (date != null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Invalid contract date')
  }
  if (merged.start_date && merged.end_date && merged.start_date > merged.end_date) throw new Error('End date precedes start date')
}

// Called only after the MCP schema and owner write grant have been checked.
// Patch replacement is retry-safe and never creates invoices or sends documents.
async function updateContract(ctx, id, patch) {
  if (!ctx.canWrite) throw new Error('To połączenie ma dostęp tylko do odczytu.')
  if (!Object.keys(patch).length) throw new Error('Supply at least one contract field')
  const current = await checked(ctx.sb.from('contracts').select('*').eq('company_id', ctx.companyId).eq('id', id).single())
  if (!current) throw new Error('Contract not found')
  validateDates(patch, current)
  if (patch.tranches) {
    const ids = new Set()
    for (const tranche of patch.tranches) {
      if (ids.has(tranche.id) || Math.abs(tranche.amount * 100 - Math.round(tranche.amount * 100)) > 0.000001) throw new Error('Invalid tranche ID or amount precision')
      ids.add(tranche.id)
      if (tranche.due_date && (!/^\d{4}-\d{2}-\d{2}$/.test(tranche.due_date) || !Number.isFinite(Date.parse(tranche.due_date)) || new Date(tranche.due_date).toISOString().slice(0, 10) !== tranche.due_date)) throw new Error('Invalid tranche date')
    }
  }
  const document = await checked(ctx.sb.from('contracts').update(patch).eq('company_id', ctx.companyId).eq('id', id).select('*').single())
  if (!document) throw new Error('Contract update did not persist')
  return { status: 'done', document }
}
module.exports = { updateContract }
