// =============================================================================
// AiIntakeSection — initiates AI room analysis from within ProjectDetail
// =============================================================================
// - Selects room_type (bathroom / wc)
// - Picks 1+ photos → encodes to base64
// - Optionally adds text_description + notes
// - POSTs to /.netlify/functions/analyze-room-photo
// - On success: calls onRunCreated(runId)
// =============================================================================

import { useRef, useState } from 'react'
import { netlifyFn } from '@/shared/lib/functions'
import { supabase } from '@/shared/lib/supabase'
import { uploadAiInput, type AiInputRef } from '../lib/uploadAiInput'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'

const AI_ENGINE_ENABLED = import.meta.env.VITE_AI_ENGINE_ENABLED === 'true'

const MAX_BYTES = 8 * 1024 * 1024  // 8 MB per file
const MAX_FILES = 5                 // P0 hard limit

type RoomType = 'bathroom' | 'wc'

interface Props {
  projectId:    string
  companyId:    string
  onRunCreated: (runId: string) => void
  planEnabled?: boolean
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => { const r = reader.result as string; resolve(r.split(',')[1] ?? r) }
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

export function AiIntakeSection({ projectId, companyId, onRunCreated, planEnabled = true }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [roomType,    setRoomType]    = useState<RoomType>('bathroom')
  const [description, setDescription] = useState('')
  const [notes,       setNotes]       = useState('')
  const [files,       setFiles]       = useState<File[]>([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  if (!AI_ENGINE_ENABLED) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '16px 0' }}>
        Moduł analizy AI jest wyłączony na tym środowisku.
      </p>
    )
  }

  if (!planEnabled) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '16px 0' }}>
        Analiza AI nie jest dostępna w bieżącym planie. Skontaktuj się z LoftDesk, aby uaktywnić tę funkcję.
      </p>
    )
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    const valid  = picked.filter(f => f.size <= MAX_BYTES)
    if (valid.length < picked.length) setError('Pominięto pliki > 8 MB.')
    setFiles(prev => {
      const merged = [...prev, ...valid]
      if (merged.length > MAX_FILES) {
        setError(`Maksymalnie ${MAX_FILES} zdjęć.`)
        return merged.slice(0, MAX_FILES)
      }
      return merged
    })
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  async function handleSubmit() {
    if (!companyId) { setError('Nie udało się ustalić kontekstu firmy. Odśwież projekt.'); return }
    if (!files.length) { setError('Dodaj co najmniej jedno zdjęcie.'); return }
    setError(null)
    setLoading(true)
    try {
      // 1. Encode images as base64 — required by the OpenAI vision API.
      const images = await Promise.all(
        files.map(async f => ({ base64: await fileToBase64(f), type: f.type || 'image/jpeg' })),
      )

      // 2. Upload photos to ai-inputs bucket — required for Sprint 3 audit trail.
      //    Dual flow: base64 above feeds OpenAI inference; storage URLs go to ai_input_assets.
      //    The backend does NOT read from storage for inference — base64 is still the source.
      //    Upload is fatal: if any file fails, the analysis is not started.
      // companyId is guaranteed non-empty — blocked in handleSubmit guard above.
      const image_references: AiInputRef[] = await Promise.all(
        files.map(f => uploadAiInput(f, companyId, projectId)),
      )

      // 3. Call the analysis function with base64 images + optional storage references.
      const headers = await getAuthHeader()
      const res = await fetch(netlifyFn('analyze-room-photo'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          project_id:       projectId,
          room_type:        roomType,
          images,
          image_references,
          text_description: description.trim() || undefined,
          notes:            notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Błąd serwera (${res.status})`)
        return
      }
      // Reset form
      setFiles([])
      setDescription('')
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
      onRunCreated(json.run_id as string)
    } catch {
      setError('Nie udało się połączyć z serwerem.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Room type selector */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Rodzaj pomieszczenia</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['bathroom', 'wc'] as RoomType[]).map(rt => (
            <button
              key={rt}
              type="button"
              onClick={() => setRoomType(rt)}
              style={{
                padding:     '6px 16px',
                borderRadius: 6,
                border:       `1px solid ${roomType === rt ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background:   roomType === rt ? 'var(--color-brand)' : 'transparent',
                color:        roomType === rt ? '#fff' : 'var(--color-text)',
                cursor:       'pointer',
                fontSize:     13,
                fontWeight:   roomType === rt ? 600 : 400,
              }}
            >
              {rt === 'bathroom' ? 'Łazienka' : 'WC'}
            </button>
          ))}
        </div>
      </div>

      {/* Photo picker */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          Zdjęcia pomieszczenia <span style={{ color: 'var(--color-danger)' }}>*</span>
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFiles}
          style={{ fontSize: 13 }}
        />
        {files.length > 0 && (
          <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
            {files.map(f => (
              <li key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <span>{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 12, padding: '0 2px' }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Description */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
          Opis (opcjonalnie)
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="np. łazienka do generalnego remontu, kafelki do zerwania..."
          style={{
            width: '100%', fontSize: 13, padding: '6px 10px',
            borderRadius: 6, border: '1px solid var(--color-border)',
            resize: 'vertical', background: 'var(--color-surface)',
            color: 'var(--color-text)', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
          Notatki (opcjonalnie)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="np. klient ma własne płytki, nie wymienia armatury..."
          style={{
            width: '100%', fontSize: 13, padding: '6px 10px',
            borderRadius: 6, border: '1px solid var(--color-border)',
            resize: 'vertical', background: 'var(--color-surface)',
            color: 'var(--color-text)', boxSizing: 'border-box',
          }}
        />
      </div>

      {error && (
        <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading || !files.length || !companyId}
      >
        {loading
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Spinner /> Analizuję...</span>
          : 'Uruchom analizę AI'}
      </Button>
    </div>
  )
}
