import { useState, useRef } from 'react'
import { Camera, Plus, PenLine, Receipt, Minus, Image as GalleryIcon, FileText, Home, Calendar, Tag, Send, AlertTriangle, Trash2, Pencil, Check, X as XIcon } from 'lucide-react'
import { translateError } from '@/shared/lib/errorMessages'
import type { ExpenseSourceType, CreateExpenseForProjectInput, ExpenseInvoiceV4 } from '@/features/expenses/api/expenses.api'
import { rehydrateAnalysisResult, expensesApi } from '@/features/expenses/api/expenses.api'
import { useProjectExpenses } from '@/features/expenses/hooks/useProjectExpenses'
import { useCreateExpense }   from '@/features/expenses/hooks/useCreateExpense'
import { useParseInvoice, callParseInvoiceAI, normalizeParseResult, isNonDocumentImage, screenImageForInvoice } from '@/features/expenses/hooks/useParseInvoice'
import { useAnalyzeRoomPhoto, useAnalyzeRoomPhotos } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { BathroomClarification } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { RoomTypeId } from '@/services/ai/room-types'
import { ExpenseCameraCapture } from './ExpenseCameraCapture'
import { BathroomClarificationForm } from './BathroomClarificationForm'
import { ExpensePreviewPane }   from './ExpensePreviewPane'
import { ExpenseConfirmForm }   from './ExpenseConfirmForm'
import { ApprovalStatusBadge } from './ApprovalStatusBadge'
import { ExpenseApprovalModal } from './ExpenseApprovalModal'
import {
  LineItemsSection,
  DetectedMaterialsSection,
  WorkScopeSection,
  SuggestedEstimateSection,
} from './AnalysisSections'
import type { AnalysisResult } from '@/services/ai/analysis.types'
import type { ApprovalStatus } from '@/features/expenses/api/cost-approvals.api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth'

type TabMode = 'list' | 'capture' | 'clarification' | 'processing' | 'confirm'

interface Props { projectId: string }

const APPROVAL_LABELS: Record<ApprovalStatus | 'not_sent', string> = {
  not_sent:       'Nie wysłano',
  pending_client: 'Oczekuje na klienta',
  accepted:       'Zaakceptowany',
  rejected:       'Odrzucony',
  questioned:     'Klient ma pytanie',
  cancelled:      'Anulowany',
}

import type { ElementType } from 'react'

const SOURCE_ICONS: Record<string, ElementType> = {
  camera:     Camera,
  gallery:    GalleryIcon,
  pdf:        FileText,
  manual:     PenLine,
  room_photo: Home,
}

export function ProjectExpensesTab({ projectId }: Props) {
  const [mode,        setMode]        = useState<TabMode>('list')
  const [fileState,   setFileState]   = useState<File | null>(null)
  const [sourceType,  setSourceType]  = useState<ExpenseSourceType>('manual')
  const [parseResult, setParseResult] = useState<AnalysisResult | null>(null)
  const [parseError,  setParseError]  = useState<string | null>(null)
  const [approvalExpense, setApprovalExpense] = useState<ExpenseInvoiceV4 | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reductionOpen, setReductionOpen] = useState(false)
  const [reductionAmount, setReductionAmount] = useState('')
  const [reductionDesc, setReductionDesc] = useState('')
  const [reductionSaving, setReductionSaving] = useState(false)
  const [reductionError, setReductionError] = useState('')

  // Edit / delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ vendor: string; amount: string; date: string; notes: string; billing_type: string }>({
    vendor: '', amount: '', date: '', notes: '', billing_type: '',
  })

  const queryClient = useQueryClient()
  const companyId   = useCompanyId()

  const deleteExpense = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<ExpenseInvoiceV4[]>(['project-expenses', projectId, companyId], (old = []) => old.filter(e => e.id !== id))
      queryClient.invalidateQueries({ queryKey: ['project-expenses', projectId] })
      setDeleteConfirmId(null)
    },
  })

  const updateExpense = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      expensesApi.update(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-expenses', projectId] })
      setEditingId(null)
    },
  })

  function startEdit(exp: ExpenseInvoiceV4) {
    setEditingId(exp.id)
    const todayStr = new Date().toISOString().slice(0, 10)
    setEditForm({
      vendor: exp.vendor_name ?? exp.vendor ?? '',
      amount: String(Math.abs(exp.amount_gross ?? 0)),
      date:   exp.issue_date ?? todayStr,
      notes:  exp.description ?? '',
      billing_type: exp.billing_type ?? '',
    })
  }

  function commitEdit(exp: ExpenseInvoiceV4) {
    const gross = parseFloat(editForm.amount.replace(',', '.'))
    const isReduction = (exp.amount_gross ?? 0) < 0
    updateExpense.mutate({
      id: exp.id,
      data: {
        vendor:       editForm.vendor.trim() || undefined,
        amount_gross: isReduction ? -Math.abs(gross) : gross,
        issue_date:   editForm.date || null,
        description:  editForm.notes.trim() || null,
        billing_type: editForm.billing_type || null,
        updated_at:   new Date().toISOString(),
      },
    })
  }

  const { data: expenses = [], isLoading } = useProjectExpenses(projectId)
  const createExpense = useCreateExpense(projectId)
  const parseInvoice  = useParseInvoice()
  const analyzeRoom   = useAnalyzeRoomPhoto()
  const analyzeRooms  = useAnalyzeRoomPhotos()
  const directCameraRef = useRef<HTMLInputElement>(null)

  // Multi-photo / clarification state
  const [roomFiles, setRoomFiles] = useState<File[]>([])
  const [roomType, setRoomType] = useState<RoomTypeId>('bathroom')
  // ── Handlers ──────────────────────────────────────────────────────────────

  function startCapture() { setMode('capture') }

  function startDirectCamera() { directCameraRef.current?.click() }

  function handleDirectCameraFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    handleFileCapture(file, 'camera')
  }

  function startManual() {
    setFileState(null)
    setParseResult(null)
    setSourceType('manual')
    setMode('confirm')
  }

  function reset() {
    setMode('list')
    setFileState(null)
    setParseResult(null)
    setParseError(null)
    setRoomFiles([])
    setRoomType('bathroom')
    parseInvoice.reset()
    analyzeRoom.reset()
    analyzeRooms.reset()
    createExpense.reset()
  }

  /** Multi-photo flow: photos collected → show clarification form */
  function handleRoomPhotos(files: File[], rt: RoomTypeId) {
    setRoomFiles(files)
    setRoomType(rt)
    setSourceType('room_photo')
    setFileState(files[0] ?? null)
    setMode('clarification')
  }

  /** After clarification (or skip) → start analysis */
  function startRoomAnalysis(clarification?: BathroomClarification) {
    setMode('processing')
    analyzeRooms.mutate({ files: roomFiles, clarification, roomType }, {
      onSuccess: (result) => {
        setParseResult(result)
        setParseError(null)
        setMode('confirm')
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Analiza zdjęć pomieszczenia nie powiodła się.'
        setParseError(msg)
        setMode('confirm')
      },
    })
  }

  async function handleFileCapture(file: File, type: ExpenseSourceType) {
    setFileState(file)
    setSourceType(type)
    setParseResult(null)
    setMode('processing')

    // Room / site photo — skip OCR, go directly to vision analysis
    if (type === 'room_photo') {
      analyzeRoom.mutate({ file }, {
        onSuccess: (result) => {
          setParseResult(result)
          setParseError(null)
          setMode('confirm')
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Analiza zdjęcia pokoju nie powiodła się.'
          setParseError(msg)
          setMode('confirm')
        },
      })
      return
    }

    // Pre-parse gate: screen image files before any OCR / AI invoice extraction.
    // Only applies to camera/gallery image sources — PDF sourceType comes from
    // drag-and-drop and should pass through to OCR.
    if (type === 'camera' || type === 'gallery') {
      const docClass = await screenImageForInvoice(file)
      if (docClass === 'non_document_image') {
        setParseError('To wygląda na zdjęcie pomieszczenia lub realizacji, a nie dokument kosztowy. Dodaj zdjęcie/skan faktury, paragonu albo PDF.')
        setParseResult(null)
        setMode('confirm')
        return
      }
    }

    parseInvoice.mutate(
      { file, sourceType: type },
      {
        onSuccess: async (ocrResult) => {
          const ocrConf = ocrResult?.extraction_confidence ?? 0
          if (ocrConf < 65) {
            // AI fallback — OCR returned low confidence
            try {
              const aiResult = await callParseInvoiceAI(file)
              const aiConf = aiResult.extraction_confidence ?? 0
              if (aiConf > 0 && aiConf >= ocrConf) {
                // ── Room photo guard (AI result) ──────────────────────────
                if (isNonDocumentImage(aiResult)) {
                  setParseError('To wygląda na zdjęcie pomieszczenia lub realizacji, a nie dokument kosztowy. Dodaj zdjęcie/skan faktury, paragonu albo PDF.')
                  setParseResult(null); setMode('confirm')
                  return
                }
                setParseResult(normalizeParseResult(aiResult, file, type)); setParseError(null); setMode('confirm')
                return
              }
            } catch (aiErr) { console.warn('[expenses] AI fallback failed (low OCR confidence):', aiErr) }
          }
          // ── Room photo guard (OCR result) ───────────────────────────────
          if (isNonDocumentImage(ocrResult)) {
            setParseError('To wygląda na zdjęcie pomieszczenia lub realizacji, a nie dokument kosztowy. Dodaj zdjęcie/skan faktury, paragonu albo PDF.')
            setParseResult(null); setMode('confirm')
            return
          }
          setParseResult(normalizeParseResult(ocrResult, file, type)); setParseError(null); setMode('confirm')
        },
        onError: async (err) => {
          // OCR failed entirely — try AI before showing error
          const msg = err instanceof Error ? err.message : 'Nie udało się odczytać faktury.'
          if (!msg.includes('Sesja wygasła') && !msg.includes('Za dużo żądań')) {
            try {
              const aiResult = await callParseInvoiceAI(file)
              if ((aiResult.extraction_confidence ?? 0) > 0) {
                setParseResult(normalizeParseResult(aiResult, file, type)); setParseError(null); setMode('confirm')
                return
              }
            } catch (aiErr) { console.warn('[expenses] AI fallback failed (OCR error):', aiErr) }
          }
          setParseError(msg); setMode('confirm')
        },
      },
    )
  }

  function handleSave(data: Omit<CreateExpenseForProjectInput, 'company_id' | 'project_id'> & { file?: File | null }) {
    createExpense.mutate(data, {
      onSuccess: reset,
    })
  }

  function handleReductionSave() {
    const val = parseFloat(reductionAmount.replace(',', '.'))
    if (!val || val <= 0) return
    setReductionSaving(true)
    setReductionError('')
    createExpense.mutate({
      vendor_name: reductionDesc.trim() || 'Pomniejszenie kosztów',
      gross_amount: -Math.abs(val),
      cost_type: 'other',
      notes: `[pomniejszenie] ${reductionDesc.trim()}`.trim(),
      source_type: 'manual',
    }, {
      onSuccess: () => {
        setReductionOpen(false)
        setReductionAmount('')
        setReductionDesc('')
        setReductionSaving(false)
        setReductionError('')
      },
      onError: (err) => {
        setReductionSaving(false)
        setReductionError(err instanceof Error ? err.message : 'Błąd zapisu pomniejszenia')
      },
    })
  }

  // ── Rendering: list ───────────────────────────────────────────────────────

  if (mode === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
        {/* Hidden direct-camera input — triggers camera app in 1 tap on mobile */}
        <input
          ref={directCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleDirectCameraFile}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={startDirectCamera}
            title="Skanuj fakturę"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: 'var(--color-brand)', color: '#fff', cursor: 'pointer',
            }}
          >
            <Camera style={{ width: 18, height: 18 }} />
          </button>
          <button
            type="button"
            onClick={startCapture}
            title="Dodaj koszt (galeria, PDF, ręcznie)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: '#16a34a', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus style={{ width: 18, height: 18 }} />
          </button>
          <button
            type="button"
            onClick={() => setReductionOpen(v => !v)}
            title="Dodaj pomniejszenie kosztów (rabat, upust, korekta)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', cursor: 'pointer',
            }}
          >
            <Minus style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Inline reduction form */}
        {reductionOpen && (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-error, #A83228)',
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Minus style={{ width: 14, height: 14 }} />
              Pomniejszenie kosztów
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Opis (np. Rabat od dostawcy)"
                value={reductionDesc}
                onChange={e => setReductionDesc(e.target.value)}
                style={{
                  flex: '1 1 160px', minWidth: 0, padding: '8px 10px',
                  border: '1px solid var(--color-border)', borderRadius: 6,
                  background: 'var(--color-bg)', color: 'var(--color-text-primary)',
                  fontSize: 13,
                }}
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Kwota (PLN)"
                value={reductionAmount}
                onChange={e => setReductionAmount(e.target.value)}
                style={{
                  flex: '0 0 130px', padding: '8px 10px',
                  border: '1px solid var(--color-border)', borderRadius: 6,
                  background: 'var(--color-bg)', color: 'var(--color-text-primary)',
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn"
                disabled={reductionSaving || !reductionAmount || parseFloat(reductionAmount) <= 0}
                onClick={handleReductionSave}
                style={{ background: 'var(--color-error)', color: '#fff', border: 'none', fontSize: 13 }}
              >
                {reductionSaving ? 'Zapisuję…' : 'Zapisz pomniejszenie'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setReductionOpen(false); setReductionAmount(''); setReductionDesc(''); setReductionError('') }}
                style={{ fontSize: 13 }}
              >
                Anuluj
              </button>
            </div>
            {reductionError && (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-error)', paddingTop: 2 }}>
                Błąd: {reductionError}
              </p>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span className="spinner" style={{ width: 16, height: 16 }} />
            Ładowanie kosztów…
          </div>
        )}

        {/* Empty state */}
        {!isLoading && expenses.length === 0 && (
          <div
            style={{
              textAlign: 'center', padding: '48px 24px',
              border: '2px dashed var(--color-border)',
              borderRadius: 10, color: 'var(--color-text-muted)',
            }}
          >
            <Receipt style={{ width: 36, height: 36, marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: '0 0 16px', fontWeight: 600 }}>Brak kosztów</p>
            <p style={{ margin: '0 0 20px', fontSize: 13 }}>Dodaj pierwszy koszt — zrób zdjęcie faktury lub wpisz ręcznie.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={startDirectCamera} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, background: 'var(--color-brand)', color: '#fff', border: 'none' }}>
                <Camera style={{ width: 16, height: 16 }} />
                Skanuj fakturę
              </button>
              <button type="button" className="btn btn-secondary" onClick={startCapture} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus style={{ width: 15, height: 15 }} />
                Inne opcje
              </button>
              <button type="button" className="btn btn-secondary" onClick={startManual} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PenLine style={{ width: 15, height: 15 }} />
                Wpisz ręcznie
              </button>
            </div>
          </div>
        )}

        {/* Expense list */}
        {!isLoading && expenses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {expenses.map((exp) => {
              const isExpanded = expandedId === exp.id
              const storedAnalysis = isExpanded ? rehydrateAnalysisResult(exp.parse_raw) : null
              const hasAnalysis = exp.parse_raw != null
              const SourceIcon = SOURCE_ICONS[exp.source_type ?? 'manual'] ?? Receipt
              const isReduction = (exp.amount_gross ?? 0) < 0

              return (
              <div
                key={exp.id}
                style={{
                  borderRadius: 8,
                  border: isReduction
                    ? '1px solid var(--color-error, #A83228)'
                    : '1px solid var(--color-border)',
                  background: isReduction
                    ? 'var(--color-error-soft, rgba(168,50,40,0.06))'
                    : exp.possible_duplicate
                      ? 'var(--color-warning-soft, rgba(212,150,10,0.12))'
                      : 'var(--color-surface)',
                  overflow: 'hidden',
                }}
              >
                {/* Row header — clickable when analysis data exists */}
                <div
                  role={hasAnalysis ? 'button' : undefined}
                  tabIndex={hasAnalysis ? 0 : undefined}
                  onClick={hasAnalysis ? () => setExpandedId(isExpanded ? null : exp.id) : undefined}
                  onKeyDown={hasAnalysis ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : exp.id) } } : undefined}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: 14,
                    cursor: hasAnalysis ? 'pointer' : 'default',
                  }}
                >
                <SourceIcon size={20} style={{ flexShrink: 0, color: 'var(--color-text-muted)', marginTop: 2 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exp.vendor_name ?? exp.vendor ?? 'Nieznany sprzedawca'}
                    </span>
                    {exp.invoice_number && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        #{exp.invoice_number}
                      </span>
                    )}
                    {exp.possible_duplicate && (
                      <span
                        style={{
                          fontSize: 11, padding: '2px 6px', borderRadius: 99,
                          background: 'var(--color-warning)', color: '#fff', fontWeight: 600,
                        }}
                      >
                        Możliwy duplikat
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {exp.issue_date && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} />{exp.issue_date}</span>}
                    {exp.amount_gross != null && (
                      <span style={{ fontWeight: 600, color: isReduction ? 'var(--color-error, #A83228)' : 'var(--color-text, #111)' }}>
                        {isReduction && '−'}
                        {Math.abs(exp.amount_gross).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {exp.currency ?? 'PLN'}
                      </span>
                    )}
                    {exp.approval_status && (exp.approval_status as string) !== 'not_sent' && (
                      <ApprovalStatusBadge status={exp.approval_status as ApprovalStatus} />
                    )}
                    {exp.cost_type && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Tag size={11} />{exp.cost_type}</span>}
                    {exp.billing_type === 'included' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--color-success, #1A5C32)', background: 'rgba(26,92,50,0.08)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>
                        wliczone w wycenę
                      </span>
                    )}
                    {exp.billing_type === 'additional' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--color-warning, #B8742A)', background: 'rgba(184,116,42,0.10)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>
                        koszt dodatkowy
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {/* Send to approval button */}
                  {(!exp.approval_status || (exp.approval_status as string) === 'not_sent') && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3 }}
                      onClick={(e) => { e.stopPropagation(); setApprovalExpense(exp) }}
                      title="Wyślij do akceptacji klienta"
                    >
                      <Send size={11} />Akceptacja
                    </button>
                  )}
                  {/* Edit */}
                  <button
                    type="button"
                    title="Edytuj koszt"
                    onClick={(e) => { e.stopPropagation(); startEdit(exp) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--color-text-muted)', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                  >
                    <Pencil size={13} />
                  </button>
                  {/* Delete with confirm */}
                  {deleteConfirmId === exp.id ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <button
                        type="button"
                        title="Potwierdź usunięcie"
                        disabled={deleteExpense.isPending}
                        onClick={(e) => { e.stopPropagation(); deleteExpense.mutate(exp.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--color-error)', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        title="Anuluj"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--color-text-muted)', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      >
                        <XIcon size={13} />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Usuń koszt"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmId(exp.id)
                        setTimeout(() => setDeleteConfirmId(cur => cur === exp.id ? null : cur), 4000)
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--color-text-muted)', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  {hasAnalysis && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', userSelect: 'none', paddingLeft: 2 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                </div>

                {/* Inline edit form */}
                {editingId === exp.id && (
                  <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Sprzedawca / opis"
                        value={editForm.vendor}
                        onChange={e => setEditForm(f => ({ ...f, vendor: e.target.value }))}
                        style={{ flex: '2 1 140px', minWidth: 0, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12 }}
                      />
                      <input
                        type="number"
                        placeholder="Kwota brutto"
                        value={editForm.amount}
                        min="0.01" step="0.01"
                        onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        style={{ flex: '1 1 110px', minWidth: 0, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12 }}
                      />
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                        style={{ flex: '1 1 130px', minWidth: 0, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12 }}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Notatka (opcjonalnie)"
                      value={editForm.notes}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12 }}
                    />
                    <select
                      value={editForm.billing_type}
                      onChange={e => setEditForm(f => ({ ...f, billing_type: e.target.value }))}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12 }}
                    >
                      <option value="">Rozliczenie — nie określono</option>
                      <option value="included">Wliczony w wycenę</option>
                      <option value="additional">Koszt dodatkowy</option>
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        disabled={updateExpense.isPending}
                        onClick={() => commitEdit(exp)}
                        style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6, background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Check size={12} />{updateExpense.isPending ? 'Zapisuję…' : 'Zapisz'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                )}

                {/* Expandable analysis detail — rehydrated from stored parse_raw */}
                {isExpanded && storedAnalysis && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingTop: 10 }}>
                      Zapisana analiza · {storedAnalysis.parser_source} · pewność {storedAnalysis.extraction_confidence}%
                    </div>
                    {storedAnalysis.line_items && storedAnalysis.line_items.length > 0 && (
                      <LineItemsSection items={storedAnalysis.line_items} />
                    )}
                    {storedAnalysis.detected_materials && storedAnalysis.detected_materials.length > 0 && (
                      <DetectedMaterialsSection items={storedAnalysis.detected_materials} />
                    )}
                    {storedAnalysis.work_scope && storedAnalysis.work_scope.length > 0 && (
                      <WorkScopeSection items={storedAnalysis.work_scope} />
                    )}
                    {storedAnalysis.suggested_estimate_items && storedAnalysis.suggested_estimate_items.length > 0 && (
                      <SuggestedEstimateSection items={storedAnalysis.suggested_estimate_items} />
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}

        {/* Summary row */}
        {(expenses.length > 0 || (reductionOpen && reductionAmount)) && (() => {
          const totalGross = expenses.reduce((sum, e) => sum + (e.amount_gross ?? 0), 0)
          const pendingReduction = reductionOpen ? parseFloat(reductionAmount.replace(',', '.')) : NaN
          const previewTotal = !isNaN(pendingReduction) && pendingReduction > 0
            ? totalGross - pendingReduction
            : totalGross
          const hasPreview = !isNaN(pendingReduction) && pendingReduction > 0

          return (
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--color-surface-soft)',
                border: '1px solid var(--color-border)',
                fontSize: 13, fontWeight: 600,
              }}
            >
              <span>Suma kosztów (brutto){hasPreview && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>po pomniejszeniu</span>}</span>
              <span style={{ color: hasPreview ? 'var(--color-error)' : undefined }}>
                {previewTotal.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
              </span>
            </div>
          )
        })()}

        {/* Approval modal */}
        {approvalExpense && (
          <ExpenseApprovalModal
            projectId={projectId}
            expense={approvalExpense}
            onClose={() => setApprovalExpense(null)}
          />
        )}
      </div>
    )
  }

  // ── Rendering: capture ────────────────────────────────────────────────────

  if (mode === 'capture') {
    return (
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
            ← Wróć
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Dodaj koszt</h3>
        </div>
        <ExpenseCameraCapture onCapture={handleFileCapture} onRoomPhotos={handleRoomPhotos} onManual={startManual} />
      </div>
    )
  }

  // ── Rendering: clarification (guided form before analysis) ─────────────────

  if (mode === 'clarification') {
    return (
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
            ← Wróć
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Uzupełnij szczegóły</h3>
        </div>
        <BathroomClarificationForm
          photoCount={roomFiles.length}
          roomType={roomType}
          onSubmit={(data) => startRoomAnalysis(data)}
          onSkip={() => startRoomAnalysis()}
          disabled={analyzeRooms.isPending}
        />
      </div>
    )
  }

  // ── Rendering: processing (OCR w toku) ─────────────────────────────────────

  if (mode === 'processing') {
    const isRoomPhoto = sourceType === 'room_photo'
    const photoCount = roomFiles.length
    return (
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>← Anuluj</button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isRoomPhoto ? `Analizuję ${photoCount > 1 ? `${photoCount} zdjęć` : 'zdjęcie'} pomieszczenia…` : 'Odczytuję fakturę…'}
          </h3>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: fileState ? 'minmax(0,1fr) minmax(0,1.4fr)' : '1fr', gap: 20, alignItems: 'start' }}>
          {fileState && (
            <ExpensePreviewPane file={fileState} parseResult={null} parsing={true} />
          )}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 20, padding: '52px 24px',
            background: 'var(--color-surface-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, minHeight: 280,
          }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 15 }}>
                {isRoomPhoto ? 'Rozpoznaję materiały i zakres prac…' : 'Odczytuję tekst z faktury…'}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {isRoomPhoto
                  ? <>AI analizuje zdjęcie — zazwyczaj trwa 15–30&nbsp;sekund.<br />Wykryte materiały i zakres prac zostaną wyświetlone do sprawdzenia.</>
                  : <>OCR analizuje obraz — zazwyczaj trwa 10–25&nbsp;sekund.<br />Pola zostaną wypełnione automatycznie.</>
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  // ── Rendering: confirm ────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={createExpense.isPending} style={{ fontSize: 13 }}>
          ← Wróć
        </button>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {sourceType === 'room_photo'
            ? 'Wyniki analizy pomieszczenia'
            : fileState ? 'Potwierdź koszt' : 'Wpisz dane faktury'}
        </h3>
      </div>

      {createExpense.isError && (
        <div
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: 'var(--color-danger-soft, rgba(239,68,68,0.12))',
            border: '1px solid var(--color-danger)',
            color: 'var(--color-danger)',
          }}
        >
          Błąd zapisu: {translateError(createExpense.error)}
        </div>
      )}

      {parseError && (
        <div
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: 'var(--color-warning-soft, rgba(212,150,10,0.12))',
            border: '1px solid rgba(212,150,10,0.30)',
            color: 'var(--color-text, #111)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Odczyt faktury nie powiódł się: {parseError} — uzupełnij pola ręcznie.
        </div>
      )}

      <div
        className="form-grid"
        style={{
          gridTemplateColumns: fileState ? 'minmax(0, 1fr) minmax(0, 1.4fr)' : '1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {fileState && (
          <ExpensePreviewPane
            file={fileState}
            parseResult={parseResult}
            parsing={parseInvoice.isPending || analyzeRoom.isPending}
          />
        )}

        <ExpenseConfirmForm
          projectId={projectId}
          parseResult={parseResult}
          sourceType={sourceType}
          file={fileState}
          onSave={handleSave}
          onCancel={reset}
          saving={createExpense.isPending}
        />
      </div>
    </div>
  )
}
