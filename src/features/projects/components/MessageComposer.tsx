// =============================================================================
// MessageComposer — formularz wysyłki wiadomości przez operatora
// =============================================================================
//
// Zasady UX:
//   - NIE ma małego toggle visibility
//   - Aktywny wątek OKREŚLA tryb:
//       visibility = 'internal'      → tylko notatki wewnętrzne
//       visibility = 'client_shared' → wiadomości do klienta
//       visibility = 'approval'      → pytania / odpowiedzi akceptacyjne
//   - Baner informuje operatora gdzie trafi wiadomość
//   - Ctrl+Enter (lub osobny przycisk) wysyła
//   - Obsługa braku internetu: mutation.error → komunikat

import { useRef, useState, type KeyboardEvent } from 'react'
import { Send, Paperclip, X, Images, Lock, MessageCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useSendThreadMessage } from '@/features/projects/hooks/useSendThreadMessage'
import { uploadProjectAsset } from '@/shared/lib/uploadProjectAsset'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useProjectPhotos } from '@/features/documentation/hooks/useDocumentation'
import type { ProjectThread } from '@/features/portal/model/project-portal.types'

interface Props {
  thread:    ProjectThread
  projectId: string
  disabled?: boolean
}

export function MessageComposer({ thread, projectId, disabled }: Props) {
  const [body, setBody]                     = useState('')
  const [attachment, setAttachment]         = useState<{ url: string; name: string; mime: string } | null>(null)
  const [uploading,  setUploading]          = useState(false)
  const [uploadErr,  setUploadErr]          = useState<string | null>(null)
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)
  const textRef                             = useRef<HTMLTextAreaElement>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)
  const companyId                           = useCompanyId()
  const send                                = useSendThreadMessage(projectId)
  const { data: projectPhotos = [] }        = useProjectPhotos(projectId)

  const handleFileChosen = async (file: File) => {
    setUploadErr(null)
    setUploading(true)
    try {
      const result = await uploadProjectAsset(file, companyId, 'messages')
      setAttachment({ url: result.url, name: result.name, mime: result.mime })
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Błąd przesyłania załącznika')
    } finally {
      setUploading(false)
    }
  }

  const handleSend = () => {
    const trimmed = body.trim()
    if ((!trimmed && !attachment) || send.isPending) return

    send.mutate(
      {
        thread_id:       thread.id,
        project_id:      projectId,
        body:            trimmed || (attachment ? `📎 ${attachment.name}` : ''),
        visibility:      thread.visibility === 'approval' ? 'client_shared' : thread.visibility,
        attachment_url:  attachment?.url,
        attachment_name: attachment?.name,
        attachment_mime: attachment?.mime,
      },
      {
        onSuccess: () => {
          setBody('')
          setAttachment(null)
          textRef.current?.focus()
        },
      },
    )
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Banner informacyjny zależny od visibility ────────────────────────────
  const banner = (() => {
    switch (thread.visibility) {
      case 'internal':
        return {
          bg:    'rgba(96,165,250,0.12)',
          border: 'rgba(96,165,250,0.30)',
          color:  'var(--color-info)',
          icon:   <Lock size={13} />,
          text:   'Notatka wewnętrzna — widoczna tylko dla Twojego zespołu',
        }
      case 'client_shared':
        return {
          bg:    'rgba(26,92,50,0.12)',
          border: 'rgba(26,92,50,0.30)',
          color:  'var(--color-brand)',
          icon:   <MessageCircle size={13} />,
          text:   'Wiadomość do klienta — klient zobaczy ją w portalu',
        }
      case 'approval':
        return {
          bg:    'rgba(212,150,10,0.12)',
          border: 'rgba(212,150,10,0.30)',
          color:  'var(--color-accent)',
          icon:   <CheckCircle2 size={13} />,
          text:   'Wiadomość w kontekście akceptacji — widoczna dla klienta',
        }
      default:
        return null
    }
  })()

  return (
    <div className="chat-thread__composer">
      {banner && (
        <div
          className="chat-thread__composer-banner"
          style={{ background: banner.bg, border: `1px solid ${banner.border}`, color: banner.color }}
        >
          <span>{banner.icon}</span>
          <span>{banner.text}</span>
        </div>
      )}

      {/* Attachment chip — shown after successful upload */}
      {attachment && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', marginBottom: 6,
            background: 'var(--color-surface-raised, var(--color-surface))',
            border: '1px solid var(--color-border)',
            borderRadius: 6, fontSize: 12, color: 'var(--color-text-secondary)',
          }}
        >
          <Paperclip size={12} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attachment.name}
          </span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'inherit', display: 'flex' }}
            title="Usuń załącznik"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFileChosen(file)
          e.target.value = ''
        }}
      />

      <div className="chat-thread__composer-row">
        <textarea
          ref={textRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            thread.visibility === 'internal'
              ? 'Dodaj notatkę wewnętrzną…'
              : thread.visibility === 'approval'
              ? 'Dodaj wiadomość w kontekście akceptacji…'
              : 'Napisz wiadomość do klienta…'
          }
          disabled={disabled || send.isPending}
          rows={2}
          className={`chat-textarea${thread.visibility === 'internal' ? ' chat-textarea--note' : ''}`}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || send.isPending || uploading}
          className="chat-attach-btn"
          title={uploading ? 'Przesyłam…' : 'Dodaj załącznik'}
          style={{ opacity: uploading ? 0.6 : 1 }}
        >
          <Paperclip size={15} strokeWidth={2} />
        </button>
        {projectPhotos.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPhotoPicker(v => !v)}
            disabled={disabled || send.isPending}
            className={`chat-attach-btn${showPhotoPicker ? ' chat-attach-btn--active' : ''}`}
            title="Wybierz zdjęcie z projektu"
          >
            <Images size={15} strokeWidth={2} />
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={(!body.trim() && !attachment) || disabled || send.isPending}
          className={`chat-send-btn${thread.visibility === 'internal' ? ' chat-send-btn--note' : ''}`}
          title="Wyślij (Ctrl+Enter)"
          type="button"
        >
          <Send size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Mini photo picker — zdjęcia z projektu bez re-uploadu */}
      {showPhotoPicker && projectPhotos.length > 0 && (
        <div className="chat-photo-picker">
          <div className="chat-photo-picker__label">Zdjęcia projektu</div>
          <div className="chat-photo-picker__grid">
            {projectPhotos.filter(ph => ph.image_url).map(ph => (
              <button
                key={ph.id}
                type="button"
                className="chat-photo-picker__thumb"
                title={ph.title}
                onClick={() => {
                  setAttachment({ url: ph.image_url!, name: ph.title || 'Zdjęcie', mime: 'image/jpeg' })
                  setShowPhotoPicker(false)
                }}
              >
                <img src={ph.image_url!} alt={ph.title} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {uploadErr && (
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} />{uploadErr}
        </div>
      )}
      {send.isError ? (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} />Błąd wysyłki — sprawdź połączenie
        </div>
      ) : (
        <div className="chat-hint">{uploading ? 'Przesyłam załącznik…' : 'Ctrl+Enter aby wysłać'}</div>
      )}
    </div>
  )
}
