// =============================================================================
// WorkspaceContextPanel — left fixed panel in Project Workspace
// Client info · Budget summary · Completeness ring · Quick doc chips
// =============================================================================

import { Link } from '@tanstack/react-router'
import { Mail, Phone, MapPin, FileText, ArrowRight, TrendingUp } from 'lucide-react'
import type { Project } from '@/entities/project/model'
import type { Client } from '@/entities/client/model'
import type { Estimate } from '@/entities/estimate/model'
import type { Contract } from '@/entities/contract/model'
import type { Invoice } from '@/entities/invoice/model'

interface Props {
  project:    Project
  client:     Client | null
  estimates:  Estimate[]
  contracts:  Contract[]
  invoices:   Invoice[]
  onCreateEstimate:  () => void
  onCreateContract:  () => void
  onCreateInvoice:   () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(n)
}

// ─── Client card ─────────────────────────────────────────────────────────────

function ClientCard({ client, projectId }: { client: Client | null; projectId: string }) {
  if (!client) {
    return (
      <div className="ws-panel-card">
        <span className="ws-panel-label">Klient</span>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>Brak przypisanego klienta</p>
      </div>
    )
  }
  const initial = client.name.charAt(0).toUpperCase()
  return (
    <div className="ws-panel-card">
      <span className="ws-panel-label">Klient</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <div className="ws-avatar">{initial}</div>
        <div style={{ minWidth: 0 }}>
          <Link
            to={`/clients/${client.id}` as any}
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {client.name}
          </Link>
          {client.phone && (
            <div className="ws-meta-row"><Phone size={11} />{client.phone}</div>
          )}
        </div>
      </div>
      {client.email && (
        <div className="ws-meta-row" style={{ marginTop: 8 }}><Mail size={11} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</span></div>
      )}
      {client.address && (
        <div className="ws-meta-row"><MapPin size={11} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.address}</span></div>
      )}
    </div>
  )
}

// ─── Budget card ─────────────────────────────────────────────────────────────

function BudgetCard({ contracts, invoices }: { contracts: Contract[]; invoices: Invoice[] }) {
  const latestContract = contracts[contracts.length - 1] ?? null
  const contractVal = latestContract?.value ?? 0
  const invoicedTotal = invoices.reduce((acc, inv) => acc + (inv.total_gross ?? 0), 0)
  const pct = contractVal > 0 ? Math.min(100, Math.round((invoicedTotal / contractVal) * 100)) : 0

  return (
    <div className="ws-panel-card">
      <span className="ws-panel-label">Budżet projektu</span>
      {contractVal > 0 ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-brand)', marginTop: 8 }}>{fmt(contractVal)}</div>
          <div className="ws-budget-bar" style={{ marginTop: 10 }}>
            <div className="ws-budget-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Zafakturowano {pct}%</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{fmt(contractVal - invoicedTotal)} pozostało</span>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>Brak umowy — wartość nieznana</p>
      )}
    </div>
  )
}

// ─── Completeness ring ───────────────────────────────────────────────────────

function CompletenessCard({ score, flags }: { score: number; flags: Record<string, boolean> }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - score / 100)

  const items = [
    { key: 'has_client',   label: 'Klient'  },
    { key: 'has_estimate', label: 'Wycena'  },
    { key: 'has_contract', label: 'Umowa'   },
    { key: 'has_invoice',  label: 'Faktura' },
  ]

  return (
    <div className="ws-panel-card">
      <span className="ws-panel-label">Kompletność</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <svg width={52} height={52} viewBox="0 0 52 52" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={26} cy={26} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={5} />
          <circle
            cx={26} cy={26} r={r} fill="none"
            stroke={score >= 80 ? 'var(--color-brand)' : score >= 50 ? 'var(--color-accent)' : 'var(--color-error)'}
            strokeWidth={5}
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
          />
        </svg>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{score}%</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>kompletności</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', marginTop: 6 }}>
            {items.map(it => (
              <span key={it.key} style={{ fontSize: 10, color: flags[it.key] ? 'var(--color-brand)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: flags[it.key] ? 'var(--color-brand)' : 'var(--color-muted)', display: 'inline-block' }} />
                {it.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick doc chips ─────────────────────────────────────────────────────────

function DocChip({ label, exists, onClick }: { label: string; exists: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
        border: exists ? '1px solid var(--color-border)' : '1px dashed var(--color-border)',
        background: exists ? 'var(--color-surface-soft)' : 'transparent',
        color: exists ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
        fontWeight: exists ? 500 : 400,
      }}
    >
      <FileText size={11} />
      {label}
    </button>
  )
}

function QuickDocs({ estimates, contracts, invoices, onCreateEstimate, onCreateContract, onCreateInvoice }: {
  estimates: Estimate[]; contracts: Contract[]; invoices: Invoice[]
  onCreateEstimate: () => void; onCreateContract: () => void; onCreateInvoice: () => void
}) {
  return (
    <div className="ws-panel-card">
      <span className="ws-panel-label">Dokumenty</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <DocChip
          label={estimates.length > 0 ? `Wycena ${estimates[estimates.length - 1]?.number ?? ''}` : '+ Wycena'}
          exists={estimates.length > 0}
          onClick={onCreateEstimate}
        />
        <DocChip
          label={contracts.length > 0 ? `Umowa ${contracts[contracts.length - 1]?.number ?? ''}` : '+ Umowa'}
          exists={contracts.length > 0}
          onClick={onCreateContract}
        />
        <DocChip
          label={invoices.length > 0 ? `FV (${invoices.length})` : '+ Faktura'}
          exists={invoices.length > 0}
          onClick={onCreateInvoice}
        />
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function WorkspaceContextPanel({ project, client, estimates, contracts, invoices, onCreateEstimate, onCreateContract, onCreateInvoice }: Props) {
  const flags = (project.completeness_flags ?? {}) as Record<string, boolean>
  return (
    <aside className="ws-left-panel">
      <ClientCard client={client} projectId={project.id} />
      <BudgetCard contracts={contracts} invoices={invoices} />
      <CompletenessCard score={project.completeness_score ?? 0} flags={flags} />
      <QuickDocs
        estimates={estimates} contracts={contracts} invoices={invoices}
        onCreateEstimate={onCreateEstimate} onCreateContract={onCreateContract} onCreateInvoice={onCreateInvoice}
      />
      {project.address && (
        <div className="ws-panel-card">
          <span className="ws-panel-label">Lokalizacja</span>
          <div className="ws-meta-row" style={{ marginTop: 8 }}><MapPin size={11} />{project.address}</div>
        </div>
      )}
    </aside>
  )
}
