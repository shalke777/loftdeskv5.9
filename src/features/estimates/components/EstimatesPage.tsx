import { useMemo, useState, useEffect, useRef } from 'react'
import { Plus, Mic, MicOff } from 'lucide-react'
import { useSearch } from '@tanstack/react-router'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCreateEstimate, useDeleteEstimate, useEstimates, useUpdateEstimate } from '@/features/estimates/hooks/useEstimates'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { QueryError } from '@/shared/ui/QueryError/QueryError'
import { EstimateRow } from '@/features/estimates/components/EstimateRow'
import { EstimateForm, clearDraft as clearEstimateDraft } from '@/features/estimates/components/EstimateModal/EstimateForm'
import { useEstimateToContract } from '@/workflows/estimate-to-contract/useEstimateToContract'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { PlanLimitGuard } from '@/features/billing/components/PlanLimitGuard'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import type { Estimate } from '@/entities/estimate/model'
import { supabase } from '@/shared/lib/supabase'

type FilterStatus = 'all' | Estimate['status']

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all',      label: 'Wszystkie' },
  { value: 'draft',    label: 'Szkic' },
  { value: 'sent',     label: 'Wysłane' },
  { value: 'accepted', label: 'Zaakceptowane' },
  { value: 'rejected', label: 'Odrzucone' },
]

export function EstimatesPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Estimate | null>(null)
  const [voiceMode, setVoiceMode] = useState<'idle' | 'recording' | 'processing'>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])

  const { create: autoCreate } = useSearch({ from: '/_auth/estimates' as any }) as { create?: boolean }

  const companyId = useCompanyId()
  const { data, isLoading, isError, refetch } = useEstimates()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const createEstimate = useCreateEstimate()
  const updateEstimate = useUpdateEstimate()
  const deleteEstimate = useDeleteEstimate()
  const estimateToContract = useEstimateToContract()
  const canCreate = useCan('estimates.create')
  const canDelete = useCan('estimates.delete')
  const canConvert = useCan('estimates.convert')

  // Auto-open create modal when navigated with ?create=1
  useEffect(() => {
    if (autoCreate && canCreate) {
      setEditing(null)
      setOpen(true)
    }
  }, [autoCreate, canCreate])

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c.name])),
    [clients],
  )

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, `${p.number} · ${p.name}`])),
    [projects],
  )

  const counts = useMemo(() => ({
    all:      data?.length ?? 0,
    draft:    data?.filter(e => e.status === 'draft').length    ?? 0,
    sent:     data?.filter(e => e.status === 'sent').length     ?? 0,
    accepted: data?.filter(e => e.status === 'accepted').length ?? 0,
    rejected: data?.filter(e => e.status === 'rejected').length ?? 0,
  }), [data])

  const visible = useMemo(
    () => filterStatus === 'all' ? (data ?? []) : (data ?? []).filter(e => e.status === filterStatus),
    [data, filterStatus],
  )

  async function submit(input: any) {
    if (editing) await updateEstimate.mutateAsync({ id: editing.id, input })
    else await createEstimate.mutateAsync(input)
    setEditing(null); setOpen(false)
  }

  // ── Voice estimate handlers ────────────────────────────────────────────────

  async function startVoiceCapture() {
    setVoiceError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setVoiceMode('processing')
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        await sendVoiceToEstimate(audioBlob, recorder.mimeType || 'audio/webm')
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setVoiceMode('recording')
    } catch {
      setVoiceError('Brak dostępu do mikrofonu — sprawdź uprawnienia przeglądarki.')
    }
  }

  function stopVoiceCapture() {
    mediaRecorderRef.current?.stop()
  }

  async function sendVoiceToEstimate(audioBlob: Blob, mimeType: string) {
    try {
      const reader = new FileReader()
      const base64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(audioBlob)
      })

      const { data: { session } } = await supabase!.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/.netlify/functions/voice-to-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audio_base64: base64, audio_type: mimeType }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json() as {
        title?: string
        items?: Array<{ description: string; quantity: number; unit: string; unit_price: number; vat_rate: number }>
        extraction_confidence?: number
        transcript?: string
        extraction_warnings?: string[]
      }

      // Map AI items → EstimateItem shape (name = description, generated id & sort_order)
      const estimateItems = (data.items ?? []).map((item, idx) => ({
        id: crypto.randomUUID(),
        name: item.description ?? '',
        unit: item.unit ?? 'm²',
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        unit_price: typeof item.unit_price === 'number' ? item.unit_price : 0,
        vat_rate: typeof item.vat_rate === 'number' ? item.vat_rate : 8,
        sort_order: idx,
        catalog_item_id: null,
      }))

      // Save as sessionStorage draft — EstimateForm reads this on mount
      const draft = {
        name: data.title ?? 'Wycena głosowa',
        notes: '',
        clientId: '',
        status: 'draft',
        validUntil: '',
        projectId: '',
        items: estimateItems,
        _source: 'voice_whisper',
      }
      try { sessionStorage.setItem('estimate_form_draft', JSON.stringify(draft)) } catch { /* ignore */ }

      setVoiceMode('idle')
      if ((data.extraction_confidence ?? 100) < 50) {
        setVoiceError('Ceny nie zostały rozpoznane — sprawdź i uzupełnij pozycje przed zapisaniem.')
      }
      setEditing(null)
      setOpen(true)
    } catch (err) {
      setVoiceMode('idle')
      setVoiceError(err instanceof Error ? err.message : 'Nie udało się przetworzyć nagrania.')
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <PageHeader title="Wyceny" subtitle="Przygotuj ofertę, wyślij do klienta i przekształć w umowę jednym kliknięciem." />
        <div className="toolbar__actions">
          {canCreate && (
            <PlanLimitGuard resource="estimates">
              <Button
                variant="secondary"
                onClick={voiceMode === 'idle' ? startVoiceCapture : voiceMode === 'recording' ? stopVoiceCapture : () => {}}
                disabled={voiceMode === 'processing'}
                style={voiceMode === 'recording' ? { borderColor: '#dc2626', color: '#dc2626' } : {}}
              >
                {voiceMode === 'processing' ? (
                  'Przetwarzam…'
                ) : voiceMode === 'recording' ? (
                  <><MicOff size={16} style={{ marginRight: 4 }} /> Zatrzymaj</>
                ) : (
                  <><Mic size={16} style={{ marginRight: 4 }} /> Wycena głosowa</>
                )}
              </Button>
            </PlanLimitGuard>
          )}
          {canCreate && (
            <PlanLimitGuard resource="estimates">
              <Button onClick={() => { setEditing(null); setOpen(true) }}>
                <Plus size={16} style={{ marginRight: 4 }} />
                Nowa wycena
              </Button>
            </PlanLimitGuard>
          )}
        </div>
      </div>

      {voiceError && (
        <div style={{
          background: 'var(--color-warning-soft)', border: '1px solid var(--color-warning)',
          borderRadius: 8, padding: '8px 14px', fontSize: 12,
          color: 'var(--color-text-primary)', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠️ {voiceError}</span>
          <button type="button" onClick={() => setVoiceError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'var(--color-text-secondary)' }}>×</button>
        </div>
      )}

      <div className="proj-filters">
        {FILTER_LABELS.map(({ value, label }) => (
          <button key={value} type="button"
            className={`proj-filter-pill${filterStatus === value ? ' proj-filter-pill--active' : ''}`}
            onClick={() => setFilterStatus(value)}>
            {label}
            <span className="proj-filter-pill__count">{counts[value]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filterStatus === 'all' ? 'Brak wycen' : 'Brak wycen w tej kategorii'}
          description={filterStatus === 'all' ? 'Stwórz pierwszą wycenę dla klienta — z pozycjami, stawkami VAT i gotową do PDF.' : 'Zmień filtr lub utwórz nową wycenę.'}
          action={canCreate && filterStatus === 'all'
            ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Utwórz wycenę</Button>
            : undefined}
        />
      ) : (
        <div className="proj-list">
          {visible.map(estimate => (
            <EstimateRow
              key={estimate.id}
              estimate={estimate}
              clientName={estimate.client_id ? (clientMap[estimate.client_id] ?? null) : null}
              projectName={estimate.project_id ? (projectMap[estimate.project_id] ?? null) : null}
              onEdit={e => { setEditing(e); setOpen(true) }}
              onDelete={canDelete ? id => deleteEstimate.mutate(id) : undefined}
              onCreateContract={canConvert ? id => estimateToContract.mutate(id) : undefined}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <Modal open={open} onClose={() => { if (!editing) clearEstimateDraft(); setOpen(false) }} title={editing ? 'Edytuj wycenę' : 'Nowa wycena'}>
          <EstimateForm companyId={companyId} initialEstimate={editing} onSubmit={submit} />
        </Modal>
      )}
    </div>
  )
}
