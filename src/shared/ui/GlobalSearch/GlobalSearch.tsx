import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Search,
  Users,
  FolderKanban,
  Receipt,
  Calculator,
  FileText,
  X,
} from 'lucide-react'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useInvoices } from '@/features/invoices/hooks/useInvoices'
import { useEstimates } from '@/features/estimates/hooks/useEstimates'
import { useContracts } from '@/features/contracts/hooks/useContracts'

interface SearchResult {
  id: string
  type: 'client' | 'project' | 'invoice' | 'estimate' | 'contract'
  label: string
  sub?: string
  to: string
}

const TYPE_META: Record<SearchResult['type'], { icon: typeof Users; color: string; label: string }> = {
  client:   { icon: Users,        color: 'var(--color-brand)',   label: 'Klient' },
  project:  { icon: FolderKanban, color: 'var(--color-success)', label: 'Projekt' },
  invoice:  { icon: Receipt,      color: 'var(--color-accent)',  label: 'Faktura' },
  estimate: { icon: Calculator,   color: 'var(--color-info)',    label: 'Kosztorys' },
  contract: { icon: FileText,     color: 'var(--color-warning)', label: 'Umowa' },
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Data sources (cached by React Query — no extra fetches)
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const { data: invoices = [] } = useInvoices()
  const { data: estimates = [] } = useEstimates()
  const { data: contracts = [] } = useContracts()

  // Build search index
  const allItems = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = []
    for (const c of clients) {
      items.push({
        id: `c-${c.id}`,
        type: 'client',
        label: c.name || 'Klient bez nazwy',
        sub: c.nip ? `NIP: ${c.nip}` : c.email || undefined,
        to: '/clients',
      })
    }
    for (const p of projects) {
      items.push({
        id: `p-${p.id}`,
        type: 'project',
        label: p.name || 'Projekt',
        sub: p.status || undefined,
        to: `/projects/${p.id}`,
      })
    }
    for (const inv of invoices) {
      items.push({
        id: `i-${inv.id}`,
        type: 'invoice',
        label: inv.number || `Faktura #${inv.id.slice(0, 6)}`,
        sub: undefined,
        to: '/invoices',
      })
    }
    for (const est of estimates) {
      items.push({
        id: `e-${est.id}`,
        type: 'estimate',
        label: est.number || `Kosztorys #${est.id.slice(0, 6)}`,
        sub: undefined,
        to: '/estimates',
      })
    }
    for (const ct of contracts) {
      items.push({
        id: `ct-${ct.id}`,
        type: 'contract',
        label: ct.number || `Umowa #${ct.id.slice(0, 6)}`,
        sub: undefined,
        to: '/contracts',
      })
    }
    return items
  }, [clients, projects, invoices, estimates, contracts])

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    return allItems
      .filter((item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sub && item.sub.toLowerCase().includes(q))
      )
      .slice(0, 12)
  }, [query, allItems])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const goTo = useCallback((result: SearchResult) => {
    setOpen(false)
    void navigate({ to: result.to })
  }, [navigate])

  // Keyboard navigation
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault()
      goTo(results[activeIdx])
    }
  }, [results, activeIdx, goTo])

  if (!open) {
    return (
      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Szukaj"
      >
        <Search size={15} />
        <span className="global-search-trigger__label">Szukaj…</span>
        <kbd className="global-search-trigger__kbd">{navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}</kbd>
      </button>
    )
  }

  return (
    <div className="global-search-backdrop" onClick={() => setOpen(false)}>
      <div className="global-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-panel__input-row">
          <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            className="global-search-panel__input"
            placeholder="Szukaj klientów, projektów, faktur…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={onKeyDown}
          />
          <button type="button" className="global-search-panel__close" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {query.trim() && results.length === 0 && (
          <div className="global-search-panel__empty">
            Brak wyników dla „{query}"
          </div>
        )}

        {results.length > 0 && (
          <div className="global-search-panel__results">
            {results.map((r, idx) => {
              const meta = TYPE_META[r.type]
              const Icon = meta.icon
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`global-search-result ${idx === activeIdx ? 'global-search-result--active' : ''}`}
                  onClick={() => goTo(r)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <span className="global-search-result__icon" style={{ background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}>
                    <Icon size={15} style={{ color: meta.color }} />
                  </span>
                  <div className="global-search-result__text">
                    <span className="global-search-result__label">{r.label}</span>
                    {r.sub && <span className="global-search-result__sub">{r.sub}</span>}
                  </div>
                  <span className="global-search-result__type">{meta.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {!query.trim() && (
          <div className="global-search-panel__hint">
            Zacznij pisać, aby wyszukać klientów, projekty, faktury, kosztorysy i umowy.
          </div>
        )}
      </div>
    </div>
  )
}
