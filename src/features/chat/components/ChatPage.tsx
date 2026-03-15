// =============================================================================
// ChatPage — inbox wiadomości projektowych
// Desktop: split view (lista + wątek)
// Mobile:  single-pane (lista → wątek z przyciskiem powrotu)
// =============================================================================

import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { ArrowLeft, Search } from 'lucide-react'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { Badge } from '@/shared/ui/Badge/Badge'
import { ThreadList } from '@/features/projects/components/ThreadList'
import { ThreadView } from '@/features/projects/components/ThreadView'
import { MessageComposer } from '@/features/projects/components/MessageComposer'
import { threadsApi, type InboxThread } from '@/features/projects/api/threads.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useDeleteThread } from '@/features/projects/hooks/useDeleteThread'
import type { ProjectThread } from '@/features/portal/model/project-portal.types'

type FilterMode = 'all' | 'unread'
type MobileView = 'list' | 'thread'

const MOBILE_BP = 1024

export function ChatPage() {
  const companyId = useCompanyId()
  const [activeId, setActiveId]           = useState<string | null>(null)
  const [filter, setFilter]               = useState<FilterMode>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [search, setSearch]               = useState('')
  const [mobileView, setMobileView]       = useState<MobileView>('list')
  const [isMobile, setIsMobile]           = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BP)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BP)
    window.addEventListener('resize', handler, { passive: true })
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ?threadId= — otwiera konkretny wątek po nawigacji z projektu/wyceny
  const { threadId: searchThreadId } = useSearch({ from: '/_auth/chat' as any }) as { threadId?: string }
  useEffect(() => {
    if (searchThreadId && !activeId) {
      setActiveId(searchThreadId)
      setMobileView('thread')
    }
  }, [searchThreadId]) // eslint-disable-line react-hooks/exhaustive-deps

  function openThread(t: InboxThread) {
    setActiveId(t.id)
    if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BP) {
      setMobileView('thread')
    }
    console.info('CHAT_THREAD_OPEN', { threadId: t.id, isMobile })
  }

  function backToList() {
    setMobileView('list')
    console.info('CHAT_BACK_TO_LIST')
  }

  const deleteThread = useDeleteThread()

  function handleDeleteThread(threadId: string) {
    if (activeId === threadId) {
      setActiveId(null)
      backToList()
    }
    deleteThread.mutate(threadId)
  }

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
    () => (allThreads ?? []).find(t => t.id === activeId) ?? null,
    [allThreads, activeId],
  )

  const totalUnread = useMemo(
    () => (allThreads ?? []).reduce((s, t) => s + t.unread_count_operator, 0),
    [allThreads],
  )

  console.info('CHAT_LAYOUT_MODE', { isMobile, mobileView, selectedThreadId: activeId })

  // On mobile: conditionally show one pane at a time
  const showSidebar = !isMobile || mobileView === 'list'
  const showThread  = !isMobile || mobileView === 'thread'

  return (
    <div className="chat-root">
      <div className="chat-layout">

        {/* ── Sidebar — thread list ────────────────────────────────────── */}
        {showSidebar && (
          <div className="chat-sidebar">
            <div className="chat-sidebar__header">
              <span className="chat-sidebar__title">
                Wiadomości
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
                    ? 'Brak nieprzeczytanych'
                    : 'Brak wątków — utwórz je w projekcie → zakładka Wątki'
                }
                onSelect={openThread}
                onDelete={handleDeleteThread}
              />
            )}
          </div>
        )}

        {/* ── Thread panel ─────────────────────────────────────────────── */}
        {showThread && (
          <div className="chat-thread">
            <div className="chat-thread__header">
              {/* Back button — mobile only */}
              {isMobile && (
                <button className="chat-thread__back-btn" onClick={backToList} aria-label="Powrót do listy">
                  <ArrowLeft size={20} />
                </button>
              )}
              {activeThread ? (
                <>
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
                </>
              ) : !isMobile ? (
                <span style={{ color: '#9ca3af', fontSize: 14 }}>Wybierz wątek z listy</span>
              ) : null}
            </div>

            <ThreadView threadId={activeId} projectId={activeThread?.project_id ?? null} visibility={activeThread?.visibility} />

            {activeThread && (
              <MessageComposer thread={activeThread as ProjectThread} projectId={activeThread.project_id} />
            )}
          </div>
        )}

      </div>
    </div>
  )
}
