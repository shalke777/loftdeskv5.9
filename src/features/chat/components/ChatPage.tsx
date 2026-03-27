// =============================================================================
// ChatPage — centralny inbox komunikacji z klientami i teamem
// =============================================================================
//
// Chat to główne miejsce startu i prowadzenia rozmów.
// Projekt = kontekst / powiązanie / filtr, nie wymagany punkt wejścia.
//
// Funkcje:
//   - Nowa rozmowa (modal z wyborem projektu, tytułu, trybu)
//   - Inbox z filtrowaniem: wszystkie / nieprzeczytane / klient / wewnętrzny
//   - Filtr projektu jako chipsy
//   - Automatyczne otwarcie wątku z ?threadId=
//
// LEGACY:
//   - conversations / conversation_messages — stary model, NIE wyświetlany tutaj
//   - portal_messages — stary model, NIE wyświetlany tutaj

import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { Search, Plus, X, MessageSquarePlus, ChevronLeft } from 'lucide-react'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { ThreadList } from '@/features/projects/components/ThreadList'
import { ThreadView } from '@/features/projects/components/ThreadView'
import { MessageComposer } from '@/features/projects/components/MessageComposer'
import { threadsApi, type InboxThread, type CreateThreadInput } from '@/features/projects/api/threads.api'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import type { ProjectThread } from '@/features/portal/model/project-portal.types'

// ─── Typy ────────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'unread' | 'client' | 'internal'

// ─── NewThreadModal ───────────────────────────────────────────────────────────

interface NewThreadModalProps {
  onClose: () => void
  onCreated: (threadId: string, projectId: string) => void
}

function NewThreadModal({ onClose, onCreated }: NewThreadModalProps) {
  const companyId   = useCompanyId()
  const toast       = useToast()
  const qc          = useQueryClient()
  const titleRef    = useRef<HTMLInputElement>(null)

  const [title,      setTitle]      = useState('')
  const [projectId,  setProjectId]  = useState('')
  const [visibility, setVisibility] = useState<'client_shared' | 'internal'>('client_shared')

  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const activeProjects = projects.filter(p => p.status !== 'cancelled')

  const create = useMutation({
    mutationFn: (input: CreateThreadInput) => threadsApi.createThread(input, companyId),
    onSuccess: (thread) => {
      qc.invalidateQueries({ queryKey: ['inbox-threads', companyId] })
      toast.success('Wątek utworzony')
      onCreated(thread.id, thread.project_id)
    },
    onError: () => toast.error('Nie udało się utworzyć wątku', 'Spróbuj ponownie.'),
  })

  useEffect(() => { titleRef.current?.focus() }, [])

  const handleSubmit = () => {
    const t = title.trim()
    if (!t || !projectId) return
    create.mutate({ project_id: projectId, type: 'general', visibility, title: t })
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  return (
    <div className="chat-modal-overlay" onClick={onClose} onKeyDown={handleKey}>
      <div className="chat-modal" onClick={e => e.stopPropagation()}>
        <div className="chat-modal__header">
          <div className="chat-modal__icon">
            <MessageSquarePlus size={20} />
          </div>
          <div>
            <div className="chat-modal__title">Nowa rozmowa</div>
            <div className="chat-modal__subtitle">Wybierz projekt i określ tryb wątku</div>
          </div>
          <button className="chat-modal__close" onClick={onClose} aria-label="Zamknij">
            <X size={16} />
          </button>
        </div>

        <div className="chat-modal__body">
          <label className="chat-modal__label">
            Tytuł rozmowy
            <input
              ref={titleRef}
              className="chat-modal__input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="np. Pytania dot. harmonogramu prac"
              maxLength={120}
            />
          </label>

          <label className="chat-modal__label">
            Projekt
            <select
              className="chat-modal__select"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              disabled={projectsLoading}
            >
              <option value="">— wybierz projekt —</option>
              {activeProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.number ? `${p.number} · ` : ''}{p.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="chat-modal__fieldset">
            <legend className="chat-modal__legend">Tryb widoczności</legend>
            <div className="chat-modal__visibility-row">
              <label className={`chat-modal__vis-option${visibility === 'client_shared' ? ' chat-modal__vis-option--active' : ''}`}>
                <input
                  type="radio"
                  name="visibility"
                  value="client_shared"
                  checked={visibility === 'client_shared'}
                  onChange={() => setVisibility('client_shared')}
                />
                <span className="chat-modal__vis-icon">💬</span>
                <span>
                  <strong>Klient</strong>
                  <small>Klient widzi wątek w swoim portalu</small>
                </span>
              </label>
              <label className={`chat-modal__vis-option${visibility === 'internal' ? ' chat-modal__vis-option--active' : ''}`}>
                <input
                  type="radio"
                  name="visibility"
                  value="internal"
                  checked={visibility === 'internal'}
                  onChange={() => setVisibility('internal')}
                />
                <span className="chat-modal__vis-icon">🔒</span>
                <span>
                  <strong>Wewnętrzny</strong>
                  <small>Tylko Twój zespół — klient nie widzi</small>
                </span>
              </label>
            </div>
          </fieldset>
        </div>

        <div className="chat-modal__footer">
          <button className="chat-modal__cancel" onClick={onClose}>Anuluj</button>
          <button
            className="chat-modal__submit"
            onClick={handleSubmit}
            disabled={!title.trim() || !projectId || create.isPending}
          >
            {create.isPending ? <Spinner /> : 'Utwórz wątek'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ChatPage ─────────────────────────────────────────────────────────────────

export function ChatPage() {
  const companyId   = useCompanyId()
  const [activeId, setActiveId]           = useState<string | null>(null)
  const [filter, setFilter]               = useState<FilterMode>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [search, setSearch]               = useState('')
  const [showNewThread, setShowNewThread] = useState(false)
  const [mobileView, setMobileView]       = useState<'list' | 'thread'>('list')

  // Obsługa ?threadId= — otwiera konkretny wątek po nawigacji z wyceny/projektu
  const { threadId: searchThreadId } = useSearch({ from: '/_auth/chat' as any }) as { threadId?: string }
  useEffect(() => {
    if (searchThreadId && !activeId) {
      setActiveId(searchThreadId)
      setMobileView('thread')
    }
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
    if (filter === 'unread')   list = list.filter(t => t.unread_count_operator > 0)
    if (filter === 'client')   list = list.filter(t => t.visibility === 'client_shared')
    if (filter === 'internal') list = list.filter(t => t.visibility === 'internal')
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

  return (
    <>
      <div className="chat-root">
        <div className={`chat-layout chat-layout--mobile-${mobileView}`}>

          {/* ── Lewa kolumna: lista wątków ────────────────────────── */}
          <div className="chat-sidebar">
            <div className="chat-sidebar__header">
              <div className="chat-sidebar__header-row">
                <div>
                  <div className="chat-sidebar__title">
                    Chat
                    {totalUnread > 0 && (
                      <span className="chat-sidebar__badge">{totalUnread}</span>
                    )}
                  </div>
                  <div className="chat-sidebar__subtitle">Wiadomości z klientami i teamem</div>
                </div>
                <button
                  className="chat-new-btn"
                  onClick={() => setShowNewThread(true)}
                  title="Nowa rozmowa"
                >
                  <Plus size={16} />
                  <span>Nowa</span>
                </button>
              </div>
            </div>

            <div className="chat-sidebar__search">
              <Search size={13} className="chat-sidebar__search-icon" />
              <input
                className="chat-sidebar__search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj rozmów…"
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
                {totalUnread > 0 && (
                  <span style={{ marginLeft: 4, fontWeight: 700 }}>({totalUnread})</span>
                )}
              </button>
              <button
                className={`chat-filter-btn${filter === 'client' ? ' chat-filter-btn--active chat-filter-btn--client' : ''}`}
                onClick={() => setFilter('client')}
              >
                Klient
              </button>
              <button
                className={`chat-filter-btn${filter === 'internal' ? ' chat-filter-btn--active chat-filter-btn--internal' : ''}`}
                onClick={() => setFilter('internal')}
              >
                Wewnętrzne
              </button>
            </div>

            {projects.length > 1 && (
              <div className="chat-sidebar__project-chips">
                <button
                  className={`chat-project-chip${projectFilter === 'all' ? ' chat-project-chip--active' : ''}`}
                  onClick={() => setProjectFilter('all')}
                >
                  Wszystkie projekty
                </button>
                {projects.map(p => (
                  <button
                    key={p.id}
                    className={`chat-project-chip${projectFilter === p.id ? ' chat-project-chip--active' : ''}`}
                    onClick={() => setProjectFilter(projectFilter === p.id ? 'all' : p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
            ) : (
              <ThreadList
                threads={threads}
                activeId={activeId}
                showProject={true}
                emptyLabel={
                  filter === 'unread'
                    ? 'Brak nieprzeczytanych wiadomości'
                    : filter === 'client'
                    ? 'Brak wątków z klientami'
                    : filter === 'internal'
                    ? 'Brak wątków wewnętrznych'
                    : 'Brak wątków'
                }
                onSelect={(t) => { setActiveId(t.id); setMobileView('thread') }}
                onNewThread={() => setShowNewThread(true)}
              />
            )}
          </div>

          {/* ── Prawa kolumna: panel rozmowy ─────────────────────── */}
          <div className="chat-thread">
            {/* Mobile: ← back to inbox */}
            <button
              className="chat-thread__mobile-back"
              onClick={() => setMobileView('list')}
            >
              <ChevronLeft size={15} />
              Rozmowy
            </button>
            {activeThread ? (
              <div className="chat-thread__header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="chat-thread__name">
                    {activeThread.client_name ?? activeThread.project_name ?? activeThread.title ?? activeThread.type}
                  </div>
                  {(activeThread.client_name || activeThread.project_name) && activeThread.title && (
                    <div className="chat-thread__meta">
                      {activeThread.title}
                    </div>
                  )}
                </div>
                <span className={[
                  'chat-thread__type-chip',
                  activeThread.visibility === 'client_shared' ? 'chat-thread__type-chip--client'
                    : activeThread.visibility === 'internal'     ? 'chat-thread__type-chip--internal'
                    : 'chat-thread__type-chip--approval',
                ].join(' ')}>
                  {activeThread.visibility === 'client_shared' ? 'Klient'
                    : activeThread.visibility === 'internal' ? 'Wewnętrzny'
                    : 'Akceptacje'}
                </span>
              </div>
            ) : null}

            <ThreadView
              threadId={activeId}
              projectId={activeThread?.project_id ?? null}
              visibility={activeThread?.visibility}
              onNewThread={() => setShowNewThread(true)}
            />

            {activeThread && (
              <MessageComposer thread={activeThread as ProjectThread} projectId={activeThread.project_id} />
            )}
          </div>
        </div>
      </div>

      {showNewThread && (
        <NewThreadModal
          onClose={() => setShowNewThread(false)}
          onCreated={(threadId) => {
            setActiveId(threadId)
            setShowNewThread(false)
            setMobileView('thread')
          }}
        />
      )}
    </>
  )
}
