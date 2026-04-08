import { useMemo, useState } from 'react'
import { TrendingDown, TrendingUp, Minus, AlertCircle, CheckCircle, Clock, XCircle, FileDown } from 'lucide-react'
import { useProjectExpenses } from '@/features/expenses/hooks/useProjectExpenses'
import { useEstimates } from '@/features/estimates/hooks/useEstimates'
import { useContracts } from '@/features/contracts/hooks/useContracts'
import { formatCurrency } from '@/shared/lib/formatters'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { Button } from '@/shared/ui/Button/Button'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'

const COST_TYPE_LABEL: Record<string, string> = {
  material:  'Materiały',
  service:   'Usługi',
  equipment: 'Sprzęt',
  labor:     'Robocizna',
  transport: 'Transport',
  other:     'Inne',
}

const APPROVAL_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  accepted:       { label: 'Zaakceptowane',  color: 'var(--color-success, #10b981)', icon: CheckCircle },
  not_sent:       { label: 'Nierozesłane',   color: 'var(--color-text-secondary)',   icon: Minus },
  pending_client: { label: 'Oczekuje',       color: 'var(--color-warning, #f59e0b)', icon: Clock },
  questioned:     { label: 'Zakwestionowane',color: 'var(--color-warning, #f59e0b)', icon: AlertCircle },
  rejected:       { label: 'Odrzucone',      color: 'var(--color-error, #ef4444)',   icon: XCircle },
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function Row({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: color ?? 'inherit' }}>{value}</span>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

/** Pick best contract for budget reference: signed > draft, latest first */
function pickBestContract(contracts: ReturnType<typeof useContracts>['data'], projectId: string) {
  const forProject = (contracts ?? []).filter(c => c.project_id === projectId)
  const signed = forProject.filter(c => c.status === 'signed')
  if (signed.length > 0) return signed[signed.length - 1]
  return forProject.length > 0 ? forProject[forProject.length - 1] : undefined
}

/** Pick best estimate: accepted > sent > draft, latest first */
function pickBestEstimate(estimates: ReturnType<typeof useEstimates>['data'], projectId: string) {
  const forProject = (estimates ?? []).filter(e => e.project_id === projectId)
  for (const status of ['accepted', 'sent', 'draft']) {
    const match = forProject.filter(e => e.status === status)
    if (match.length > 0) return match[match.length - 1]
  }
  return forProject.length > 0 ? forProject[forProject.length - 1] : undefined
}

export function BudgetComparisonTab({ projectId, projectName, projectNumber }: { projectId: string; projectName?: string; projectNumber?: string }) {
  const [exporting, setExporting] = useState(false)
  const { data: expenses = [], isLoading: expLoading } = useProjectExpenses(projectId)
  const { data: estimates = [], isLoading: estLoading } = useEstimates()
  const { data: contracts = [], isLoading: conLoading } = useContracts()
  const companyMeta = useCompanyMeta()

  const isLoading = expLoading || estLoading || conLoading

  const stats = useMemo(() => {
    const contract = pickBestContract(contracts, projectId)
    const estimate = !contract ? pickBestEstimate(estimates, projectId) : pickBestEstimate(estimates, projectId)

    const plannedGross = contract?.value ?? estimate?.total_gross ?? 0
    const plannedNet   = contract?.value_net ?? estimate?.total_net ?? 0
    const source       = contract ? (contract.status === 'signed' ? 'umowa podpisana' : 'umowa (szkic)') : estimate ? `wycena (${estimate.status})` : null

    const actualGross = expenses.reduce((s, e) => s + (e.amount_gross ?? 0), 0)
    const actualNet   = expenses.reduce((s, e) => s + (e.amount_net   ?? 0), 0)

    const diff       = plannedGross - actualGross
    const diffPct    = plannedGross > 0 ? Math.round((diff / plannedGross) * 100) : null
    const overBudget = diff < 0

    // Margin = contract revenue - actual costs (if contract exists)
    const revenue     = contract?.value ?? 0
    const margin      = revenue > 0 ? revenue - actualGross : null
    const marginPct   = revenue > 0 ? Math.round(((revenue - actualGross) / revenue) * 100) : null

    // By category
    const byCategory = expenses.reduce<Record<string, number>>((acc, exp) => {
      const cat = exp.cost_type || 'other'
      acc[cat] = (acc[cat] ?? 0) + (exp.amount_gross ?? 0)
      return acc
    }, {})

    // By approval status
    const byApproval = expenses.reduce<Record<string, number>>((acc, exp) => {
      const st = exp.approval_status || 'not_sent'
      acc[st] = (acc[st] ?? 0) + (exp.amount_gross ?? 0)
      return acc
    }, {})

    return {
      estimate, contract,
      plannedGross, plannedNet,
      actualGross, actualNet,
      diff, diffPct, overBudget,
      revenue, margin, marginPct,
      byCategory, byApproval,
      source,
      expenseCount: expenses.length,
    }
  }, [expenses, estimates, contracts, projectId])

  if (isLoading) return <div style={{ padding: 24, textAlign: 'center' }}><Spinner /></div>

  const hasData = stats.plannedGross > 0 || stats.actualGross > 0

  async function handleExportPdf() {
    setExporting(true)
    try {
      const { buildBudgetReportPreview } = await import('@/services/pdf/documentPreview')
      const { generatePdfBlob } = await import('@/services/pdf/pdfGenerator')
      const { downloadBlob } = await import('@/shared/lib/downloads')
      const reportData = {
        projectName:  projectName ?? 'Projekt',
        projectNumber: projectNumber ?? '',
        source:       stats.source,
        plannedGross: stats.plannedGross,
        plannedNet:   stats.plannedNet,
        actualGross:  stats.actualGross,
        actualNet:    stats.actualNet,
        diff:         stats.diff,
        diffPct:      stats.diffPct,
        overBudget:   stats.overBudget,
        revenue:      stats.revenue,
        margin:       stats.margin,
        marginPct:    stats.marginPct,
        byCategory:   stats.byCategory,
        byApproval:   stats.byApproval,
        tranches:     stats.contract?.tranches ?? [],
        expenseCount: stats.expenseCount,
        generatedAt:  new Date().toLocaleDateString('pl-PL'),
      }
      const html = buildBudgetReportPreview(reportData, {
        name: companyMeta.name,
        nip: companyMeta.nip,
        address: companyMeta.address,
        postalCity: companyMeta.postalCity,
        email: companyMeta.email,
        phone: companyMeta.phone,
        logoUrl: companyMeta.logoUrl,
      })
      const blob = await generatePdfBlob(html)
      const filename = `Raport_budzetu_${(projectNumber ?? 'projekt').replace(/[/\\:*?"<>|]/g, '_')}.pdf`
      downloadBlob(filename, blob)
    } finally {
      setExporting(false)
    }
  }

  if (!hasData) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
        <p style={{ fontSize: '0.85rem', margin: 0 }}>Brak danych budżetowych.</p>
        <p style={{ fontSize: '0.78rem', margin: '6px 0 0', opacity: 0.7 }}>Dodaj wycenę lub umowę do projektu, a koszty pojawią się automatycznie.</p>
      </div>
    )
  }

  const statusColor  = stats.overBudget ? 'var(--color-error)' : stats.diffPct !== null && stats.diffPct < 15 ? 'var(--color-warning, #f59e0b)' : 'var(--color-success)'
  const StatusIcon   = stats.overBudget ? TrendingDown : stats.diffPct !== null && stats.diffPct > 0 ? TrendingUp : Minus
  const marginColor  = stats.margin === null ? 'inherit' : stats.margin < 0 ? 'var(--color-error)' : stats.margin < stats.revenue * 0.1 ? 'var(--color-warning, #f59e0b)' : 'var(--color-success)'
  const hasApprovals = Object.keys(stats.byApproval).some(k => k !== 'not_sent')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>

      {hasData && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={handleExportPdf} loading={exporting}>
            <FileDown size={14} style={{ marginRight: 5 }} />
            Pobierz PDF
          </Button>
        </div>
      )}
      <div style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
            Budżet {stats.source ? `· ${stats.source}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: statusColor }}>
            <StatusIcon size={14} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {stats.overBudget ? 'Przekroczony' : stats.diffPct !== null ? `${stats.diffPct}% wolne` : '—'}
            </span>
          </div>
        </div>

        {/* Duże liczby */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Plan (brutto)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(stats.plannedGross)}</div>
            {stats.plannedNet > 0 && stats.plannedNet !== stats.plannedGross && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>netto: {formatCurrency(stats.plannedNet)}</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Wykonanie (brutto)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stats.overBudget ? 'var(--color-error)' : 'inherit' }}>
              {formatCurrency(stats.actualGross)}
            </div>
            {stats.actualNet > 0 && stats.actualNet !== stats.actualGross && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>netto: {formatCurrency(stats.actualNet)}</div>
            )}
          </div>
        </div>

        {/* Pasek postępu */}
        {stats.plannedGross > 0 && (
          <>
            <ProgressBar value={stats.actualGross} max={stats.plannedGross} color={stats.overBudget ? 'var(--color-error)' : statusColor} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>0</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                {stats.actualGross > 0 ? `${Math.round((stats.actualGross / stats.plannedGross) * 100)}% wydane` : 'brak kosztów'}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{formatCurrency(stats.plannedGross)}</span>
            </div>
          </>
        )}

        {/* Różnica */}
        {stats.plannedGross > 0 && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: stats.overBudget ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: statusColor }}>
              {stats.overBudget ? '⚠ Przekroczenie: ' : '✓ Pozostało: '}
              {formatCurrency(Math.abs(stats.diff))}
              {stats.diffPct !== null && ` (${Math.abs(stats.diffPct)}%)`}
            </span>
          </div>
        )}
      </div>

      {/* Marża — tylko gdy jest umowa */}
      {stats.margin !== null && (
        <div style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Marża projektu
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Przychód</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatCurrency(stats.revenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Koszty</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatCurrency(stats.actualGross)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Marża brutto</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: marginColor }}>
                {formatCurrency(stats.margin)}
                {stats.marginPct !== null && (
                  <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>({stats.marginPct}%)</span>
                )}
              </div>
            </div>
          </div>
          {stats.margin !== null && stats.actualGross > 0 && (
            <ProgressBar
              value={Math.max(0, stats.margin)}
              max={stats.revenue}
              color={marginColor}
            />
          )}
        </div>
      )}

      {/* Status zatwierdzeń kosztów */}
      {hasApprovals && (
        <div style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Status zatwierdzeń
          </div>
          {Object.entries(stats.byApproval)
            .sort(([a], [b]) => {
              const order = ['accepted', 'pending_client', 'questioned', 'rejected', 'not_sent']
              return order.indexOf(a) - order.indexOf(b)
            })
            .map(([status, amount]) => {
              const cfg = APPROVAL_CONFIG[status] ?? APPROVAL_CONFIG['not_sent']
              const Icon = cfg.icon
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: cfg.color }}>{formatCurrency(amount)}</span>
                </div>
              )
            })}
        </div>
      )}

      {/* Koszty wg kategorii */}
      {Object.keys(stats.byCategory).length > 0 && (
        <div style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Koszty wg kategorii
          </div>
          {Object.entries(stats.byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                  <span style={{ fontSize: '0.82rem' }}>{COST_TYPE_LABEL[cat] ?? cat}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{formatCurrency(amount)}</span>
                    {stats.actualGross > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                        {Math.round((amount / stats.actualGross) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <ProgressBar value={amount} max={stats.actualGross} color="var(--color-brand)" />
              </div>
            ))}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Łącznie ({stats.expenseCount} pozycji)</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{formatCurrency(stats.actualGross)}</span>
          </div>
        </div>
      )}

      {/* Transze umowy */}
      {stats.contract && (stats.contract.tranches?.length ?? 0) > 0 && (
        <div style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Transze umowy
          </div>
          {stats.contract.tranches.map(t => (
            <Row
              key={t.id}
              label={t.label}
              value={formatCurrency(t.amount)}
              sub={t.status === 'paid' ? '✓ Opłacona' : t.status === 'invoiced' ? 'Zafakturowana' : t.due_date ? `Termin: ${t.due_date}` : undefined}
              color={t.status === 'paid' ? 'var(--color-success)' : undefined}
            />
          ))}
        </div>
      )}

      {!stats.estimate && !stats.contract && stats.actualGross > 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', padding: '8px 12px', background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          💡 Dodaj wycenę lub umowę do projektu, aby zobaczyć porównanie planu z wykonaniem.
        </div>
      )}
    </div>
  )
}
