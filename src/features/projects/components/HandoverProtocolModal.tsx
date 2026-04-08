/**
 * HandoverProtocolModal — Protokół odbioru z podpisami na urządzeniu (D3)
 *
 * Flow:
 *  1. Szczegóły → data, adres, lista odbiorowa (predefiniowane + własne)
 *  2. Podpis wykonawcy (canvas)
 *  3. Podpis klienta (canvas)
 *  4. Zapis → Supabase Storage + project_timeline_events
 *
 * Nie wymaga migracji DB: używa istniejącego project_timeline_events z payload JSONB.
 */

import { useState, useCallback } from 'react'
import { Plus, Trash2, CheckCircle2, Circle, ChevronLeft } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { createTimelineEvent } from '@/features/projects/lib/timeline'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'
import { SignaturePadModal } from '@/features/signatures/components/SignaturePadModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  label: string
  checked: boolean
}

type Step = 'details' | 'sig_operator' | 'sig_client' | 'saving' | 'done' | 'error'

interface Props {
  open: boolean
  projectId: string
  projectName: string
  companyId: string
  operatorName?: string
  onClose: () => void
  onSaved?: () => void
}

// ── Default checklist ─────────────────────────────────────────────────────────

const DEFAULT_ITEMS: Omit<ChecklistItem, 'id'>[] = [
  { label: 'Sprawdzono instalację elektryczną', checked: false },
  { label: 'Sprawdzono instalację wod-kan', checked: false },
  { label: 'Sprawdzono instalację grzewczą / klimatyzację', checked: false },
  { label: 'Sprawdzono powłoki malarskie / tynki', checked: false },
  { label: 'Sprawdzono wykończenie podłóg', checked: false },
  { label: 'Sprawdzono okna i drzwi', checked: false },
  { label: 'Teren uprzątnięty, odpady usunięte', checked: false },
  { label: 'Przekazano klucze i dokumentację', checked: false },
]

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

function initChecklist(): ChecklistItem[] {
  return DEFAULT_ITEMS.map(i => ({ ...i, id: makeId() }))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HandoverProtocolModal({
  open, projectId, projectName, companyId, operatorName = 'Wykonawca', onClose, onSaved,
}: Props) {
  const [step, setStep] = useState<Step>('details')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [clientName, setClientName] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initChecklist)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [sigOperator, setSigOperator] = useState<string | null>(null)
  const [sigClient, setSigClient] = useState<string | null>(null)
  const [sigPadOpen, setSigPadOpen] = useState(false)
  const [sigTarget, setSigTarget] = useState<'operator' | 'client'>('operator')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Reset on close ─────────────────────────────────────────────────────────

  function handleClose() {
    if (step === 'saving') return
    // soft reset
    setStep('details')
    setSigOperator(null)
    setSigClient(null)
    setErrorMsg(null)
    setChecklist(initChecklist())
    setClientName('')
    setLocation('')
    onClose()
  }

  // ── Checklist actions ──────────────────────────────────────────────────────

  function toggleItem(id: string) {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i))
  }

  function removeItem(id: string) {
    setChecklist(prev => prev.filter(i => i.id !== id))
  }

  function addItem() {
    const trimmed = newItemLabel.trim()
    if (!trimmed) return
    setChecklist(prev => [...prev, { id: makeId(), label: trimmed, checked: false }])
    setNewItemLabel('')
  }

  // ── Signature flow ─────────────────────────────────────────────────────────

  function openSigPad(target: 'operator' | 'client') {
    setSigTarget(target)
    setSigPadOpen(true)
  }

  function handleSigSaved(dataUrl: string) {
    setSigPadOpen(false)
    if (sigTarget === 'operator') {
      setSigOperator(dataUrl)
      setStep('sig_client')
    } else {
      setSigClient(dataUrl)
    }
  }

  // ── Upload helper ──────────────────────────────────────────────────────────

  async function uploadSignature(dataUrl: string, name: string): Promise<string | null> {
    if (!supabase) return null
    // dataUrl → Blob
    const res  = await fetch(dataUrl)
    const blob = await res.blob()
    const path = `${companyId}/signatures/${projectId}/${name}_${Date.now()}.png`
    const { error } = await supabase.storage
      .from('company-files')
      .upload(path, blob, { contentType: 'image/png', upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('company-files').getPublicUrl(path)
    return data?.publicUrl ?? null
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!sigOperator || !sigClient) return
    setStep('saving')
    setErrorMsg(null)

    try {
      // 1. Upload signature PNGs
      const [operatorUrl, clientUrl] = await Promise.all([
        uploadSignature(sigOperator, 'operator'),
        uploadSignature(sigClient, 'client'),
      ])

      // 2. Write to project_timeline_events
      await createTimelineEvent({
        company_id:   companyId,
        project_id:   projectId,
        event_type:   'handover_protocol_signed',
        visibility:   'client_shared',
        actor_type:   'operator',
        actor_name:   operatorName,
        title:        `Protokół odbioru podpisany — ${projectName}`,
        description:  `Data: ${date}${location ? `, Miejsce: ${location}` : ''}. Klient: ${clientName || 'brak nazwy'}.`,
        payload: {
          protocol_date:        date,
          protocol_location:    location,
          client_name:          clientName,
          operator_name:        operatorName,
          checklist:            checklist.map(({ label, checked }) => ({ label, checked })),
          signature_operator:   operatorUrl,
          signature_client:     clientUrl,
          checked_count:        checklist.filter(i => i.checked).length,
          total_count:          checklist.length,
        },
      })

      setStep('done')
      onSaved?.()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Błąd zapisu protokołu')
      setStep('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigOperator, sigClient, checklist, date, location, clientName, companyId, projectId, operatorName, projectName])

  // ── Render ─────────────────────────────────────────────────────────────────

  const title = step === 'done'
    ? 'Protokół zapisany ✓'
    : step === 'sig_operator'
    ? 'Podpis wykonawcy'
    : step === 'sig_client'
    ? 'Podpis klienta'
    : 'Protokół odbioru'

  return (
    <>
      {/* Main modal always open — SigPadModal overlays on top when sigPadOpen=true */}
      <Modal open={open && !sigPadOpen} onClose={handleClose} title={title}>
        {/* ── STEP: details ── */}
        {(step === 'details' || step === 'error') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Meta fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Data odbioru</span>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Miejsce</span>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="np. ul. Kwiatowa 12"
                  style={inputStyle}
                />
              </label>
            </div>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Imię i nazwisko klienta</span>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Jan Kowalski"
                style={inputStyle}
              />
            </label>

            {/* Checklist */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                Lista kontrolna odbioru ({checklist.filter(i => i.checked).length}/{checklist.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                {checklist.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px',
                      background: item.checked ? 'var(--color-success-soft, rgba(26,92,50,0.07))' : 'var(--color-surface-soft)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleItem(item.id)}
                  >
                    {item.checked
                      ? <CheckCircle2 size={16} style={{ color: 'var(--color-success, #1A5C32)', flexShrink: 0 }} />
                      : <Circle size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    }
                    <span style={{ flex: 1, fontSize: 13 }}>{item.label}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeItem(item.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-muted)' }}
                      aria-label="Usuń"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom item */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  placeholder="Dodaj własną pozycję..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <Button variant="secondary" onClick={addItem} disabled={!newItemLabel.trim()}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div style={{ color: 'var(--color-error)', fontSize: 13, padding: '8px 12px', background: 'var(--color-error-soft, rgba(168,50,40,0.07))', borderRadius: 'var(--radius-sm)' }}>
                {errorMsg}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
              <Button variant="secondary" onClick={handleClose}>Anuluj</Button>
              <Button
                variant="primary"
                onClick={() => { setStep('sig_operator'); openSigPad('operator') }}
              >
                Dalej → Podpis wykonawcy
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: sig_client (after operator signed, before client signs) ── */}
        {step === 'sig_client' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sigOperator && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Podpis wykonawcy ({operatorName})</span>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: '#1a1a2e', padding: 4 }}>
                  <img src={sigOperator} alt="Podpis wykonawcy" style={{ maxHeight: 80, display: 'block', margin: '0 auto' }} />
                </div>
              </div>
            )}

            <div style={{ padding: '12px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Teraz przekaż telefon klientowi <strong>{clientName || '(klient)'}</strong> i poproś o złożenie podpisu.
            </div>

            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              {sigClient ? (
                <>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Podpis klienta</span>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: '#1a1a2e', padding: 4 }}>
                    <img src={sigClient} alt="Podpis klienta" style={{ maxHeight: 80, display: 'block', margin: '0 auto' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                    <Button variant="secondary" onClick={() => setSigClient(null)}>Narysuj ponownie</Button>
                    <Button variant="primary" onClick={handleSave}>
                      Zapisz protokół
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="primary" onClick={() => openSigPad('client')}>
                  Podpisz jako klient
                </Button>
              )}
            </div>

            <button
              onClick={() => { setStep('details'); setSigOperator(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
            >
              <ChevronLeft size={14} /> Wróć do szczegółów
            </button>
          </div>
        )}

        {/* ── STEP: saving ── */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Zapisywanie protokołu…
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
            <CheckCircle2 size={48} style={{ color: 'var(--color-success, #1A5C32)' }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Protokół odbioru zapisany</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              Podpisy i lista kontrolna zostały zapisane w osi czasu projektu.
            </div>
            <Button variant="primary" onClick={handleClose}>Zamknij</Button>
          </div>
        )}
      </Modal>

      {/* Signature canvas — separate full-screen modal for drawing */}
      <SignaturePadModal
        open={sigPadOpen}
        title={sigTarget === 'operator' ? `Podpis wykonawcy (${operatorName})` : `Podpis klienta (${clientName || 'klient'})`}
        label="Podpisz palcem lub rysując myszą"
        onSave={handleSigSaved}
        onClose={() => {
          setSigPadOpen(false)
          if (sigTarget === 'operator') setStep('details')
        }}
      />
    </>
  )
}

// ── Style constants ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}

const labelTextStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 6px)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  width: '100%',
  boxSizing: 'border-box',
}
