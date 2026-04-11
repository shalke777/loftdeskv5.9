import { useState, useEffect, useCallback } from 'react'
import { Brain, Plus, AlertTriangle, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { getDataScope } from '@/shared/lib/dataScope'

export interface MemoryEntry {
  id: string
  memory_type: 'decision' | 'preference' | 'event' | 'issue' | 'amount'
  topic: string
  content: string
  source_type: 'manual' | 'voice_note' | 'client_decision' | 'chat'
  contradiction_of: string | null
  created_at: string
}

const TYPE_LABELS: Record<MemoryEntry['memory_type'], string> = {
  decision:   'Decyzja',
  preference: 'Preferencja',
  event:      'Zdarzenie',
  issue:      'Problem',
  amount:     'Kwota',
}

// CSS-variable-friendly badge colors (bg is semi-transparent so it works in both light/dark)
const TYPE_COLORS: Record<MemoryEntry['memory_type'], { bg: string; text: string; border: string }> = {
  decision:   { bg: 'rgba(59,130,246,0.12)',  text: 'var(--color-brand, #3b82f6)',      border: 'rgba(59,130,246,0.25)' },
  preference: { bg: 'rgba(139,92,246,0.12)',  text: 'var(--color-violet, #8b5cf6)',     border: 'rgba(139,92,246,0.25)' },
  event:      { bg: 'rgba(16,185,129,0.12)',  text: 'var(--color-success, #10b981)',    border: 'rgba(16,185,129,0.25)' },
  issue:      { bg: 'rgba(239,68,68,0.12)',   text: 'var(--color-error, #ef4444)',      border: 'rgba(239,68,68,0.25)' },
  amount:     { bg: 'rgba(245,158,11,0.12)',  text: 'var(--color-warning, #f59e0b)',    border: 'rgba(245,158,11,0.25)' },
}

const SOURCE_LABELS: Record<MemoryEntry['source_type'], string> = {
  manual:          'ręcznie',
  voice_note:      'notatka głosowa',
  client_decision: 'decyzja klienta',
  chat:            'chat',
}

interface AddEntryForm {
  memory_type: MemoryEntry['memory_type']
  topic: string
  content: string
}

const EMPTY_FORM: AddEntryForm = { memory_type: 'decision', topic: '', content: '' }

export function ProjectMemoryPanel({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<AddEntryForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [conflictWarning, setConflictWarning] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const [entriesRes, projectRes] = await Promise.all([
        supabase
          .from('project_memory_entries')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('projects')
          .select('ai_context_summary')
          .eq('id', projectId)
          .single(),
      ])
      setEntries((entriesRes.data ?? []) as MemoryEntry[])
      setSummary(projectRes.data?.ai_context_summary ?? null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  // Group by type
  const grouped = entries.reduce<Record<string, MemoryEntry[]>>((acc, e) => {
    acc[e.memory_type] = acc[e.memory_type] ?? []
    acc[e.memory_type].push(e)
    return acc
  }, {})

  async function handleDelete(id: string) {
    if (!supabase || !window.confirm('Usunąć wpis pamięci?')) return
    await supabase.from('project_memory_entries').delete().eq('id', id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  async function checkConflict(content: string): Promise<string> {
    try {
      const { data: { session } } = await supabase!.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/.netlify/functions/memory-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, new_content: content, topic: form.topic }),
      })
      if (!res.ok) return ''
      const data = await res.json() as { conflict: boolean; description?: string }
      return data.conflict ? (data.description ?? 'Wykryto możliwy konflikt z wcześniejszym wpisem.') : ''
    } catch { return '' }
  }

  async function handleSave() {
    if (!form.content.trim()) { setSaveError('Treść jest wymagana'); return }
    setSaveError('')
    setSaving(true)
    try {
      // Contradiction check
      const warning = await checkConflict(form.content)
      if (warning) {
        setConflictWarning(warning)
        setSaving(false)
        return
      }
      await submitEntry()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Błąd zapisu')
      setSaving(false)
    }
  }

  async function submitEntry() {
    const scope = await getDataScope()
    const { data, error } = await supabase!
      .from('project_memory_entries')
      .insert({
        company_id:  scope.companyId,
        project_id:  projectId,
        memory_type: form.memory_type,
        topic:       form.topic.trim(),
        content:     form.content.trim(),
        source_type: 'manual',
      })
      .select()
      .single()

    if (error) { setSaveError(error.message); setSaving(false); return }
    setEntries(e => [data as MemoryEntry, ...e])
    setForm(EMPTY_FORM)
    setAddOpen(false)
    setConflictWarning('')
    setSaving(false)
  }

  if (loading) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
      Ładowanie pamięci projektu…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* AI Summary */}
      {summary && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-surface)' }}>
          <button
            type="button"
            onClick={() => setSummaryOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <Brain size={14} style={{ color: 'var(--color-brand)' }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Kontekst AI (auto-generowany)</span>
            {summaryOpen ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />}
          </button>
          {summaryOpen && (
            <div style={{ padding: '0 14px 12px', fontSize: 13, lineHeight: 1.7, color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)' }}>
              <p style={{ margin: '10px 0 0' }}>{summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Add entry */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-surface)' }}>
        <button
          type="button"
          onClick={() => setAddOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <Plus size={14} style={{ color: 'var(--color-brand)' }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Dodaj wpis ręcznie</span>
            {addOpen ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />}
        </button>

        {addOpen && (
          <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conflictWarning && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, marginTop: 10 }}>
                <AlertTriangle size={14} style={{ color: 'var(--color-warning, #d97706)', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: 'var(--color-text)' }}>
                  <strong>Możliwy konflikt:</strong> {conflictWarning}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={submitEntry} style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 6, background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      Zapisz mimo to
                    </button>
                    <button type="button" onClick={() => setConflictWarning('')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>
                      Anuluj
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: conflictWarning ? 0 : 10 }}>
              <select
                value={form.memory_type}
                onChange={e => setForm(f => ({ ...f, memory_type: e.target.value as MemoryEntry['memory_type'] }))}
                style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', flex: '0 0 auto' }}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input
                placeholder="Temat (opcjonalny)"
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', flex: 1, minWidth: 0 }}
              />
            </div>
            <textarea
              placeholder="Treść wpisu pamięci…"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={3}
              style={{ fontSize: 12, padding: '8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            {saveError && <p style={{ margin: 0, fontSize: 11, color: 'var(--color-error, #dc2626)' }}>{saveError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ fontSize: 13, fontWeight: 700, padding: '6px 16px', borderRadius: 6, background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Sprawdzam…' : 'Zapisz'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Entries grouped by type */}
      {entries.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          <Brain size={28} style={{ opacity: 0.25, marginBottom: 8 }} />
          <p style={{ margin: 0 }}>Brak wpisów pamięci</p>
          <p style={{ margin: '4px 0 0', fontSize: 11 }}>Zostaną dodane automatycznie po ekstrakcji notatek głosowych</p>
        </div>
      ) : (
        Object.entries(TYPE_LABELS).map(([type, label]) => {
          const group = grouped[type] ?? []
          if (!group.length) return null
          const colors = TYPE_COLORS[type as MemoryEntry['memory_type']]
          return (
            <div key={type}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6, paddingLeft: 2 }}>{label} ({group.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.map(entry => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    border: `1px solid ${entry.contradiction_of ? 'rgba(239,68,68,0.4)' : 'var(--color-border)'}`,
                    borderRadius: 7,
                    background: entry.contradiction_of ? 'rgba(239,68,68,0.07)' : 'var(--color-surface)',
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                      background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, flexShrink: 0, marginTop: 1,
                    }}>
                      {label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {entry.contradiction_of && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: 'var(--color-error, #ef4444)' }}>
                          <AlertTriangle size={11} /> Możliwy konflikt z wcześniejszym wpisem
                        </div>
                      )}
                      {entry.topic && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>{entry.topic}</div>
                      )}
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-text)' }}>{entry.content}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {SOURCE_LABELS[entry.source_type]} · {new Date(entry.created_at).toLocaleString('pl-PL')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, flexShrink: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
