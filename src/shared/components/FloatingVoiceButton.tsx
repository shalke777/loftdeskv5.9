// =============================================================================
// FloatingVoiceButton.tsx — Globalny FAB do nagrywania głosowego notatek
// =============================================================================
// Jeśli URL zawiera /projects/:id → transkrypt zapisywany do notatek projektu.
// W przeciwnym razie → modal z transkryptem do skopiowania.
// =============================================================================

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Copy, Check } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'

type VoiceState = 'idle' | 'recording' | 'processing'

interface VoiceNoteResponse {
  transcript:    string
  duration_hint: number | null
  parser_source: string
}

export function FloatingVoiceButton() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [toast,      setToast]      = useState<string | null>(null)
  const [seconds,    setSeconds]    = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const [modalText,  setModalText]  = useState('')
  const [copied,     setCopied]     = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Timer podczas nagrywania ──────────────────────────────────────────────
  useEffect(() => {
    if (voiceState === 'recording') {
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [voiceState])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  function formatSeconds(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // ── Pobierz projectId z URL ───────────────────────────────────────────────
  function getProjectIdFromUrl(): string | null {
    const match = window.location.pathname.match(/\/projects\/([^/?#]+)/)
    return match ? match[1] : null
  }

  async function handleClick() {
    if (voiceState === 'processing') return

    if (voiceState === 'idle') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioChunksRef.current = []

        const recorder = new MediaRecorder(stream)

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          setVoiceState('processing')
          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          })
          await processAudio(audioBlob, recorder.mimeType || 'audio/webm')
        }

        mediaRecorderRef.current = recorder
        recorder.start()
        setVoiceState('recording')
      } catch {
        showToast('Brak dostępu do mikrofonu — sprawdź uprawnienia przeglądarki.')
      }
    } else if (voiceState === 'recording') {
      mediaRecorderRef.current?.stop()
      // voiceState → 'processing' w recorder.onstop
    }
  }

  async function processAudio(audioBlob: Blob, mimeType: string) {
    try {
      // 1. Konwertuj do base64
      const reader = new FileReader()
      const base64: string = await new Promise((res, rej) => {
        reader.onload  = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(audioBlob)
      })

      // 2. Pobierz token Supabase
      let token = ''
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token ?? ''
      }

      // 3. Wywołaj voice-to-note
      const res = await fetch('/.netlify/functions/voice-to-note', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ audio_base64: base64, audio_type: mimeType }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json() as VoiceNoteResponse
      const transcript = data.transcript?.trim() ?? ''
      if (!transcript) {
        showToast('Brak transkryptu — sprawdź jakość nagrania.')
        return
      }

      // 4. Sprawdź czy jesteśmy w projekcie
      const projectId = getProjectIdFromUrl()

      if (projectId && supabase) {
        // ── Zapisz do notatek projektu ────────────────────────────────────
        const { data: projectData } = await supabase
          .from('projects')
          .select('notes')
          .eq('id', projectId)
          .single()

        const existing  = projectData?.notes ?? ''
        const timestamp = new Date().toLocaleString('pl-PL')
        const newEntry  = `[${timestamp}]\n${transcript}`
        const newNotes  = existing
          ? `${existing}\n\n---\n\n${newEntry}`
          : newEntry

        await supabase
          .from('projects')
          .update({ notes: newNotes })
          .eq('id', projectId)

        // Emituj event — ProjectNotes.tsx odświeży się
        window.dispatchEvent(
          new CustomEvent('project-notes-updated', { detail: { projectId } })
        )

        showToast('✓ Notatka dodana do projektu')
      } else {
        // ── Pokaż modal z transkryptem do skopiowania ─────────────────────
        setModalText(transcript)
        setCopied(false)
        setShowModal(true)
      }
    } catch (err) {
      console.error('[FAB] processAudio error:', err)
      showToast('Nie udało się przetworzyć nagrania — spróbuj ponownie.')
    } finally {
      setVoiceState('idle')
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(modalText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback — textarea select
    }
  }

  return (
    <>
      {/* ── FAB button ────────────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 80, right: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          onClick={handleClick}
          disabled={voiceState === 'processing'}
          title={
            voiceState === 'idle'       ? 'Nagraj notatkę'
            : voiceState === 'recording' ? 'Zatrzymaj nagrywanie'
            : 'Przetwarzam nagranie…'
          }
          style={{
            width:          56,
            height:         56,
            borderRadius:   '50%',
            border:         'none',
            cursor:         voiceState === 'processing' ? 'not-allowed' : 'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            background:     voiceState === 'recording'  ? '#dc2626'
                          : voiceState === 'processing' ? 'var(--color-text-muted, #999)'
                          : 'var(--color-brand)',
            color:          '#fff',
            boxShadow:      '0 4px 16px rgba(0,0,0,0.24)',
            transition:     'background 0.2s',
            animation:      voiceState === 'recording' ? 'fab-pulse 1.2s ease-in-out infinite' : undefined,
            flexShrink:     0,
          }}
          aria-label={
            voiceState === 'idle'       ? 'Nagraj notatkę'
            : voiceState === 'recording' ? 'Zatrzymaj nagrywanie'
            : 'Przetwarzam nagranie'
          }
        >
          {voiceState === 'processing' ? (
            <span
              className="spinner"
              style={{ width: 22, height: 22, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
            />
          ) : voiceState === 'recording' ? (
            <MicOff size={22} />
          ) : (
            <Mic size={22} />
          )}
        </button>

        {/* Licznik czasu podczas nagrywania */}
        {voiceState === 'recording' && (
          <span style={{
            fontSize:    11,
            fontWeight:  600,
            color:       '#dc2626',
            letterSpacing: 1,
            background:  'var(--color-card, #fff)',
            borderRadius: 4,
            padding:     '1px 5px',
            boxShadow:   '0 1px 4px rgba(0,0,0,0.15)',
          }}>
            {formatSeconds(seconds)}
          </span>
        )}
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position:     'fixed',
            bottom:       148,
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:       1001,
            background:   'var(--color-card)',
            border:       '1px solid var(--color-border)',
            borderRadius: 8,
            padding:      '8px 18px',
            fontSize:     13,
            fontWeight:   500,
            boxShadow:    'var(--shadow-lg)',
            whiteSpace:   'nowrap',
            color:        'var(--color-text)',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}

      {/* ── Modal: transkrypt do skopiowania (gdy nie jesteśmy w projekcie) ── */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notatka głosowa"
          style={{
            position:   'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.5)',
            display:    'flex', alignItems: 'center', justifyContent: 'center',
            padding:    16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            background:   'var(--color-card, #fff)',
            borderRadius: 12,
            padding:      24,
            maxWidth:     540,
            width:        '100%',
            boxShadow:    'var(--shadow-lg)',
            display:      'flex',
            flexDirection: 'column',
            gap:          16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>
                Notatka głosowa
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-muted)', lineHeight: 1 }}
                aria-label="Zamknij"
              >×</button>
            </div>

            <pre style={{
              background:   'var(--color-bg, #f8f8f8)',
              border:       '1px solid var(--color-border)',
              borderRadius: 8,
              padding:      12,
              fontSize:     13,
              lineHeight:   1.6,
              whiteSpace:   'pre-wrap',
              wordBreak:    'break-word',
              maxHeight:    320,
              overflowY:    'auto',
              margin:       0,
              color:        'var(--color-text)',
            }}>
              {modalText}
            </pre>

            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Otwórz projekt, żeby zapisać notatkę bezpośrednio tam.
            </p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display:      'flex', alignItems: 'center', gap: 6,
                  background:   'var(--color-brand)',
                  color:        '#fff',
                  border:       'none',
                  borderRadius: 8,
                  padding:      '8px 16px',
                  fontSize:     14,
                  fontWeight:   500,
                  cursor:       'pointer',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Skopiowano!' : 'Kopiuj'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background:   'var(--color-bg, #f5f5f5)',
                  color:        'var(--color-text)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding:      '8px 16px',
                  fontSize:     14,
                  cursor:       'pointer',
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

