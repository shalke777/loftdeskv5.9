// =============================================================================
// ClientDashboardPage — lista projektów zalogowanego klienta (v6.0)
// =============================================================================

import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useClientProjects, useClientStandaloneInvoices } from '@/features/client-portal/hooks/useClientPortal'
import { Badge } from '@/shared/ui/Badge/Badge'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildInvoicePreview } from '@/services/pdf/documentPreview'
import type { ClientProject, ClientInvoice } from '@/features/client-portal/api/client-portal.api'

const STATUS_LABEL: Record<string, string> = {
  offer:     'Wycena',
  active:    'W realizacji',
  done:      'Zakończony',
  cancelled: 'Anulowany',
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  offer:     'default',
  active:    'warning',
  done:      'success',
  cancelled: 'danger',
}

function ProjectCard({ project }: { project: ClientProject }) {
  return (
    <Link
      to="/client/project/$id"
      params={{ id: project.id }}
      className="client-project-card"
    >
      <div className="client-project-card__header">
        <span className="client-project-card__number">{project.number}</span>
        <Badge variant={STATUS_VARIANT[project.status] ?? 'default'}>
          {STATUS_LABEL[project.status] ?? project.status}
        </Badge>
      </div>
      <h3 className="client-project-card__name">{project.name}</h3>
      {(project.address || project.investment_address) && (
        <p className="client-project-card__address">
          📍 {project.investment_address || project.address}
        </p>
      )}
      <div className="client-project-card__dates">
        {project.start_date && (
          <span>Start: {new Date(project.start_date + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        )}
        {project.end_date && (
          <span>Koniec: {new Date(project.end_date + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        )}
      </div>
    </Link>
  )
}

const INV_STATUS_LABEL: Record<string, string> = {
  draft: 'W przygotowaniu', issued: 'Wystawiona', sent: 'Do zapłaty',
  unpaid: 'Nieopłacona', paid: 'Opłacona', overdue: 'Przeterminowana',
}
const INV_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  draft: 'default', issued: 'default', sent: 'warning',
  unpaid: 'warning', paid: 'success', overdue: 'danger',
}

function StandaloneInvoiceCard({ invoice, onPreview }: { invoice: ClientInvoice; onPreview: (inv: ClientInvoice) => void }) {
  const gross = invoice.total_gross
  return (
    <div
      className="client-project-card"
      style={{ cursor: 'pointer' }}
      onClick={() => onPreview(invoice)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onPreview(invoice) }}
    >
      <div className="client-project-card__header">
        <span className="client-project-card__number">{invoice.number}</span>
        <Badge variant={INV_STATUS_VARIANT[invoice.status] ?? 'default'}>
          {INV_STATUS_LABEL[invoice.status] ?? invoice.status}
        </Badge>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {gross != null ? `${gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł` : '—'}
        </span>
        {invoice.due_date && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            Termin: {new Date(invoice.due_date + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}

function StandaloneInvoicesSection() {
  const { data: invoices, isLoading } = useClientStandaloneInvoices()
  const [preview, setPreview] = useState<{ html: string; title: string } | null>(null)

  if (isLoading || !invoices || invoices.length === 0) return null

  function handlePreview(inv: ClientInvoice) {
    const items = ((inv as any).items ?? []).map((it: any) => ({
      id: it.id, description: it.description, unit: it.unit,
      quantity: Number(it.quantity), unit_price: Number(it.unit_price),
      vat_rate: Number(it.vat_rate ?? 23), sort_order: it.sort_order ?? 0,
      tranche_label: it.tranche_label ?? '',
    }))
    const totalNet = Math.round(items.reduce((s: number, it: any) => s + it.quantity * it.unit_price, 0) * 100) / 100
    const totalGross = Math.round(items.reduce((s: number, it: any) => s + it.quantity * it.unit_price * (1 + it.vat_rate / 100), 0) * 100) / 100
    const html = buildInvoicePreview({
      ...inv, items, total_net: totalNet, total_gross: totalGross,
      company_id: '', client_id: null, contract_id: null, tranche_id: null, created_at: '',
    } as any)
    setPreview({ html, title: `${inv.number} · Faktura` })
  }

  return (
    <>
      <h2 className="client-section-title" style={{ marginTop: 32 }}>Faktury</h2>
      <div className="client-project-list">
        {invoices.map((inv) => (
          <StandaloneInvoiceCard key={inv.id} invoice={inv} onPreview={handlePreview} />
        ))}
      </div>
      <DocumentPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ''}
        tabs={preview ? [{ key: 'pdf', label: 'Podgląd', type: 'html' as const, content: preview.html }] : []}
      />
    </>
  )
}

export function ClientDashboardPage() {
  const { data: projects, isLoading, isError } = useClientProjects()

  if (isLoading) {
    return (
      <div className="client-page-loading">
        <span>Ładowanie projektów...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="client-page-error">
        <p>Nie udało się załadować projektów. Spróbuj odświeżyć stronę.</p>
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    // No projects — but might have standalone invoices
    return (
      <div>
        <div className="client-page-empty">
          <div className="client-page-empty__icon">📁</div>
          <h2>Brak projektów</h2>
          <p>Nie masz jeszcze dostępu do żadnych projektów.<br />Skontaktuj się ze swoim wykonawcą.</p>
        </div>
        <StandaloneInvoicesSection />
      </div>
    )
  }

  return (
    <div>
      <h2 className="client-section-title">Twoje projekty</h2>
      <div className="client-project-list">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      <StandaloneInvoicesSection />
    </div>
  )
}
