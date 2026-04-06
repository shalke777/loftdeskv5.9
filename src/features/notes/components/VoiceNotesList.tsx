import { useState, useEffect, useCallback } from 'react'
import { Mic, Sparkles, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { voiceNotesApi, type VoiceNote } from '../api/voice-notes.api'
import { supabase } from '@/shared/lib/supabase'
import { useNavigate } from '@tanstack/react-router'

export function VoiceNotesList({ projectId }: { projectId?: string }) {
  const [notes, setNotes] = useState<VoiceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = projectId
        ? await voiceNotesApi.listByProject(projectId)
        : await voiceNotesApi.listByCompany()
      setNotes(data)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleExtract(note: VoiceNote) {
    if (!supabase) return
    setExtracting(note.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/.netlify/functions/voice-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note_id: note.id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
      setExpanded(note.id)
    } catch (err) {
      alert(`Ekstrakcja nie powiodła się: ${err instanceof Error ? err.message : err}`)
    } finally {
      setExtracting(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Usunąć notatkę?')) return
    await voiceNotesApi.delete(id)
    setNotes(n => n.filter(x => x.id !== id))
  }

  if (loading) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
      <span className="spinner" style={{ width: 16, height: 16, display: 'inline-block' }} /> Ładowanie…
    </div>
  )

  if (notes.length === 0) return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      <Mic size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
      <p style={{ margin: 0, fontWeight: 600 }}>Brak notatek głosowych</p>
      <p style={{ margin: '8px 0 0', fontSize: 12 }}>Użyj przycisku 🎤 w prawym dolnym rogu żeby nagrać</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {notes.map(note => (
        <div key={note.id} style={{
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--color-surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
            <Mic size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{note.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {new Date(note.created_at).toLocaleString('pl-PL')}
                {note.project_id && <span style={{ marginLeft: 6 }}>• powiązana z projektem</span>}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              background: note.status === 'processed' ? 'var(--color-success-soft, #d1fae5)'
                : note.status === 'error' ? 'var(--color-error-soft, #fee2e2)'
                : note.status === 'processing' ? 'var(--color-warning-soft, #fef9c3)'
                : 'var(--color-surface-elevated, #f3f4f6)',
              color: note.status === 'processed' ? 'var(--color-success, #059669)'
                : note.status === 'error' ? 'var(--color-error, #dc2626)'
                : note.status === 'processing' ? 'var(--color-warning, #d97706)'
                : 'var(--color-text-secondary)',
              textTransform: 'uppercase' as const,
            }}>
              {note.status === 'raw' ? 'Nowa'
                : note.status === 'processing' ? 'Przetwarza…'
                : note.status === 'processed' ? 'Gotowa'
                : 'Błąd'}
            </span>
            {note.status === 'raw' && (
              <button
                type="button"
                onClick={() => handleExtract(note)}
                disabled={extracting === note.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: extracting === note.id ? 0.6 : 1,
                }}
              >
                {extracting === note.id
                  ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Ekstrahuję…</>
                  : <><Sparkles size={12} /> Ekstraktuj</>
                }
              </button>
            )}
            {note.status === 'processed' && (
              <button
                type="button"
                onClick={() => setExpanded(e => e === note.id ? null : note.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}
              >
                {expanded === note.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDelete(note.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div style={{ padding: '0 14px 10px', fontSize: 12, color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', maxHeight: expanded === note.id ? undefined : 60, overflow: 'hidden', lineHeight: 1.5 }}>
              {note.transcript || '(brak transkryptu)'}
            </p>
          </div>

          {expanded === note.id && note.extracted_result && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-elevated, #f9fafb)' }}>
              {note.extracted_result.summary && (
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500 }}>{note.extracted_result.summary}</p>
              )}
              {note.extracted_result.decisions.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: 'var(--color-text-muted)', marginBottom: 4 }}>Ustalenia</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                    {note.extracted_result.decisions.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {note.extracted_result.action_items.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: 'var(--color-text-muted)', marginBottom: 4 }}>Do zrobienia</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                    {note.extracted_result.action_items.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
              {note.extracted_result.amounts.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: 'var(--color-text-muted)', marginBottom: 4 }}>Kwoty</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                    {note.extracted_result.amounts.map((a, i) => (
                      <li key={i}>{a.description}: {a.amount} {a.currency ?? 'PLN'}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {note.extracted_result.estimate_hint && (
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem('estimate_form_draft', JSON.stringify({
                        _source: 'voice_note',
                        _hint: note.extracted_result!.estimate_hint,
                        items: [],
                        name: note.title,
                      }))
                      navigate({ to: '/estimates' as any })
                    }}
                    style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 6, background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    📋 Stwórz wycenę z tych danych
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
