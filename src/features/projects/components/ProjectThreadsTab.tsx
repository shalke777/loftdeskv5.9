// =============================================================================
// ProjectThreadsTab — zakładka wątków projektowych w ProjectDetail
// =============================================================================
// Layout: dwie kolumny (lista wątków | widok wiadomości + composer)
// Mieści się w karcie Card, nie fullscreen.

import { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { ThreadList } from './ThreadList'
import { ThreadView } from './ThreadView'
import { MessageComposer } from './MessageComposer'
import { useThreads } from '@/features/projects/hooks/useThreads'
import type { ProjectThread } from '@/features/portal/model/project-portal.types'

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

// ─── ProjectThreadsTab ────────────────────────────────────────────────────────

interface Props {
  projectId: string
}

export function ProjectThreadsTab({ projectId }: Props) {
  const { data: rawThreads, isLoading } = useThreads(projectId)

  // Defensive client-side guard: even if the server returns threads belonging
  // to another project (cache stale, wrong RLS, etc.), we never render them.
  const threads = useMemo(() => {
    const all = rawThreads ?? []
    const valid = all.filter(t => t.project_id === projectId)
    const invalid = all.filter(t => t.project_id !== projectId)
    console.info('PROJECT_THREADS_FILTER', {
      currentProjectId:         projectId,
      totalThreads:             all.length,
      visibleThreads:           valid.length,
      invalidThreadProjectIds:  invalid.map(t => t.project_id),
    })
    return valid
  }, [rawThreads, projectId])

  const [activeId, setActiveId] = useState<string | null>(null)

  // Reset active thread when project changes
  useEffect(() => {
    setActiveId(null)
  }, [projectId])

  // Reset activeId if the thread it points to is no longer in the filtered list
  // (e.g. deleted, archived, or filtered out after project change)
  useEffect(() => {
    if (activeId && !threads.some(t => t.id === activeId)) {
      console.info('PROJECT_THREADS_ACTIVE_RESET', {
        currentProjectId: projectId,
        activeId,
        visibleThreadIds: threads.map(t => t.id),
      })
      setActiveId(null)
    }
  }, [activeId, threads, projectId])

  const activeThread = useMemo(
    () => threads?.find(t => t.id === activeId) ?? null,
    [threads, activeId],
  )

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
        </div>

        <ThreadList
          threads={threads ?? []}
          activeId={activeId}
          emptyLabel="Brak wątków przypisanych do tego projektu"
          onSelect={t => setActiveId(t.id)}
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
