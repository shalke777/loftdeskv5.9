// =============================================================================
// ChatPage — inbox wiadomości projektowych
// Desktop: split view (lista + wątek)
// Mobile:  single-pane (lista → wątek z przyciskiem powrotu)
// =============================================================================

import { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { ArrowLeft, Search } from 'lucide-react'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { ThreadList } from '@/features/projects/components/ThreadList'
import { ThreadView } from '@/features/projects/components/ThreadView'
import { MessageComposer } from '@/features/projects/components/MessageComposer'
import { threadsApi, type InboxThread, type CreateThreadInput } from '@/features/projects/api/threads.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useDeleteThread } from '@/features/projects/hooks/useDeleteThread'
import { useProjects } from '@/features/projects/hooks/useProjects'
import type { ProjectThread, ThreadType, ThreadVisibility } from '@/features/portal/model/project-portal.types'

const CHAT_THREAD_TYPE_LABELS: Record<string, string> = {
  general:   'Ogólny',
  approvals: 'Akceptacje',
  documents: 'Dokumenty',
  payments:  'Płatności',
  technical: 'Techniczny',
  internal:  'Wewnętrzny',
}

const CHAT_VISIBILITY_LABELS: Record<string, string> = {
  internal:      'Wewnętrzny',
  client_shared: 'Klient',
  approval:      'Akceptacje',
}

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

  const queryClient = useQueryClient()
  const { data: allProjects } = useProjects()
  const [newThreadOpen, setNewThreadOpen]   = useState(false)
  const [newProjectId, setNewProjectId]     = useState('')
  const [newType, setNewType]               = useState<ThreadType>('general')
  const [newVisibility, setNewVisibility]   = useState<ThreadVisibility>('client_shared')
  const [newTitle, setNewTitle]             = useState('')
  const [newLoading, setNewLoading]         = useState(false)
  const [newErr, setNewErr]                 = useState<string | null>(null)

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

  async function handleCreateThread() {
    if (!newProjectId) { setNewErr('Wybierz projekt'); return }
    if (!newTitle.trim()) { setNewErr('Podaj tytuł wątku'); return }
    setNewLoading(true)
    setNewErr(null)
    console.info('CHAT_NEW_THREAD_SUBMIT', { projectId: newProjectId, type: newType, visibility: newVisibility })
    try {
      const input: CreateThreadInput = { project_id: newProjectId, type: newType, visibility: newVisibility, title: newTitle.trim() }
      const thread = await threadsApi.createThread(input, companyId)
      await queryClient.invalidateQueries({ queryKey: ['inbox-threads', companyId] })
      setActiveId(thread.id)
      setNewThreadOpen(false)
      setNewTitle(''); setNewProjectId(''); setNewType('general'); setNewVisibility('client_shared')
      console.info('CHAT_NEW_THREAD_SUCCESS', { threadId: thread.id })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Błąd tworzenia wątku'
      setNewErr(msg)
      console.info('CHAT_NEW_THREAD_ERROR', { error: msg })
    } finally {
      setNewLoading(false)
    }
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
              <Button
                variant="ghost"
                onClick={() => { setNewThreadOpen(true); console.info('CHAT_NEW_THREAD_OPEN') }}
                style={{ fontSize: 12, padding: '4px 8px', minHeight: 28, flexShrink: 0 }}
              >
                + Nowy
              </Button>
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
                    : 'Brak wątków — kliknij + Nowy, aby utworzyć'
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

      {/* ── New Thread Modal ───────────────────────────────────────────── */}
      {newThreadOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setNewThreadOpen(false) }}
        >
          <div style={{ width: 340, background: 'var(--color-surface)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Nowy wątek</div>

            <select
              value={newProjectId}
              onChange={e => setNewProjectId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-bg)' }}
            >
              <option value="">— Wybierz projekt —</option>
              {(allProjects ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Tytuł wątku"
              className="input"
              style={{ fontSize: 13, padding: '8px 12px' }}
              onKeyDown={e => e.key === 'Enter' && void handleCreateThread()}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as ThreadType)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-bg)' }}
              >
                {Object.entries(CHAT_THREAD_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                value={newVisibility}
                onChange={e => setNewVisibility(e.target.value as ThreadVisibility)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-bg)' }}
              >
                {Object.entries(CHAT_VISIBILITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {newErr && <div style={{ fontSize: 12, color: 'var(--color-error, #ef4444)' }}>{newErr}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setNewThreadOpen(false)} disabled={newLoading}>Anuluj</Button>
              <Button onClick={() => void handleCreateThread()} disabled={newLoading} loading={newLoading}>Utwórz</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
