// =============================================================================
// ChatPage — globalny inbox wiadomości projektowych
// =============================================================================
//
// Layout: master/detail — lewa strona = lista wątków, prawa = wiadomości
//
// Filtrowanie:
//   - Wszystkie     — wszystkie aktywne wątki
//   - Nieprzeczytane — unread_count_operator > 0
//   - Projekt        — select z nazwami projektów
//
// BRAK "Nowej rozmowy" bez projektu — operator musi przejść do projektu
// i otworzyć zakładkę Wątki. Inbox to widok skrzynki odbiorczej, nie generator.
//
// LEGACY:
//   - conversations / conversation_messages — stary model, NIE wyświetlany tutaj
//   - portal_messages — stary model, NIE wyświetlany tutaj
//   Oba modele legacy pozostają w bazie bez migracji danych.

import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Badge } from '@/shared/ui/Badge/Badge'
import { ThreadList } from '@/features/projects/components/ThreadList'
import { ThreadView } from '@/features/projects/components/ThreadView'
import { MessageComposer } from '@/features/projects/components/MessageComposer'
import { threadsApi, type InboxThread } from '@/features/projects/api/threads.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import type { ProjectThread } from '@/features/portal/model/project-portal.types'

// ─── Typologia filtrów ────────────────────────────────────────────────────────

type FilterMode = 'all' | 'unread'

// ─── ChatPage ─────────────────────────────────────────────────────────────────

export function ChatPage() {
  const companyId   = useCompanyId()
  const [activeId, setActiveId]           = useState<string | null>(null)
  const [filter, setFilter]               = useState<FilterMode>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [search, setSearch]               = useState('')

  // Obsługa ?threadId= — otwiera konkretny wątek po nawigacji z wyceny/projektu
  const { threadId: searchThreadId } = useSearch({ from: '/_auth/chat' as any }) as { threadId?: string }
  useEffect(() => {
    if (searchThreadId && !activeId) setActiveId(searchThreadId)
  }, [searchThreadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: allThreads, isLoading } = useQuery({
    queryKey:        ['inbox-threads', companyId],
    queryFn:         () => threadsApi.listInboxThreads(companyId),
    staleTime:       20_000,
    refetchInterval: 30_000,
  })

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of allThreads ?? []) {
      if (t.project_id && t.project_name) map.set(t.project_id, t.project_name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [allThreads])

  const threads = useMemo<InboxThread[]>(() => {
    let list = allThreads ?? []
    if (filter === 'unread') list = list.filter(t => t.unread_count_operator > 0)
    if (projectFilter !== 'all') list = list.filter(t => t.project_id === projectFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t =>
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.project_name ?? '').toLowerCase().includes(q) ||
        (t.last_message_preview ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [allThreads, filter, projectFilter, search])

  const activeThread = useMemo(
    () => threads.find(t => t.id === activeId) ?? null,
    [threads, activeId],
  )

  const totalUnread = useMemo(
    () => (allThreads ?? []).reduce((s, t) => s + t.unread_count_operator, 0),
    [allThreads],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="shell-content" style={{ paddingBottom: 0, flex: 'none' }}>
        <PageHeader
          title="Chat"
          subtitle="Wiadomości projektowe — pisz do klientów przez portal lub dodawaj notatki wewnętrzne"
        />
      </div>

      <div className="chat-layout" style={{ flex: 1, margin: '0 28px 28px' }}>

        <div className="chat-sidebar">
          <div className="chat-sidebar__header">
            <span className="chat-sidebar__title">
              Skrzynka
              {totalUnread > 0 && (
                <span className="chat-sidebar__badge">{totalUnread}</span>
              )}
            </span>
          </div>

          <div className="chat-sidebar__search">
            <Search size={13} className="chat-sidebar__search-icon" />
            <input
              className="chat-sidebar__search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj…"
            />
          </div>

          <div className="chat-sidebar__filters">
            <button
              className={`chat-filter-btn${filter === 'all' ? ' chat-filter-btn--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Wszystkie
            </button>
            <button
              className={`chat-filter-btn${filter === 'unread' ? ' chat-filter-btn--active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Nieprzeczytane
              {totalUnread > 0 && ` (${totalUnread})`}
            </button>
          </div>

          {projects.length > 1 && (
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--color-border)' }}>
              <select
                className="chat-project-select"
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
              >
                <option value="all">Wszystkie projekty</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Spinner /></div>
          ) : (
            <ThreadList
              threads={threads}
              activeId={activeId}
              showProject={true}
              emptyLabel={
                filter === 'unread'
                  ? 'Brak nieprzeczytanych wiadomości'
                  : 'Brak wątków — tworzone są w widoku projektu → zakładka Wątki'
              }
              onSelect={(t) => setActiveId(t.id)}
            />
          )}

          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--color-border-light)',
              fontSize: 11,
              color: '#9ca3af',
              marginTop: 'auto',
            }}
          >
            💡 Wątki tworzone są w projekcie → zakładka Wątki. Do klientów — uruchom portal klienta.
          </div>
        </div>

        <div className="chat-thread">
          {activeThread ? (
            <div className="chat-thread__header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="chat-thread__name">
                  {activeThread.title ?? activeThread.type}
                </div>
                <div className="chat-thread__meta">
                  {activeThread.project_number ? `${activeThread.project_number} · ` : ''}{activeThread.project_name}
                </div>
              </div>
              <Badge
                variant={activeThread.visibility === 'client_shared' ? 'success' : 'default'}
                style={{ fontSize: 11, flexShrink: 0 }}
              >
                {activeThread.visibility === 'client_shared' ? 'Klient' : activeThread.visibility === 'internal' ? 'Wewnętrzny' : 'Akceptacje'}
              </Badge>
            </div>
          ) : null}

          <ThreadView threadId={activeId} projectId={activeThread?.project_id ?? null} visibility={activeThread?.visibility} />

          {activeThread && (
            <MessageComposer thread={activeThread as ProjectThread} projectId={activeThread.project_id} />
          )}
        </div>
      </div>
    </div>
  )
}
