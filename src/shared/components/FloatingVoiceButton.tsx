import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { voiceNotesApi } from '@/features/notes/api/voice-notes.api'

type VoiceMode = 'idle' | 'recording' | 'processing'

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--color-surface-elevated, #222)', color: 'var(--color-text-primary, #fff)',
      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 1100, whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  )
}

export function FloatingVoiceButton() {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle')
  const [seconds, setSeconds] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (voiceMode === 'recording') {
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [voiceMode])

  async function startRecording() {
    // Check MediaRecorder support
    if (typeof MediaRecorder === 'undefined') {
      setToast('⚠ Nagrywanie nie jest wspierane w tej przeglądarce')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []

      // iOS Safari needs audio/mp4 — detect supported format
      const preferredMime =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg'
        : ''

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream)

      const usedMime = recorder.mimeType || preferredMime || 'audio/mp4'

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setVoiceMode('processing')
        const blob = new Blob(audioChunksRef.current, { type: usedMime })
        await processRecording(blob, usedMime)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setVoiceMode('recording')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setToast(`⚠ Mikrofon: ${msg}`)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  async function processRecording(blob: Blob, mimeType: string) {
    if (!supabase) {
      setToast('⚠ Brak połączenia')
      setVoiceMode('idle')
      return
    }
    try {
      const reader = new FileReader()
      const base64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(blob)
      })

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/.netlify/functions/voice-to-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audio_base64: base64, audio_type: mimeType }),
      })
      if (!res.ok) throw new Error(`Whisper HTTP ${res.status}`)
      const { transcript } = await res.json() as { transcript: string }
      if (!transcript?.trim()) throw new Error('Pusty transkrypt')

      const match = window.location.pathname.match(/\/projects\/([^/?#]+)/)
      const projectId = match ? match[1] : null

      const now = new Date()
      const title = `Notatka ${now.toLocaleDateString('pl-PL')} ${now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
      await voiceNotesApi.create({ project_id: projectId, title, transcript })

      setVoiceMode('idle')
      setToast('✓ Notatka zapisana — otwórz AI hub żeby ekstraktować')
    } catch (err) {
      setVoiceMode('idle')
      const msg = err instanceof Error ? err.message
        : (err as { message?: string })?.message
        ? (err as { message: string }).message
        : JSON.stringify(err)
      console.error('[FAB] voice error:', err)
      setToast(`⚠ Błąd: ${msg || 'Nieznany błąd'}`)
    }
  }

  function handleClick() {
    if (voiceMode === 'idle') startRecording()
    else if (voiceMode === 'recording') stopRecording()
  }

  const isRecording = voiceMode === 'recording'
  const isProcessing = voiceMode === 'processing'

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isProcessing}
        title={isRecording ? 'Zatrzymaj nagrywanie' : 'Nagraj notatkę głosową'}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: isProcessing ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          background: isRecording ? '#dc2626' : isProcessing ? 'var(--color-border, #555)' : 'var(--color-brand)',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          animation: isRecording ? 'fab-pulse 1.2s ease-in-out infinite' : 'none',
          transition: 'background 0.2s',
        }}
      >
        {isProcessing
          ? <span className="spinner" style={{ width: 22, height: 22 }} />
          : isRecording
            ? <MicOff size={22} />
            : <Mic size={22} />
        }
        {isRecording && (
          <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 700 }}>
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          </span>
        )}
      </button>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  )
}
