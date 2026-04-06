// =============================================================================
// FloatingVoiceButton.tsx — Globalny FAB do nagrywania głosowego wydatków
// =============================================================================
// Dostępny z każdego ekranu operatora. Tap → nagraj → tap → AI przetwarza →
// wydatki lądują w /expenses (status: draft, project_id: null).
// =============================================================================

import { useState, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { expensesApi } from '@/features/expenses/api/expenses.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'

type VoiceState = 'idle' | 'recording' | 'processing'

interface VoiceExpense {
  vendor_name:  string | null
  gross_amount: number | null
  net_amount:   number | null
  currency:     string
  description:  string
  cost_type:    string
}

interface VoiceResponse {
  expenses:              VoiceExpense[]
  transcript:            string
  parser_source:         string
  extraction_confidence: number
  extraction_warnings?:  string[]
}

export function FloatingVoiceButton() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [toast,      setToast]      = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const companyId        = useCompanyId()
  const queryClient      = useQueryClient()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleClick() {
    if (voiceState === 'processing') return

    if (voiceState === 'idle') {
      // ── Start recording ──────────────────────────────────────────────────
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
      // ── Stop recording ───────────────────────────────────────────────────
      mediaRecorderRef.current?.stop()
      // voiceState zmieni się na 'processing' w recorder.onstop
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

      // 3. Wywołaj voice-to-expense
      const res = await fetch('/.netlify/functions/voice-to-expense', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ audio_base64: base64, audio_type: mimeType }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json() as VoiceResponse
      const expenses = Array.isArray(data.expenses) ? data.expenses : []

      // 4. Insert każdego wydatku przez expensesApi.create()
      let addedCount = 0
      for (const exp of expenses) {
        try {
          await expensesApi.create({
            companyId,
            projectId:             null,
            status:                'new',
            parserSource:          'ai',
            extractionConfidence:  data.extraction_confidence ?? 40,
            extractionWarnings:    exp.gross_amount ? [] : ['Kwota nie rozpoznana — uzupełnij ręcznie.'],
            parsed: {
              vendor:        exp.vendor_name  ?? undefined,
              amount_gross:  exp.gross_amount ?? undefined,
              amount_net:    exp.net_amount   ?? undefined,
              description:   exp.description  || undefined,
              currency:      exp.currency     ?? 'PLN',
            },
            parseRaw: {
              cost_type:     exp.cost_type,
              transcript:    data.transcript,
              parser_source: 'voice_whisper',
            },
          })
          addedCount++
        } catch (insertErr) {
          console.warn('[FAB] Nie udało się zapisać wydatku:', insertErr)
        }
      }

      // 5. Odśwież listę kosztów
      queryClient.invalidateQueries({ queryKey: ['expenses'] })

      // 6. Toast
      if (addedCount > 0) {
        const suffix = addedCount === 1 ? 'wydatek' : addedCount < 5 ? 'wydatki' : 'wydatków'
        showToast(`✓ Dodano ${addedCount} ${suffix} — sprawdź Koszty`)
      } else {
        showToast('Brak wydatków w nagraniu')
      }
    } catch (err) {
      console.error('[FAB] processAudio error:', err)
      showToast('Nie udało się przetworzyć nagrania — spróbuj ponownie.')
    } finally {
      setVoiceState('idle')
    }
  }

  return (
    <>
      {/* Pulse animation jest zdefiniowana w globals.css jako @keyframes fab-pulse */}
      <button
        type="button"
        onClick={handleClick}
        disabled={voiceState === 'processing'}
        title={
          voiceState === 'idle'       ? 'Nagraj wydatek głosowo'
          : voiceState === 'recording' ? 'Zatrzymaj nagrywanie'
          : 'Przetwarzam nagranie…'
        }
        style={{
          position:       'fixed',
          bottom:         80,
          right:          24,
          zIndex:         1000,
          width:          56,
          height:         56,
          borderRadius:   '50%',
          border:         'none',
          cursor:         voiceState === 'processing' ? 'not-allowed' : 'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     voiceState === 'recording'  ? 'var(--color-error, #d44)'
                        : voiceState === 'processing' ? 'var(--color-text-muted, #999)'
                        : 'var(--color-brand)',
          color:          '#fff',
          boxShadow:      '0 4px 16px rgba(0,0,0,0.24)',
          transition:     'background 0.2s',
          animation:      voiceState === 'recording' ? 'fab-pulse 1.2s ease-in-out infinite' : undefined,
          flexShrink:     0,
        }}
        aria-label={
          voiceState === 'idle'       ? 'Nagraj wydatek głosowo'
          : voiceState === 'recording' ? 'Zatrzymaj nagrywanie'
          : 'Przetwarzam nagranie'
        }
      >
        {voiceState === 'processing' ? (
          <span
            className="spinner"
            style={{
              width:           22,
              height:          22,
              borderWidth:     3,
              borderColor:     'rgba(255,255,255,0.3)',
              borderTopColor:  '#fff',
            }}
          />
        ) : voiceState === 'recording' ? (
          <MicOff size={22} />
        ) : (
          <Mic size={22} />
        )}
      </button>

      {/* Toast — bottom-center, 4s */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position:    'fixed',
            bottom:      148,
            left:        '50%',
            transform:   'translateX(-50%)',
            zIndex:      1001,
            background:  'var(--color-card)',
            border:      '1px solid var(--color-border)',
            borderRadius: 8,
            padding:     '8px 18px',
            fontSize:    13,
            fontWeight:  500,
            boxShadow:   'var(--shadow-lg)',
            whiteSpace:  'nowrap',
            color:       'var(--color-text)',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
