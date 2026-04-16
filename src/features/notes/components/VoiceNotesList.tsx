import { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, Sparkles, Trash2, ChevronDown, ChevronUp, Edit2, Check, X, Download, FileText, RotateCcw, PlusCircle, FolderKanban } from 'lucide-react'
import { voiceNotesApi, type VoiceNote } from '../api/voice-notes.api'
import { supabase } from '@/shared/lib/supabase'
import { useNavigate } from '@tanstack/react-router'
import { projectExpensesApi } from '@/features/expenses/api/expenses.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useProjects } from '@/features/projects/hooks/useProjects'

function useToast() {
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const show = useCallback((text: string, type: 'error' | 'success' = 'error') => {
    setMessage({ text, type })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 4000)
  }, [])
  return { message, show }
}

function downloadAsText(title: string, transcript: string) {
  const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/gi, '').trim() || 'notatka'}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function TranscriptModal({ note, onClose, onSave }: {
  note: VoiceNote
  onClose: () => void
  onSave: (newTranscript: string) => Promise<void>
}) {
  const [text, setText] = useState(note.transcript)
  const [saving, setSaving] = useState(false)
  const isDirty = text !== note.transcript

  async function handleSave() {
    setSaving(true)
    try { await onSave(text) } finally { setSaving(false) }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <FileText size={16} style={{ color: 'var(--color-brand)' }} />
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{note.title}</span>
          <button type="button" onClick={() => downloadAsText(note.title, text)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, display: 'flex' }}>
            <Download size={16} />
          </button>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          style={{
            flex: 1, padding: '14px 16px', border: 'none', outline: 'none', resize: 'none',
            fontSize: 13, lineHeight: 1.7, background: 'transparent', color: 'var(--color-text-primary)',
            fontFamily: 'inherit', overflowY: 'auto',
          }}
        />
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {text.length.toLocaleString('pl-PL')} znaków
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
              Zamknij
            </button>
            {isDirty && (
              <button type="button" onClick={handleSave} disabled={saving} style={{ fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 6, background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Zapisuję…' : 'Zapisz i re-ekstraktuj'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InlineTitleEdit({ id, initial, onDone }: { id: string; initial: string; onDone: (v: string) => void }) {
  const [val, setVal] = useState(initial)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  async function save() {
    if (!val.trim() || val === initial) { onDone(initial); return }
    setSaving(true)
    try {
      await voiceNotesApi.updateTitle(id, val.trim())
      onDone(val.trim())
    } catch { onDone(initial) } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onDone(initial) }}
        style={{ flex: 1, fontSize: 13, fontWeight: 600, border: '1px solid var(--color-brand)', borderRadius: 4, padding: '2px 6px', outline: 'none', background: 'var(--color-surface-soft, #f5f5f5)', minWidth: 0 }}
        disabled={saving}
      />
      <button type="button" onClick={save} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-success)', padding: 2, display: 'flex' }}>
        <Check size={14} />
      </button>
      <button type="button" onClick={() => onDone(initial)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  )
}

export function VoiceNotesList({ projectId }: { projectId?: string }) {
  const [notes, setNotes] = useState<VoiceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [transcriptModal, setTranscriptModal] = useState<VoiceNote | null>(null)
  const [addingCostId, setAddingCostId] = useState<string | null>(null)
  const [costDoneId, setCostDoneId]     = useState<string | null>(null)
  const [assigningId, setAssigningId]   = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const companyId = useCompanyId()
  const { data: projects = [] } = useProjects()

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
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        let detail = `HTTP ${res.status}`
        try { detail = JSON.parse(errBody).detail || JSON.parse(errBody).error || detail } catch { /**/ }
        throw new Error(detail)
      }
      await load()
      setExpanded(note.id)
    } catch (err) {
      toast.show(`Ekstrakcja nie powiodła się: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExtracting(null)
    }
  }

  async function addToCosts(note: VoiceNote) {
    const amounts = note.extracted_result?.amounts ?? []
    if (amounts.length === 0) { toast.show('Brak kwot do dodania — najpierw wykonaj ekstrakcję', 'error'); return }
    const pid = note.project_id ?? projectId
    if (!pid) { toast.show('Notatka nie jest przypisana do projektu — przypisz ją najpierw', 'error'); return }
    if (!companyId) { toast.show('Brak identyfikatora firmy', 'error'); return }
    setAddingCostId(note.id)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await Promise.all(
        amounts.map(a =>
          projectExpensesApi.createForProject({
            company_id: companyId,
            project_id: pid,
            vendor_name: note.title,
            gross_amount: a.amount,
            net_amount: Math.round(a.amount / 1.23 * 100) / 100,
            currency: a.currency ?? 'PLN',
            notes: a.description,
            issue_date: today,
            source_type: 'manual',
            parser_source: 'ai',
          })
        )
      )
      setCostDoneId(note.id)
      toast.show(`Dodano ${amounts.length} ${amounts.length === 1 ? 'koszt' : 'koszty'} do projektu`, 'success')
      setTimeout(() => setCostDoneId(d => d === note.id ? null : d), 4000)
    } catch (err) {
      toast.show(`Błąd dodawania kosztów: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAddingCostId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Usunąć notatkę głosową?')) return
    try {
      await voiceNotesApi.delete(id)
      setNotes(n => n.filter(x => x.id !== id))
    } catch {
      toast.show('Nie można usunąć notatki')
    }
  }

  async function handleTranscriptSave(note: VoiceNote, newTranscript: string) {
    await voiceNotesApi.updateTranscript(note.id, newTranscript)
    setNotes(n => n.map(x => x.id === note.id ? { ...x, transcript: newTranscript, status: 'raw', extracted_result: null } : x))
    setTranscriptModal(null)
  }

  function handleTitleDone(id: string, newTitle: string) {
    setNotes(n => n.map(x => x.id === id ? { ...x, title: newTitle } : x))
    setEditingTitle(null)
  }

  async function handleAssign(noteId: string, projectId: string | null) {
    try {
      await voiceNotesApi.assignToProject(noteId, projectId)
      setNotes(n => n.map(x => x.id === noteId ? { ...x, project_id: projectId } : x))
      setAssigningId(null)
      toast.show(projectId ? 'Przypisano do projektu' : 'Odłączono od projektu', 'success')
    } catch (err) {
      toast.show(`Błąd przypisania: ${err instanceof Error ? err.message : String(err)}`)
    }
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
    <>
      {/* Toast notification */}
      {toast.message && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.message.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
          color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          zIndex: 2000, maxWidth: 320, textAlign: 'center', boxShadow: '0 4px 12px rgba(30,29,24,0.15)',
        }}>
          {toast.message.text}
        </div>
      )}

      {transcriptModal && (
        <TranscriptModal
          note={transcriptModal}
          onClose={() => setTranscriptModal(null)}
          onSave={(t) => handleTranscriptSave(transcriptModal, t)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map(note => {
          const isExpanded = expanded === note.id
          const transcriptTooLong = note.transcript.length > 1500
          const previewText = transcriptTooLong
            ? note.transcript.slice(0, 1500) + '…'
            : note.transcript

          return (
            <div key={note.id} style={{
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--color-surface)',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
                <Mic size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingTitle === note.id ? (
                    <InlineTitleEdit id={note.id} initial={note.title} onDone={(v) => handleTitleDone(note.id, v)} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{note.title}</span>
                      <button type="button" onClick={() => setEditingTitle(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex', opacity: 0.6 }}>
                        <Edit2 size={11} />
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                    {new Date(note.created_at).toLocaleString('pl-PL')}
                    {note.project_id && <span style={{ marginLeft: 6 }}>• projekt</span>}
                    {note.transcript.length > 0 && (
                      <span style={{ marginLeft: 6 }}>• {(note.transcript.length / 1000).toFixed(1)}k znaków</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
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
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}>
                  {note.status === 'raw' ? 'Nowa'
                    : note.status === 'processing' ? 'Przetwarza…'
                    : note.status === 'processed' ? 'Gotowa'
                    : 'Błąd'}
                </span>

                {/* Transcript viewer button */}
                {note.transcript && (
                  <button
                    type="button"
                    title="Podgląd tekstu"
                    onClick={() => setTranscriptModal(note)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, display: 'flex', flexShrink: 0 }}
                  >
                    <FileText size={14} />
                  </button>
                )}

                {/* Extract / re-extract */}
                {(note.status === 'raw' || note.status === 'error') && (
                  <button
                    type="button"
                    onClick={() => handleExtract(note)}
                    disabled={extracting === note.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                      padding: '4px 10px', borderRadius: 6,
                      background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer',
                      opacity: extracting === note.id ? 0.6 : 1, flexShrink: 0,
                    }}
                  >
                    {extracting === note.id
                      ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Ekstrahuję…</>
                      : <><Sparkles size={12} /> Ekstraktuj</>
                    }
                  </button>
                )}

                {/* Re-extract after processing */}
                {note.status === 'processed' && (
                  <button
                    type="button"
                    title="Ponów ekstrakcję"
                    onClick={() => handleExtract(note)}
                    disabled={extracting === note.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}

                {/* Expand/collapse for processed */}
                {note.status === 'processed' && (
                  <button
                    type="button"
                    onClick={() => setExpanded(e => e === note.id ? null : note.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, display: 'flex', flexShrink: 0 }}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(note.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Project assignment inline picker */}
              {assigningId === note.id ? (
                <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderKanban size={13} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                  <select
                    autoFocus
                    defaultValue={note.project_id ?? ''}
                    onChange={e => handleAssign(note.id, e.target.value || null)}
                    style={{
                      flex: 1, fontSize: 12, padding: '5px 8px', borderRadius: 6,
                      border: '1px solid var(--color-brand)', background: 'var(--color-surface)',
                      color: 'var(--color-text)', outline: 'none',
                    }}
                  >
                    <option value="">— bez projektu —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setAssigningId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ padding: '4px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setAssigningId(note.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: note.project_id ? 'var(--color-brand)' : 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                  >
                    <FolderKanban size={11} />
                    {note.project_id
                      ? (projects.find(p => p.id === note.project_id)?.name ?? 'Projekt')
                      : 'Przypisz do projektu'}
                  </button>
                </div>
              )}

              {/* Transcript preview (raw / error status) */}
              {note.transcript && (note.status === 'raw' || note.status === 'error') && (
                <div style={{ padding: '0 14px 10px', fontSize: 12, color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)' }}>
                  <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {previewText}
                  </p>
                  {transcriptTooLong && (
                    <button type="button" onClick={() => setTranscriptModal(note)} style={{ marginTop: 6, fontSize: 11, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                      Otwórz pełny tekst ({(note.transcript.length / 1000).toFixed(0)}k znaków) →
                    </button>
                  )}
                </div>
              )}

              {/* Extracted result */}
              {isExpanded && note.extracted_result && (
                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  {note.extracted_result.summary && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>{note.extracted_result.summary}</p>
                  )}
                  {note.extracted_result.decisions.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>Ustalenia</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                        {note.extracted_result.decisions.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                  {note.extracted_result.action_items.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>Do zrobienia</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                        {note.extracted_result.action_items.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {note.extracted_result.amounts.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>Kwoty</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                        {note.extracted_result.amounts.map((a, i) => (
                          <li key={i}>{a.description}: {a.amount} {a.currency ?? 'PLN'}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {/* Download transcript */}
                    <button
                      type="button"
                      onClick={() => downloadAsText(note.title, note.transcript)}
                      style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-secondary)' }}
                    >
                      <Download size={12} /> Pobierz .txt
                    </button>

                    {/* Create estimate from extracted data */}
                    {(note.extracted_result.estimate_hint || note.extracted_result.amounts.length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          const items = note.extracted_result!.amounts.map(a => ({
                            name: a.description,
                            quantity: 1,
                            unit: 'szt',
                            unit_price_net: a.amount,
                            vat_rate: 23,
                          }))
                          sessionStorage.setItem('estimate_form_draft', JSON.stringify({
                            _source: 'voice_note',
                            _hint: note.extracted_result!.estimate_hint,
                            name: note.title,
                            items,
                          }))
                          navigate({ to: '/estimates' as any })
                        }}
                        style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 6, background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Sparkles size={12} /> Stwórz wycenę
                      </button>
                    )}

                    {/* Add amounts as project costs */}
                    {note.extracted_result.amounts.length > 0 && (
                      <button
                        type="button"
                        disabled={addingCostId === note.id}
                        onClick={() => addToCosts(note)}
                        style={{
                          fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 6,
                          background: costDoneId === note.id ? 'var(--color-success-soft, #d1fae5)' : 'var(--color-surface-soft)',
                          color: costDoneId === note.id ? 'var(--color-success)' : 'var(--color-text-primary)',
                          border: '1px solid var(--color-border)',
                          cursor: addingCostId === note.id ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          opacity: addingCostId === note.id ? 0.6 : 1,
                        }}
                      >
                        <PlusCircle size={12} />
                        {addingCostId === note.id ? 'Dodawanie...' : costDoneId === note.id ? '✓ Dodano do kosztów' : 'Dodaj do kosztów'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
