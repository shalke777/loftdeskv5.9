import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Plus, Paperclip, Send, StickyNote, User, FolderKanban, Search } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
  useMarkRead,
  useCreateConversation,
} from '@/features/chat/hooks/useConversations'
import { conversationsApi, type Conversation } from '@/features/chat/api/conversations.api'
import { useToast } from '@/shared/hooks/useToast'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'przed chwilą'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} godz.`
  const d = Math.floor(h / 24)
  return `${d} dni`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

// ── ConversationListItem ──────────────────────────────────────────────────────

function ConversationListItem({
  conv,
  active,
  onClick,
}: {
  conv: Conversation
  active: boolean
  onClick: () => void
}) {
  const isFromClient = conv.last_message_sender === 'client'
  return (
    <button
      onClick={onClick}
      className={`chat-conv-item${active ? ' chat-conv-item--active' : ''}`}
    >
      <div className="chat-conv-item__avatar">
        {conv.client_name ? conv.client_name[0].toUpperCase() : '?'}
      </div>
      <div className="chat-conv-item__body">
        <div className="chat-conv-item__header">
          <span className="chat-conv-item__name">
            {conv.client_name ?? conv.subject ?? 'Rozmowa'}
          </span>
          <span className="chat-conv-item__time">
            {formatRelative(conv.last_message_at)}
          </span>
        </div>
        {conv.project_name && (
          <div className="chat-conv-item__project">
            <FolderKanban size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
            {conv.project_name}
          </div>
        )}
        <div className="chat-conv-item__preview">
          {isFromClient && <span className="chat-conv-item__from-client">Klient: </span>}
          {conv.last_message_preview ?? 'Brak wiadomości'}
        </div>
      </div>
      {(conv.unread_count ?? 0) > 0 && (
        <span className="chat-conv-item__badge">
          {conv.unread_count > 99 ? '99+' : conv.unread_count}
        </span>
      )}
    </button>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: { sender: string; content: string; created_at: string; attachment_url: string | null; attachment_name: string | null } }) {
  const isOperator = msg.sender === 'operator'
  const isNote = msg.sender === 'note'
  return (
    <div className={`chat-bubble-wrap${isOperator ? ' chat-bubble-wrap--right' : ''}${isNote ? ' chat-bubble-wrap--note' : ''}`}>
      <div className={`chat-bubble${isOperator ? ' chat-bubble--operator' : ''}${isNote ? ' chat-bubble--note' : ''}`}>
        {isNote && <span className="chat-bubble__note-label"><StickyNote size={11} /> Notatka wewnętrzna</span>}
        <p className="chat-bubble__text">{msg.content}</p>
        {msg.attachment_url && (
          <a
            href={msg.attachment_url}
            target="_blank"
            rel="noreferrer"
            className="chat-bubble__attachment"
          >
            <Paperclip size={12} />
            {msg.attachment_name ?? 'Załącznik'}
          </a>
        )}
        <span className="chat-bubble__time">{formatTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

// ── NewConversationModal ──────────────────────────────────────────────────────

function NewConversationModal({
  companyId,
  onClose,
}: {
  companyId: string
  onClose: () => void
}) {
  const [subject, setSubject] = useState('')
  const create = useCreateConversation(companyId)

  const handleCreate = async () => {
    if (!subject.trim()) return
    await create.mutateAsync({ subject: subject.trim() })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal__header">
          <h2 className="modal__title">Nowa rozmowa</h2>
        </div>
        <div className="modal__body">
          <label className="field__label">Temat rozmowy</label>
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="np. Pytanie o projekt łazienki"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
          />
        </div>
        <div className="modal__footer">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button
            variant="primary"
            disabled={!subject.trim() || create.isPending}
            loading={create.isPending}
            onClick={handleCreate}
          >
            Utwórz
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChatPage() {
  const { user } = useAuth()
  const companyId = user?.companyId ?? ''
  const toast = useToast()

  const { data: conversations = [], isLoading } = useConversations(companyId)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [search, setSearch] = useState('')
  const [draftText, setDraftText] = useState('')
  const [noteMode, setNoteMode] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: messages = [], isLoading: msgsLoading } = useConversationMessages(activeId)
  const send = useSendMessage(companyId, activeId)
  const markRead = useMarkRead(companyId)

  const activeConv = conversations.find((c) => c.id === activeId) ?? null

  // Auto-select first conversation
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id)
    }
  }, [conversations, activeId])

  // Mark as read when opening a conversation
  useEffect(() => {
    if (activeId && (activeConv?.unread_count ?? 0) > 0) {
      markRead.mutate(activeId)
    }
  }, [activeId])

  // Scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const filteredConvs = conversations
    .filter((c) => {
      if (filter === 'unread' && (c.unread_count ?? 0) === 0) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.client_name?.toLowerCase().includes(q) ||
          c.project_name?.toLowerCase().includes(q) ||
          c.subject?.toLowerCase().includes(q) ||
          c.last_message_preview?.toLowerCase().includes(q)
        )
      }
      return true
    })

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0)

  const handleSend = async () => {
    if (!draftText.trim() || !activeId) return
    setDraftText('')
    await send.mutateAsync({ content: draftText.trim(), sender: noteMode ? 'note' : 'operator' })
  }

  const handleFileUpload = async (file: File) => {
    if (!activeId) return
    setUploading(true)
    try {
      const { url, name } = await conversationsApi.uploadAttachment(file, companyId)
      await send.mutateAsync({ content: `Załączono plik: ${name}`, sender: 'operator', attachmentUrl: url, attachmentName: name })
    } catch (err: any) {
      toast.error('Błąd uploadu', err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="chat-layout">
      {/* ── Left panel: conversation list ─── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar__header">
          <span className="chat-sidebar__title">
            Rozmowy{totalUnread > 0 && <span className="chat-sidebar__badge">{totalUnread}</span>}
          </span>
          <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>
            Nowa
          </Button>
        </div>

        <div className="chat-sidebar__search">
          <Search size={14} className="chat-sidebar__search-icon" />
          <input
            className="chat-sidebar__search-input"
            placeholder="Szukaj rozmów..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-sidebar__filters">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chat-filter-btn${filter === f ? ' chat-filter-btn--active' : ''}`}
            >
              {f === 'all' ? 'Wszystkie' : 'Nieprzeczytane'}
              {f === 'unread' && totalUnread > 0 && ` (${totalUnread})`}
            </button>
          ))}
        </div>

        <div className="chat-sidebar__list">
          {isLoading ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Spinner /></div>
          ) : filteredConvs.length === 0 ? (
            <div className="chat-sidebar__empty">
              <MessageSquare size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              <p>Brak rozmów</p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeId}
                onClick={() => setActiveId(conv.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Right panel: active thread ─── */}
      <section className="chat-thread">
        {!activeConv ? (
          <div className="chat-thread__empty">
            <MessageSquare size={48} style={{ opacity: 0.2, display: 'block', margin: '0 auto 16px' }} />
            <p>Wybierz rozmowę z listy lub utwórz nową.</p>
          </div>
        ) : (
          <>
            <div className="chat-thread__header">
              <div>
                <strong className="chat-thread__name">
                  {activeConv.client_name ?? activeConv.subject ?? 'Rozmowa'}
                </strong>
                {activeConv.project_name && (
                  <span className="chat-thread__meta">
                    <FolderKanban size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    {activeConv.project_name}
                  </span>
                )}
              </div>
            </div>

            <div className="chat-thread__messages">
              {msgsLoading ? (
                <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
              ) : messages.length === 0 ? (
                <div className="chat-thread__no-messages">
                  Brak wiadomości w tej rozmowie. Napisz pierwszą wiadomość poniżej.
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-thread__composer">
              <div className="chat-thread__composer-tools">
                <button
                  className={`chat-note-toggle${noteMode ? ' chat-note-toggle--active' : ''}`}
                  onClick={() => setNoteMode((v) => !v)}
                  title={noteMode ? 'Tryb notatki wewnętrznej (niewidoczna dla klienta)' : 'Wiadomość do klienta'}
                >
                  <StickyNote size={15} />
                  {noteMode ? 'Notatka' : 'Wiadomość'}
                </button>
                <button
                  className="chat-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Dołącz plik"
                >
                  <Paperclip size={15} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleFileUpload(f)
                    e.target.value = ''
                  }}
                />
              </div>
              <div className="chat-thread__composer-row">
                <textarea
                  className={`chat-textarea${noteMode ? ' chat-textarea--note' : ''}`}
                  placeholder={noteMode ? 'Notatka wewnętrzna (niewidoczna dla klienta)…' : 'Napisz wiadomość…'}
                  value={draftText}
                  rows={2}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                />
                <Button
                  variant="primary"
                  disabled={!draftText.trim() || send.isPending || uploading}
                  loading={send.isPending}
                  onClick={handleSend}
                  icon={<Send size={16} />}
                >
                  Wyślij
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {showNew && <NewConversationModal companyId={companyId} onClose={() => setShowNew(false)} />}
    </div>
  )
}
