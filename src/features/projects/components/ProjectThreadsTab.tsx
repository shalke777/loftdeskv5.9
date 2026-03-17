// =============================================================================
// ProjectThreadsTab — zakładka wątków projektowych w ProjectDetail
// =============================================================================
// Layout: dwie kolumny (lista wątków | widok wiadomości + composer)
// Mieści się w karcie Card, nie fullscreen.

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { ThreadList } from './ThreadList'
import { ThreadView } from './ThreadView'
import { MessageComposer } from './MessageComposer'
import { useThreads, threadsKey } from '@/features/projects/hooks/useThreads'
import { threadsApi, type CreateThreadInput } from '@/features/projects/api/threads.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { listProjectPortalTokens } from '@/features/portal/api/portal-project.api'
import type { ProjectThread, ThreadType, ThreadVisibility } from '@/features/portal/model/project-portal.types'

const THREAD_TYPE_LABELS: Record<string, string> = {
  general:   'Ogólny',
  approvals: 'Akceptacje',
  documents: 'Dokumenty',
  payments:  'Płatności',
  technical: 'Techniczny',
  internal:  'Wewnętrzny',
}

const VISIBILITY_LABELS: Record<string, string> = {
  internal:      'Wewnętrzny',
  client_shared: 'Klient',
  approval:      'Akceptacje',
}

interface NewThreadFormProps {
  projectId: string
  onCreated: (thread: ProjectThread) => void
  onCancel:  () => void
}

function NewThreadForm({ projectId, onCreated, onCancel }: NewThreadFormProps) {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()
  const [title,      setTitle]      = useState('')
  const [type,       setType]       = useState<ThreadType>('general')
  const [visibility, setVisibility] = useState<ThreadVisibility>('client_shared')
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState<string | null>(null)

  const handleCreate = async () => {
    if (!title.trim()) { setErr('Podaj tytuł wątku'); return }
    setLoading(true)
    setErr(null)
    try {
      const input: CreateThreadInput = {
        project_id: projectId,
        type,
        visibility,
        title: title.trim(),
      }
      const thread = await threadsApi.createThread(input, companyId)
      await queryClient.invalidateQueries({ queryKey: threadsKey(projectId) })
      onCreated(thread)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Błąd tworzenia wątku')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        padding:      16,
        borderBottom: '1px solid var(--color-border)',
        display:      'flex',
        flexDirection: 'column',
        gap:          10,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>Nowy wątek</div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Tytuł wątku"
        className="input"
        style={{ fontSize: 13, padding: '8px 12px' }}
        onKeyDown={e => e.key === 'Enter' && void handleCreate()}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <select
          value={type}
          onChange={e => setType(e.target.value as ThreadType)}
          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13 }}
        >
          {Object.entries(THREAD_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select
          value={visibility}
          onChange={e => setVisibility(e.target.value as ThreadVisibility)}
          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13 }}
        >
          {Object.entries(VISIBILITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Anuluj</Button>
        <Button onClick={handleCreate} disabled={loading} loading={loading}>Utwórz</Button>
      </div>
    </div>
  )
}

// ─── ProjectThreadsTab ────────────────────────────────────────────────────────

interface Props {
  projectId: string
}

export function ProjectThreadsTab({ projectId }: Props) {
  const { data: threads, isLoading } = useThreads(projectId)
  const [activeId,       setActiveId]       = useState<string | null>(null)
  const [showNewForm,    setShowNewForm]     = useState(false)

  const activeThread = useMemo(
    () => threads?.find(t => t.id === activeId) ?? null,
    [threads, activeId],
  )

  // Portal status — used to warn when client_shared thread has no active portal
  const { data: portalTokens } = useQuery({
    queryKey: ['portal-tokens', projectId],
    queryFn:  () => listProjectPortalTokens(projectId),
    staleTime: 60_000,
  })
  const hasActivePortal = portalTokens?.some(
    t => t.active && !t.revoked_at && (!t.expires_at || new Date(t.expires_at) > new Date()),
  ) ?? false

  // Łączna liczba nieprzeczytanych
  const totalUnread = useMemo(
    () => (threads ?? []).reduce((s, t) => s + t.unread_count_operator, 0),
    [threads],
  )

  if (isLoading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div
      style={{
        display:       'flex',
        height:        640,
        overflow:      'hidden',
        border:        '1px solid var(--color-border)',
        borderRadius:  16,
        background:    'var(--color-surface)',
      }}
    >
      {/* ── Lewa kolumna: lista wątków ────────────────────────────────── */}
      <div
        className="chat-sidebar"
        style={{ width: 260, minWidth: 220, flexShrink: 0 }}
      >
        <div className="chat-sidebar__header">
          <span className="chat-sidebar__title">
            Wątki
            {totalUnread > 0 && (
              <span className="chat-sidebar__badge">{totalUnread}</span>
            )}
          </span>
          <Button
            variant="ghost"
            onClick={() => setShowNewForm(v => !v)}
            style={{ fontSize: 12, padding: '4px 8px', minHeight: 28 }}
          >
            + Nowy
          </Button>
        </div>

        {showNewForm && (
          <NewThreadForm
            projectId={projectId}
            onCreated={(t) => { setActiveId(t.id); setShowNewForm(false) }}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        <ThreadList
          threads={threads ?? []}
          activeId={activeId}
          emptyLabel="Brak wątków — utwórz pierwszy"
          onSelect={t => {
            setActiveId(t.id)
            setShowNewForm(false)
          }}
        />
      </div>

      {/* ── Prawa kolumna: wiadomości + composer ─────────────────────── */}
      <div
        style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          minWidth:      0,
          overflow:      'hidden',
          background:    'var(--color-bg)',
        }}
      >
        {/* Nagłówek aktywnego wątku */}
        {activeThread && (
          <div className="chat-thread__header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="chat-thread__name">
                {activeThread.title ?? THREAD_TYPE_LABELS[activeThread.type] ?? activeThread.type}
              </div>
            </div>
            <Badge variant={activeThread.visibility === 'client_shared' ? 'success' : 'default'} style={{ fontSize: 11, flexShrink: 0 }}>
              {VISIBILITY_LABELS[activeThread.visibility] ?? activeThread.visibility}
            </Badge>
          </div>
        )}

        {/* Portal status warning — client_shared thread but portal not active */}
        {activeThread?.visibility === 'client_shared' && !hasActivePortal && (
          <div style={{
            padding: '8px 16px',
            background: '#fef3c7',
            color: '#92400e',
            fontSize: 12,
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            ⚠️ Portal klienta nie jest aktywny. Uruchom portal w zak\u0142adce <strong style={{ margin: '0 2px' }}>Portal</strong>, aby klient m\u00f3g\u0142 odebra\u0107 t\u0119 wiadomo\u015b\u0107.
          </div>
        )}

        {/* Wiadomości */}
        <ThreadView threadId={activeId} projectId={projectId} visibility={activeThread?.visibility} />

        {/* Composer — tylko jeśli wątek jest wybrany */}
        {activeThread && (
          <MessageComposer thread={activeThread} projectId={projectId} />
        )}
      </div>
    </div>
  )
}
