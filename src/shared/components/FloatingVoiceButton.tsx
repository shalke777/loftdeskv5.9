import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, FileText, Sparkles, Receipt } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { voiceNotesApi } from '@/features/notes/api/voice-notes.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'

type VoiceMode = 'idle' | 'menu' | 'recording' | 'processing'
type RecordTarget = 'note' | 'estimate' | 'expense'

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--color-surface-elevated, var(--color-surface))', color: 'var(--color-text-primary, #fff)',
      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 1100, whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  )
}

export function FloatingVoiceButton({ inHeader }: { inHeader?: boolean } = {}) {
  const companyId = useCompanyId()
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle')
  const [recordTarget, setRecordTarget] = useState<RecordTarget>('note')
  const [seconds, setSeconds] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const menuRef          = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (voiceMode === 'recording') {
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [voiceMode])

  // Close menu when clicking outside
  useEffect(() => {
    if (voiceMode !== 'menu') return
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVoiceMode('idle')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [voiceMode])

  async function startRecording(target: RecordTarget) {
    // Transcription requires network — inform user gracefully
    if (!navigator.onLine) {
      setToast('⚠ Nagrywanie głosowe wymaga internetu (transkrypcja AI offline niedostępna)')
      return
    }
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
        await processRecording(blob, usedMime, target)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecordTarget(target)
      setVoiceMode('recording')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setToast(`⚠ Mikrofon: ${msg}`)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  async function processRecording(blob: Blob, mimeType: string, target: RecordTarget) {
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

      if (target === 'estimate') {
        // ── A4: Voice → Estimate draft ─────────────────────────────────────
        const res = await fetch('/.netlify/functions/voice-to-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ audio_base64: base64, audio_type: mimeType, company_id: companyId || undefined }),
        })
        if (!res.ok) throw new Error(`voice-to-estimate HTTP ${res.status}`)
        const data = await res.json() as {
          title?: string
          items?: Array<{ description: string; quantity?: number; unit?: string; unit_price?: number; vat_rate?: number }>
          extraction_confidence?: number
          transcript?: string
        }

        const items = (data.items ?? []).map((item, idx) => ({
          id: crypto.randomUUID(),
          name: item.description || `Pozycja ${idx + 1}`,
          description: '',
          unit: item.unit ?? 'm²',
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0,
          vat_rate: item.vat_rate ?? 8,
          sort_order: idx,
          catalog_item_id: null,
        }))

        const draft = {
          name: data.title ?? 'Wycena głosowa',
          notes: data.transcript ? `Transkrypt: ${data.transcript.slice(0, 300)}` : '',
          clientId: '',
          status: 'draft',
          validUntil: '',
          projectId: '',
          items,
          _source: 'voice_whisper',
        }
        sessionStorage.setItem('estimate_form_draft', JSON.stringify(draft))
        setVoiceMode('idle')
        setToast(`✓ Wycena gotowa (${items.length} pozycji) — otwieram…`)
        // Small delay so toast is visible, then navigate
        setTimeout(() => { window.location.href = '/estimates' }, 800)

      } else if (target === 'expense') {
        // ── A1: Voice → Expense(s) ─────────────────────────────────────────
        const res = await fetch('/.netlify/functions/voice-to-expense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ audio_base64: base64, audio_type: mimeType }),
        })
        if (!res.ok) throw new Error(`voice-to-expense HTTP ${res.status}`)
        const data = await res.json() as {
          expenses?: Array<{
            vendor_name?: string | null
            gross_amount?: number | null
            net_amount?: number | null
            currency?: string
            description?: string
            cost_type?: string
          }>
          transcript?: string
          extraction_confidence?: number
        }

        const expenses = data.expenses ?? []
        if (expenses.length === 0) {
          setVoiceMode('idle')
          setToast('⚠ Nie wykryto wydatków w nagraniu — spróbuj ponownie')
          return
        }

        // Detect project from URL
        const projectMatch = window.location.pathname.match(/\/projects\/([^/?#]+)/)
        const projectId = projectMatch ? projectMatch[1] : null

        // Store as sessionStorage draft — ExpensesPage reads it on load
        const draft = {
          _source: 'voice_expense',
          transcript: data.transcript ?? '',
          projectId,
          expenses,
        }
        sessionStorage.setItem('expense_voice_draft', JSON.stringify(draft))
        setVoiceMode('idle')
        setToast(`✓ ${expenses.length} wydatek${expenses.length > 1 ? 'i' : ''} — sprawdź przed zapisem`)
        setTimeout(() => { window.location.href = '/expenses' }, 800)

      } else {
        // ── Default: Voice note ─────────────────────────────────────────────
        // 1. Upload raw audio to Storage (so it's available as a file in Memory tab)
        let audioStoragePath: string | null = null
        if (companyId) {
          try {
            audioStoragePath = await voiceNotesApi.uploadAudio(blob, mimeType, companyId)
          } catch (uploadErr) {
            console.warn('[FAB] audio upload failed (non-fatal):', uploadErr)
          }
        }

        // 2. Transcribe via Whisper (Netlify function)
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
        const title = `Nagranie ${now.toLocaleDateString('pl-PL')} ${now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
        await voiceNotesApi.create({ project_id: projectId, title, transcript, audio_url: audioStoragePath })

        setVoiceMode('idle')
        setToast('✓ Nagranie zapisane w zakładce Pamięć projektu')
      }
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
    if (voiceMode === 'idle') setVoiceMode('menu')
    else if (voiceMode === 'menu') setVoiceMode('idle')
    else if (voiceMode === 'recording') stopRecording()
  }

  const isRecording  = voiceMode === 'recording'
  const isProcessing = voiceMode === 'processing'
  const isMenu       = voiceMode === 'menu'

  return (
    <div ref={menuRef} className={inHeader ? 'voice-btn-header' : 'floating-fab'}
      style={inHeader
        ? { position: 'relative', display: 'inline-flex' }
        : { position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>

      {/* ── Mode picker popup ── */}
      {isMenu && (
        <div style={{
          position: 'absolute',
          ...(inHeader ? { top: 48, right: 0 } : { bottom: 68, right: 0 }),
          background: 'var(--color-surface-elevated, var(--color-surface))',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          minWidth: 200,
          animation: 'fadeInUp 0.15s ease',
          zIndex: 2000,
        }}>
          <button
            type="button"
            onClick={() => startRecording('expense')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '14px 18px', border: 'none',
              background: 'none', cursor: 'pointer', textAlign: 'left',
              color: 'var(--color-text-primary)',
              fontSize: 14, fontWeight: 500,
              borderBottom: '1px solid var(--color-border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft, rgba(255,255,255,0.05))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Receipt size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <div>
              <div>Szybki wydatek</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted, #888)', marginTop: 1 }}>Powiedz co kupiłeś → koszt projektu</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => startRecording('note')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '14px 18px', border: 'none',
              background: 'none', cursor: 'pointer', textAlign: 'left',
              color: 'var(--color-text-primary)',
              fontSize: 14, fontWeight: 500,
              borderBottom: '1px solid var(--color-border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft, rgba(255,255,255,0.05))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <FileText size={18} style={{ color: 'var(--color-brand, #6366f1)', flexShrink: 0 }} />
            <div>
              <div>Notatka głosowa</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted, #888)', marginTop: 1 }}>Zapisz jako notatkę projektu</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => startRecording('estimate')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '14px 18px', border: 'none',
              background: 'none', cursor: 'pointer', textAlign: 'left',
              color: 'var(--color-text-primary)',
              fontSize: 14, fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft, rgba(255,255,255,0.05))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Sparkles size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <div>Szybka wycena</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted, #888)', marginTop: 1 }}>Dyktuj pozycje → draft kosztorysu</div>
            </div>
          </button>
        </div>
      )}

      {/* ── FAB button ── */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isProcessing}
        title={
          isRecording ? `Zatrzymaj nagrywanie (${recordTarget === 'estimate' ? 'wycena' : 'notatka'})`
          : isMenu ? 'Zamknij menu'
          : 'Nagraj notatkę lub wycenę głosową'
        }
        style={{
          width: inHeader ? 44 : 56, height: inHeader ? 44 : 56,
          borderRadius: '50%',
          border: isMenu ? '2px solid var(--color-brand)' : 'none',
          cursor: isProcessing ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 2,
          background: inHeader
            ? (isRecording ? '#dc2626' : 'transparent')
            : (isRecording
                ? (recordTarget === 'estimate' ? '#d97706' : recordTarget === 'expense' ? '#059669' : '#dc2626')
                : isProcessing ? 'var(--color-border, #555)'
                : isMenu ? 'var(--color-surface-elevated, #1e1e2e)'
                : 'var(--color-brand)'),
          color: inHeader ? (isRecording ? '#ef4444' : 'var(--color-text-secondary)') : '#fff',
          boxShadow: inHeader ? 'none' : '0 4px 16px rgba(0,0,0,0.25)',
          animation: isRecording ? 'fab-pulse 1.2s ease-in-out infinite' : 'none',
          transition: 'background 0.2s, color 0.2s',
        }}
      >
        {isProcessing
          ? <span className="spinner" style={{ width: inHeader ? 17 : 22, height: inHeader ? 17 : 22 }} />
          : isRecording
            ? <MicOff size={inHeader ? 17 : 22} />
            : <Mic size={inHeader ? 17 : 22} />
        }
        {isRecording && (
          <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 700 }}>
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          </span>
        )}
        {isRecording && recordTarget === 'estimate' && (
          <span style={{ fontSize: 8, lineHeight: 1, color: '#fde68a' }}>WYC</span>
        )}
        {isRecording && recordTarget === 'expense' && (
          <span style={{ fontSize: 8, lineHeight: 1, color: '#a7f3d0' }}>KSZ</span>
        )}
      </button>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
