// =============================================================================
// ClientNotificationBell — dzwonek z liczbą nieprzeczytanych + panel
// =============================================================================

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, CheckCheck, FileText, MessageSquare, ClipboardCheck, FolderKanban } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
  useClientNotifications,
  useClientUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/client-portal/hooks/useClientNotifications'
import type { ClientNotification } from '@/features/client-portal/api/client-notifications.api'

// ── Ikona wg typu ─────────────────────────────────────────────────────────────

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'approval_requested':
    case 'approval_status_changed':
      return <ClipboardCheck size={16} />
    case 'new_message':
      return <MessageSquare size={16} />
    case 'document_shared':
      return <FileText size={16} />
    default:
      return <FolderKanban size={16} />
  }
}

// ── Mapowanie typu na tab w ClientProjectPage ─────────────────────────────────

function tabForType(type: string): string {
  switch (type) {
    case 'approval_requested':
    case 'approval_status_changed':
      return 'approvals'
    case 'new_message':
      return 'chat'
    case 'document_shared':
      return 'documents'
    default:
      return 'documents'
  }
}

// ── Formatowanie daty ─────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'teraz'
  if (mins < 60) return `${mins} min temu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} godz. temu`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} dn. temu`
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

// ── Komponent główny ──────────────────────────────────────────────────────────

export function ClientNotificationBell() {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: unread = 0 } = useClientUnreadCount()
  const { data: notifications, isLoading, isError } = useClientNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  // Zamknij panel po kliknięciu poza nim
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleNotificationClick(n: ClientNotification) {
    // Oznacz jako przeczytane
    if (!n.read_at) {
      markRead.mutate(n.id)
    }
    // Nawiguj do odpowiedniego projektu + zakładki
    const tab = tabForType(n.type)
    void navigate({
      to: '/client/project/$id',
      params: { id: n.project_id },
      search: { tab },
    })
    setOpen(false)
  }

  return (
    <div className="cn-bell-wrap" ref={panelRef}>
      {/* Przycisk dzwonka */}
      <button
        className="cn-bell"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && panelRef.current) {
            const rect = panelRef.current.getBoundingClientRect()
            const PANEL_W = Math.min(360, window.innerWidth - 32)
            const desiredLeft = rect.right - PANEL_W
            const clampedLeft = Math.max(8, Math.min(desiredLeft, window.innerWidth - PANEL_W - 8))
            setPanelPos({
              top: rect.bottom + 8,
              left: clampedLeft,
            })
          }
        }}
        title="Powiadomienia"
        aria-label={`Powiadomienia${unread > 0 ? ` (${unread} nieprzeczytanych)` : ''}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="cn-bell__badge">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panel dropdown — position:fixed escapes overflow:hidden on .client-shell grid container */}
      {open && panelPos && (
        <div
          className="cn-panel"
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, zIndex: 9999 }}
        >
          <div className="cn-panel__header">
            <span className="cn-panel__title">Powiadomienia</span>
            {unread > 0 && (
              <button
                className="cn-panel__mark-all"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                title="Oznacz wszystkie jako przeczytane"
              >
                <CheckCheck size={14} />
                <span>Oznacz wszystkie</span>
              </button>
            )}
          </div>

          <div className="cn-panel__list">
            {isLoading && (
              <div className="cn-panel__empty">Ładowanie...</div>
            )}
            {isError && (
              <div className="cn-panel__empty">Nie udało się załadować powiadomień.</div>
            )}
            {!isLoading && !isError && (!notifications || notifications.length === 0) && (
              <div className="cn-panel__empty">Brak powiadomień</div>
            )}
            {notifications?.map((n) => (
              <button
                key={n.id}
                className={`cn-item${n.read_at ? '' : ' cn-item--unread'}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="cn-item__icon">
                  <NotificationIcon type={n.type} />
                </div>
                <div className="cn-item__content">
                  <span className="cn-item__title">{n.title}</span>
                  {n.body && <span className="cn-item__body">{n.body}</span>}
                  <span className="cn-item__meta">
                    {n.project_name && <span className="cn-item__project">{n.project_name}</span>}
                    <span className="cn-item__time">{formatRelative(n.created_at)}</span>
                  </span>
                </div>
                {!n.read_at && (
                  <span className="cn-item__dot" title="Nieprzeczytane" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
