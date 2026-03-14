import { useRef, useState } from 'react'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '../hooks/useExpenses'
import { expensesApi, ExpenseInvoice, ParsedExpenseData, parseInvoiceFromText } from '../api/expenses.api'
import type { ParseInvoiceResult, ExpenseSourceType } from '../api/expenses.api'
import { callParseInvoice, callParseInvoiceAI, detectDocumentType, shouldUseAI, mergeIntoExpenseData } from '../hooks/useParseInvoice'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { useProjects } from '@/features/projects/hooks/useProjects'
// useProjects takes no arguments — companyId is read internally
import {
  Upload, Camera, FileText, Trash2, Edit2, AlertTriangle, CheckCircle, Clock, Package,
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatAmount(val: number | null) {
  if (val == null) return '—'
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
}

function statusLabel(s: ExpenseInvoice['status']) {
  const map: Record<ExpenseInvoice['status'], string> = {
    new: 'Nowa',
    parsed: 'Sparsowana',
    review: 'Do weryfikacji',
    assigned: 'Przypisana',
    error: 'Błąd',
  }
  return map[s] ?? s
}

function StatusBadge({ status }: { status: ExpenseInvoice['status'] }) {
  const cls: Record<ExpenseInvoice['status'], string> = {
    new: 'exp-badge exp-badge--new',
    parsed: 'exp-badge exp-badge--parsed',
    review: 'exp-badge exp-badge--review',
    assigned: 'exp-badge exp-badge--assigned',
    error: 'exp-badge exp-badge--error',
  }
  return <span className={cls[status]}>{statusLabel(status)}</span>
}

// ── empty form ────────────────────────────────────────────────────────────────

interface FormState {
  invoice_number: string
  vendor: string
  vendor_nip: string
  issue_date: string
  amount_net: string
  amount_vat: string
  amount_gross: string
  description: string
  project_id: string
  status: ExpenseInvoice['status']
}

const emptyForm = (): FormState => ({
  invoice_number: '',
  vendor: '',
  vendor_nip: '',
  issue_date: '',
  amount_net: '',
  amount_vat: '',
  amount_gross: '',
  description: '',
  project_id: '',
  status: 'review',
})

function formFromExpense(e: ExpenseInvoice): FormState {
  return {
    invoice_number: e.invoice_number ?? '',
    vendor: e.vendor ?? '',
    vendor_nip: e.vendor_nip ?? '',
    issue_date: e.issue_date ?? '',
    amount_net: e.amount_net != null ? String(e.amount_net) : '',
    amount_vat: e.amount_vat != null ? String(e.amount_vat) : '',
    amount_gross: e.amount_gross != null ? String(e.amount_gross) : '',
    description: e.description ?? '',
    project_id: e.project_id ?? '',
    status: e.status,
  }
}

// ── main component ────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const companyId = useCompanyId()
  const { user } = useAuth()
  const { data: expenses = [], isLoading } = useExpenses(companyId)
  const createExpense = useCreateExpense(companyId)
  const updateExpense = useUpdateExpense(companyId)
  const deleteExpense = useDeleteExpense(companyId)
  const { data: projects = [] } = useProjects()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  // Tracks which input triggered the file picker so we can skip Tesseract for
  // camera shots and go straight to GPT vision (better accuracy, no cold-start).
  const pendingSourceRef = useRef<ExpenseSourceType>('gallery')

  const [uploading, setUploading] = useState(false)
  const [isParsingDocument, setIsParsingDocument] = useState(false)
  const [uploadStep, setUploadStep] = useState<string>('Przesyłanie...')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [parseStatus, setParseStatus] = useState<{ level: 'success'|'partial'|'empty'|'error'|'ocr-unavailable', message: string, parserSource?: 'ai'|'regex'|'manual' } | null>(null)

  // modal: 'add' or 'edit'
  const [modal, setModal] = useState<{ type: 'add'; fileUrl: string; fileName: string; parsed: ParsedExpenseData; previewBlobUrl?: string } | { type: 'edit'; expense: ExpenseInvoice } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ExpenseInvoice | null>(null)

  // ── file handling ────────────────────────────────────────────────────────

  async function handleFileSelected(file: File) {
    if (!file) return
    // Capture source at the moment the file is picked (pendingSourceRef was set by the
    // button click handler before triggering the file picker).
    const fileSource = pendingSourceRef.current
    setUploading(true)
    setUploadStep('Przesyłanie pliku...')
    setUploadError(null)
    setParseStatus(null)
    console.info('EXPENSE_PARSE_LOADING_START')
    try {
      // ── Step 1: upload to storage ─────────────────────────────
      const { url, name } = await expensesApi.uploadFile(file, companyId)

      // ── Step 2: choose extraction path ────────────────────────
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      // Camera shots go straight to GPT vision — skipping Tesseract entirely.
      // Reasons: Tesseract struggles with shadows / perspective / low contrast that
      // are typical on phone camera photos; GPT vision is significantly more accurate
      // and avoids the Netlify cold-start overhead of loading Tesseract WASM.
      const isCamera = fileSource === 'camera'
      let parsed: ParsedExpenseData = {}
      let usedLocalParser = false
      let rawText = ''
      let ocrResult: ParseInvoiceResult | null = null
      let ocrErrorLevel: 'ocr-unavailable' | 'error' | null = null

      setUploadStep('Odczyt lokalny...')

      // For digitally-generated PDFs: try fast local text extraction first
      if (isPDF) {
        try {
          rawText = await extractRawPdfText(file)
          const PDF_KEYWORDS = ['faktura', 'fvat', 'nip', 'netto', 'brutto', 'zaplat', 'termin']
          const hasGoodText  = rawText.trim().length >= 80 &&
            PDF_KEYWORDS.some(kw => rawText.toLowerCase().includes(kw))
          if (hasGoodText) {
            parsed = await parseInvoiceFromText(rawText)
            usedLocalParser = true
          }
        } catch {
          // local extraction failed — fall through to Netlify OCR
        }
      }

      // For images OR scanned PDFs without usable text layer: use Netlify OCR.
      // EXCEPTION: camera shots skip Tesseract entirely and go straight to GPT vision
      // (see isCamera flag; handled below in the AI step).
      if (!usedLocalParser && !isCamera) {
        setUploadStep('Analizuję dane faktury...')
        try {
          const sourceType: ExpenseSourceType = isPDF ? 'pdf' : 'gallery'
          ocrResult = await callParseInvoice(file, sourceType)
          parsed = {
            invoice_number: ocrResult.invoice_number ?? undefined,
            vendor:         ocrResult.vendor_name    ?? undefined,
            vendor_nip:     ocrResult.vendor_nip     ?? undefined,
            issue_date:     ocrResult.issue_date     ?? undefined,
            amount_net:     ocrResult.net_amount     ?? undefined,
            amount_vat:     ocrResult.vat_amount     ?? undefined,
            amount_gross:   ocrResult.gross_amount   ?? undefined,
            description:    ocrResult.notes          ?? undefined,
          }
        } catch (ocrErr: unknown) {
          const msg = ocrErr instanceof Error ? ocrErr.message : ''
          ocrErrorLevel = (msg.includes('Serwer OCR') || msg.includes('niedostępny'))
            ? 'ocr-unavailable' : 'error'
        }
      }

      // ── Step 2c: AI fallback ──────────────────────────────────
      // PDFs always go through AI: the server-side OCR/regex is not reliable enough
      // for compressed (FlateDecode) PDF streams — AI on the extracted text is far better.
      // For images: apply AI when OCR server is reachable and quality is low.
      const localConfidence = ocrResult?.extraction_confidence ?? estimateParsedConfidence(parsed)
      const docType         = detectDocumentType(rawText || ocrResult?.extracted_text || '')
      let usedAI = false
      let aiAttemptedButFailed = false

      // For PDFs: always try AI (regex on PDF is unreliable; extracted_text from server is available).
      // For camera: always try AI (Tesseract was skipped; GPT vision is the only extractor).
      // For gallery images: only when OCR returns low-quality result.
      const shouldRunAI = (isPDF || isCamera)
        ? ocrErrorLevel !== 'ocr-unavailable'
        : ocrErrorLevel !== 'ocr-unavailable' && shouldUseAI(localConfidence, parsed, docType)

      if (shouldRunAI) {
        setUploadStep('Analizuję dokument...')
        setIsParsingDocument(true)
        try {
          const isMediaImage  = file.type.startsWith('image/') ||
            /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)

          // ── DIAGNOSTIC: state at AI entry point ─────────────────────────
          const _diagBase = {
            docType,
            fileType:      file.type,
            mimeType:      file.type,
            rawTextLength:           rawText.trim().length,
            serverExtractedTextLen:  ocrResult?.extracted_text?.trim().length ?? 0,
            isMediaImage,
            hasOcrResult:  !!ocrResult,
            isPDF,
            ocrErrorLevel,
          }
          console.info('AI_CALL_REQUEST_START', { ..._diagBase, hasAiCallParams: '(pending)' })

          let aiCallParams: { textContent?: string; imageBase64?: string; imageType?: string } | null = null

          // For PDFs: prefer the server-extracted text (covers FlateDecode-compressed streams
          // that the client-side extractor cannot decompress). Fall back to embedded-JPEG OCR
          // text if available, then the field-level synthetic text, then a minimal hint.
          const serverExtractedText = isPDF ? (ocrResult?.extracted_text ?? '') : ''
          const effectiveTextForAI  = rawText.trim().length > 10
            ? rawText
            : serverExtractedText.trim().length > 10
              ? serverExtractedText
              : ''

          if (effectiveTextForAI.length > 10) {
            aiCallParams = { textContent: effectiveTextForAI }
          } else if (isMediaImage) {
            console.info('AI_CALL_REQUEST_URL', { ..._diagBase, path: '/.netlify/functions/parse-invoice-ai', mode: 'vision', hasAiCallParams: true })
            aiCallParams = {
              imageBase64: await fileToBase64ForAI(file),
              imageType:   file.type || 'image/jpeg',
            }
          } else if (ocrResult) {
            const parts: string[] = ['Wynik OCR (niepewny, wymaga weryfikacji):']
            if (ocrResult.invoice_number) parts.push(`Numer faktury: ${ocrResult.invoice_number}`)
            if (ocrResult.vendor_name)    parts.push(`Sprzedawca: ${ocrResult.vendor_name}`)
            if (ocrResult.vendor_nip)     parts.push(`NIP: ${ocrResult.vendor_nip}`)
            if (ocrResult.issue_date)     parts.push(`Data wystawienia: ${ocrResult.issue_date}`)
            if (ocrResult.gross_amount)   parts.push(`Brutto: ${ocrResult.gross_amount}`)
            if (ocrResult.net_amount)     parts.push(`Netto: ${ocrResult.net_amount}`)
            if (ocrResult.vat_amount)     parts.push(`VAT: ${ocrResult.vat_amount}`)
            if (parts.length > 1) {
              console.info('AI_FALLBACK_SYNTHETIC_TEXT', { ..._diagBase, fields: parts.length - 1 })
              aiCallParams = { textContent: parts.join('\n') }
            } else {
              // ocrResult exists but every field is null — synthetic text would be empty
              console.warn('AI_CALL_ABORTED_NO_INPUT', {
                reason:       'ocr_result_all_fields_null',
                ..._diagBase,
                hasAiCallParams: false,
              })
            }
          } else {
            // Not an image, no usable text layer, no ocrResult at all
            console.warn('AI_CALL_ABORTED_UNSUPPORTED_DOC', {
              reason:       'no_text_no_image_no_ocr',
              ..._diagBase,
              hasAiCallParams: false,
              hint: 'scanned PDF with failed OCR or unknown file type',
            })
          }

          if (!aiCallParams) {
            // Catch-all in case a branch above didn't log (safety net)
            console.warn('AI_CALL_ABORTED_NO_PARAMS', {
              reason:          'aiCallParams_null',
              ..._diagBase,
              hasAiCallParams: false,
            })
          } else {
            console.info('AI_CALL_REQUEST_URL', {
              path:            '/.netlify/functions/parse-invoice-ai',
              mode:            aiCallParams.imageBase64 ? 'vision' : 'text',
              textLen:         aiCallParams.textContent?.length ?? 0,
              ..._diagBase,
              hasAiCallParams: true,
            })
            const aiResult = await callParseInvoiceAI(aiCallParams)
            parsed   = mergeIntoExpenseData(parsed, aiResult)
            usedAI   = true
            ocrResult = ocrResult
              ? { ...ocrResult, extraction_confidence: Math.max(ocrResult.extraction_confidence, aiResult.extraction_confidence) }
              : aiResult
          }
        } catch (aiErr: unknown) {
          aiAttemptedButFailed = true
          console.warn('AI_CALL_SKIPPED', {
            reason:       'exception_in_ai_block',
            errorMessage: aiErr instanceof Error ? aiErr.message : String(aiErr),
            docType,
            fileType:     file.type,
            mimeType:     file.type,
            rawTextLength: rawText.trim().length,
            isMediaImage: file.type.startsWith('image/'),
            hasOcrResult: !!ocrResult,
            hasAiCallParams: null,
          })
        } finally {
          setIsParsingDocument(false)
        }
      }

      // ── Step 2d: set status banner ────────────────────────────
      if (ocrErrorLevel && !usedAI) {
        setParseStatus({
          level:   ocrErrorLevel,
          message: ocrErrorLevel === 'ocr-unavailable'
            ? 'Serwer OCR niedostępny — uzupełnij pola ręcznie'
            : 'Błąd odczytu — uzupełnij pola ręcznie',
        })
      } else {
        const filledFields    = Object.entries(parsed).filter(([, v]) => v != null && v !== '').map(([k]) => k)
        const finalConfidence = ocrResult?.extraction_confidence ?? estimateParsedConfidence(parsed)
        const source: 'ai' | 'regex' | 'manual' = usedAI ? 'ai' : (usedLocalParser ? 'manual' : 'regex')
        const aiFailNote = aiAttemptedButFailed ? ' · Analiza AI nie powiodła się' : ''

        if (filledFields.length > 0 && (usedAI || finalConfidence >= 70)) {
          setParseStatus({ level: 'success', message: `Dane odczytane — sprawdź i zapisz${aiFailNote}`, parserSource: source })
        } else if (filledFields.length > 0) {
          setParseStatus({ level: 'partial', message: `Częściowe dane — sprawdź przed zapisem${aiFailNote}`, parserSource: source })
        } else {
          setParseStatus({ level: 'empty', message: 'Nie udało się odczytać danych — wpisz pola ręcznie' })
        }
      }

      // ── Step 3: open modal with pre-filled form ───────────────
      setUploadStep('Uzupełniam formularz...')
      setForm({ ...emptyForm(), ...parsedToForm(parsed) })
      const isImgFile = file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
      const previewBlobUrl = isImgFile ? URL.createObjectURL(file) : undefined
      setModal({ type: 'add', fileUrl: url, fileName: name, parsed, previewBlobUrl })
    } catch (err: any) {
      setUploadError(err?.message ?? 'Błąd przesyłania pliku')
    } finally {
      console.info('EXPENSE_PARSE_LOADING_END')
      setUploading(false)
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    console.info('EXPENSE_FILE_INPUT_CHANGE', { name: file?.name ?? null, type: file?.type ?? null, size: file?.size ?? null })
    if (file) handleFileSelected(file)
    e.target.value = ''
  }

  // ── form submit ──────────────────────────────────────────────────────────

  async function handleSave() {
    if (!modal) return
    setSaving(true)
    setDuplicateWarning(null)
    try {
      if (modal.type === 'add') {
        // Check duplicate
        const dupId = await expensesApi.checkDuplicate(
          companyId,
          form.invoice_number || null,
          form.vendor_nip || null,
          parseFloat(form.amount_gross) || null,
        )
        if (dupId && !duplicateWarning) {
          setDuplicateWarning(`Faktura o numerze "${form.invoice_number}" już istnieje w systemie. Zapisać mimo to?`)
          setSaving(false)
          return
        }
        await createExpense.mutateAsync({
          fileUrl: modal.fileUrl,
          fileName: modal.fileName,
          projectId: form.project_id || null,
          parsed: formToParsed(form),
        })
      } else {
        const patch: Partial<ExpenseInvoice> = {
          invoice_number: form.invoice_number || null,
          vendor: form.vendor || null,
          vendor_nip: form.vendor_nip || null,
          issue_date: form.issue_date || null,
          amount_net: parseFloat(form.amount_net) || null,
          amount_vat: parseFloat(form.amount_vat) || null,
          amount_gross: parseFloat(form.amount_gross) || null,
          description: form.description || null,
          project_id: form.project_id || null,
          status: form.status,
        }
        await updateExpense.mutateAsync({ id: modal.expense.id, data: patch })
      }
      setModal(null)
      setDuplicateWarning(null)
      setParseStatus(null)
    } catch (err: any) {
      setUploadError(err?.message ?? 'Błąd zapisu')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(expense: ExpenseInvoice) {
    await deleteExpense.mutateAsync(expense.id)
    setDeleteConfirm(null)
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function parsedToForm(p: ParsedExpenseData): Partial<FormState> {
    return {
      invoice_number: p.invoice_number ?? '',
      vendor: p.vendor ?? '',
      vendor_nip: p.vendor_nip ?? '',
      issue_date: p.issue_date ?? '',
      amount_net: p.amount_net != null ? String(p.amount_net) : '',
      amount_vat: p.amount_vat != null ? String(p.amount_vat) : '',
      amount_gross: p.amount_gross != null ? String(p.amount_gross) : '',
      description: p.description ?? '',
    }
  }

  function formToParsed(f: FormState): ParsedExpenseData {
    return {
      invoice_number: f.invoice_number || undefined,
      vendor: f.vendor || undefined,
      vendor_nip: f.vendor_nip || undefined,
      issue_date: f.issue_date || undefined,
      amount_net: parseFloat(f.amount_net) || undefined,
      amount_vat: parseFloat(f.amount_vat) || undefined,
      amount_gross: parseFloat(f.amount_gross) || undefined,
      description: f.description || undefined,
    }
  }

  function autoCalcVat() {
    const net = parseFloat(form.amount_net)
    const gross = parseFloat(form.amount_gross)
    if (!isNaN(net) && !isNaN(gross)) {
      setForm((f) => ({ ...f, amount_vat: (Math.round((gross - net) * 100) / 100).toString() }))
    }
  }

  const projectOptions = [
    { value: '', label: 'Bez projektu' },
    ...projects.map((p: any) => ({ value: p.id, label: p.name })),
  ]

  const statusOptions: { value: ExpenseInvoice['status']; label: string }[] = [
    { value: 'new', label: 'Nowa' },
    { value: 'review', label: 'Do weryfikacji' },
    { value: 'parsed', label: 'Sparsowana' },
    { value: 'assigned', label: 'Przypisana' },
    { value: 'error', label: 'Błąd' },
  ]

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <PageHeader title="Koszty" subtitle="Skanuj i ewidencjonuj faktury kosztowe" />

      {/* Hidden file inputs — placed OUTSIDE the upload zone so that programmatic
          .click() events don't bubble back through the zone's onClick handler
          (which was causing the file picker to open twice on desktop). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={onFileInput}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onFileInput}
      />

      {/* ── Mobile: quick-action buttons OR parsing overlay ──────────────
           The upload zone is hidden on mobile via CSS, so we replicate the
           loading indicator here as a dedicated overlay.              */}
      {uploading ? (
        <div className="exp-parse-overlay">
          <Spinner />
          <span className="exp-parse-overlay__step">{uploadStep}</span>
          {isParsingDocument && (
            <span className="exp-parse-overlay__hint">Może potrwać kilka sekund</span>
          )}
        </div>
      ) : (
        <div className="exp-mobile-actions">
          <button
            type="button"
            className="exp-mobile-actions__camera"
            onClick={() => { console.info('EXPENSE_CAMERA_CLICK'); pendingSourceRef.current = 'camera'; cameraInputRef.current?.click() }}
          >
            <Camera size={22} />
            Zdjęcie
          </button>
          <button
            type="button"
            className="exp-mobile-actions__gallery"
            onClick={() => { console.info('EXPENSE_GALLERY_CLICK'); pendingSourceRef.current = 'gallery'; fileInputRef.current?.click() }}
          >
            <Upload size={22} />
            Galeria / PDF
          </button>
          <button
            type="button"
            className="exp-mobile-actions__manual"
            onClick={() => {
              console.info('EXPENSE_MANUAL_CLICK')
              setForm(emptyForm())
              setModal({ type: 'add', fileUrl: '', fileName: '', parsed: {} })
            }}
          >
            <FileText size={22} />
            Ręcznie
          </button>
        </div>
      )}

      {/* Upload zone (desktop only — hidden on mobile via CSS) */}
      <div
        className="exp-upload-zone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('exp-upload-zone--drag') }}
        onDragLeave={(e) => e.currentTarget.classList.remove('exp-upload-zone--drag')}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('exp-upload-zone--drag')
          const file = e.dataTransfer.files?.[0]
          if (file) handleFileSelected(file)
        }}
      >

        {uploading ? (
          <div className="exp-upload-zone__inner">
            <Spinner />
            <span style={{
              fontWeight: isParsingDocument ? 600 : 400,
              color: isParsingDocument ? 'var(--color-brand)' : undefined,
              fontSize: 14,
            }}>{uploadStep}</span>
            {isParsingDocument && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Odczytuję dane — może potrwać kilka sekund
              </span>
            )}
          </div>
        ) : (
          <div className="exp-upload-zone__inner">
            <Upload size={28} />
            <span className="exp-upload-zone__title">Przeciągnij plik lub kliknij, aby wybrać</span>
            <span className="exp-upload-zone__hint">Obsługiwane formaty: JPG, PNG, PDF</span>
            <div className="exp-upload-zone__actions" onClick={(e) => e.stopPropagation()}>
              <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>
                Wybierz plik
              </Button>
              <Button variant="secondary" size="sm" icon={<Camera size={14} />} onClick={() => { pendingSourceRef.current = 'camera'; cameraInputRef.current?.click() }}>
                Zdjęcie
              </Button>
              <Button variant="secondary" size="sm" icon={<FileText size={14} />} onClick={() => {
                setForm(emptyForm())
                setModal({ type: 'add', fileUrl: '', fileName: '', parsed: {} })
              }}>
                Ręczne wprowadzenie
              </Button>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="exp-error-banner">
          <AlertTriangle size={14} /> {uploadError}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : expenses.length === 0 ? (
        <div className="exp-empty">
          <Package size={40} />
          <p>Brak faktur kosztowych</p>
          <span>Dodaj pierwszą fakturę korzystając ze strefy powyżej</span>
        </div>
      ) : (
        <div className="exp-table-wrap">
          <table className="exp-table">
            <thead>
              <tr>
                <th>Dostawca / numer</th>
                <th>Data</th>
                <th>Projekt</th>
                <th className="exp-col-amount">Netto</th>
                <th className="exp-col-amount">VAT</th>
                <th className="exp-col-amount">Brutto</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className={`exp-table__row${!exp.project_id ? ' exp-table__row--no-project' : ''}`}>
                  <td>
                    <div className="exp-vendor">{exp.vendor ?? <span className="exp-empty-cell">—</span>}</div>
                    <div className="exp-invoice-num">{exp.invoice_number ?? <span className="exp-empty-cell">bez numeru</span>}</div>
                  </td>
                  <td>{exp.issue_date ? new Date(exp.issue_date).toLocaleDateString('pl-PL') : '—'}</td>
                  <td>{exp.project_name ?? <span className="exp-empty-cell">—</span>}</td>
                  <td className="exp-col-amount">{formatAmount(exp.amount_net)}</td>
                  <td className="exp-col-amount">{formatAmount(exp.amount_vat)}</td>
                  <td className="exp-col-amount exp-col-amount--gross">{formatAmount(exp.amount_gross)}</td>
                  <td><StatusBadge status={exp.status} /></td>
                  <td>
                    <div className="exp-row-actions">
                      <button
                        className="exp-icon-btn"
                        title="Edytuj"
                        onClick={() => { setForm(formFromExpense(exp)); setModal({ type: 'edit', expense: exp }) }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="exp-icon-btn exp-icon-btn--danger"
                        title="Usuń"
                        onClick={() => setDeleteConfirm(exp)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <Modal
          open={true}
          title={modal.type === 'add' ? 'Dodaj fakturę kosztową' : 'Edytuj fakturę'}
          onClose={() => {
            if (modal?.type === 'add' && modal.previewBlobUrl) URL.revokeObjectURL(modal.previewBlobUrl)
            setModal(null); setDuplicateWarning(null); setParseStatus(null)
          }}
        >
          {/* Two-column layout when a file preview is available */}
          <div className={modal.type === 'add' && modal.fileUrl ? 'exp-modal-split' : undefined}>
            {modal.type === 'add' && modal.fileUrl && (
              <div className="exp-modal-split__preview">
                {/\.pdf$/i.test(modal.fileName) ? (
                  // No iframe — Supabase URLs set X-Frame-Options/CSP
                  <div className="exp-pdf-preview-card">
                    <span className="exp-pdf-preview-card__icon">&#128196;</span>
                    <div className="exp-pdf-preview-card__info">
                      <span className="exp-pdf-preview-card__name">{modal.fileName}</span>
                      <span className="exp-pdf-preview-card__meta">PDF</span>
                    </div>
                    <a
                      href={modal.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="exp-pdf-preview-card__open btn btn-ghost"
                      onClick={() => console.info('EXPENSE_OPEN_FILE_CLICK', { expenseId: null, fileName: modal.fileName })}
                    >
                      Otwórz ↗
                    </a>
                  </div>
                ) : (
                  <img
                    src={modal.type === 'add' && modal.previewBlobUrl ? modal.previewBlobUrl : modal.fileUrl}
                    alt="Podgląd faktury"
                    className="exp-modal-split__img"
                  />
                )}
              </div>
            )}

          <div className="exp-form">
            {modal.type === 'add' && modal.fileName && !modal.fileUrl && (
              <div className="exp-form__file-hint">
                <FileText size={14} /> {modal.fileName}
              </div>
            )}

            {parseStatus && (
              <div className={`exp-parse-status exp-parse-status--${parseStatus.level}`}>
                <span className="exp-parse-status__msg">{parseStatus.message}</span>
                {parseStatus.parserSource === 'ai' && (
                  <span className="exp-ai-chip">Analiza rozszerzona</span>
                )}
              </div>
            )}

            {duplicateWarning && (
              <div className="exp-form__dup-warn">
                <AlertTriangle size={14} /> {duplicateWarning}
              </div>
            )}

            <div className="exp-form__grid">
              <div className="exp-form__field exp-form__field--full">
                <label>Sprzedawca / dostawca</label>
                <Input
                  value={form.vendor}
                  onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                  placeholder='np. "Sklep Budowlany ABC Sp. z o.o."'
                />
              </div>
              <div className="exp-form__field">
                <label>NIP dostawcy</label>
                <Input
                  value={form.vendor_nip}
                  onChange={(e) => setForm((f) => ({ ...f, vendor_nip: e.target.value }))}
                  placeholder="5221234567"
                />
              </div>
              <div className="exp-form__field">
                <label>Numer faktury</label>
                <Input
                  value={form.invoice_number}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                  placeholder='np. "FV/2026/00812"'
                />
              </div>
              <div className="exp-form__field">
                <label>Data wystawienia</label>
                <Input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                />
              </div>
              <div className="exp-form__field">
                <label>Kwota netto (PLN)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_net}
                  onChange={(e) => setForm((f) => ({ ...f, amount_net: e.target.value }))}
                  onBlur={autoCalcVat}
                  placeholder="0.00"
                />
              </div>
              <div className="exp-form__field">
                <label>Kwota brutto (PLN)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_gross}
                  onChange={(e) => setForm((f) => ({ ...f, amount_gross: e.target.value }))}
                  onBlur={autoCalcVat}
                  placeholder="0.00"
                />
              </div>
              <div className="exp-form__field">
                <label>VAT (PLN)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_vat}
                  onChange={(e) => setForm((f) => ({ ...f, amount_vat: e.target.value }))}
                  placeholder="auto"
                />
              </div>
              <div className="exp-form__field">
                <label>Projekt</label>
                <Select
                  value={form.project_id}
                  onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                  options={projectOptions}
                />
              </div>
              {modal.type === 'edit' && (
                <div className="exp-form__field">
                  <label>Status</label>
                  <Select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ExpenseInvoice['status'] }))}
                    options={statusOptions}
                  />
                </div>
              )}
              <div className="exp-form__field exp-form__field--full">
                <label>Opis / notatka</label>
                <textarea
                  className="exp-textarea"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Opcjonalny opis towaru lub usługi"
                />
              </div>
            </div>

            <div className="exp-form__actions">
              <Button variant="secondary" onClick={() => {
                if (modal?.type === 'add' && modal.previewBlobUrl) URL.revokeObjectURL(modal.previewBlobUrl)
                setModal(null); setDuplicateWarning(null); setParseStatus(null)
              }}>
                Anuluj
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                icon={saving ? <Spinner /> : duplicateWarning ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              >
                {saving ? 'Zapisuję...' : duplicateWarning ? 'Zapisz mimo to' : 'Zapisz koszt'}
              </Button>
            </div>
          </div>
          </div>{/* end exp-modal-split */}
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal open={true} title="Usuń fakturę" onClose={() => setDeleteConfirm(null)}>
          <p style={{ marginBottom: 20, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Na pewno usunąć fakturę <strong>{deleteConfirm.invoice_number ?? 'bez numeru'}</strong>{' '}
            od <strong>{deleteConfirm.vendor ?? 'nieznanego dostawcy'}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Anuluj</Button>
            <Button variant="danger" onClick={() => handleDelete(deleteConfirm)} icon={<Trash2 size={14} />}>Usuń</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── PDF text extraction (literal streams only — NO DecompressionStream) ─────────

/**
 * Extracts text from a PDF by scanning only non-compressed content streams.
 *
 * Deliberately SKIPS all FlateDecode / LZW / DCT / etc. encoded streams to avoid
 * calling DecompressionStream, which always writes to console.error on bad input
 * EVEN WHEN the JS try/catch handles the rejection — making console spam impossible
 * to suppress.
 *
 * Works well for: PDFs with uncompressed text streams (some legacy tools, raw exports).
 * Falls through to Netlify OCR for: modern software invoices (iFirma, Comarch, Word)
 * whose text content streams are FlateDecode-compressed.
 */
function estimateParsedConfidence(p: ParsedExpenseData): number {
  let score = 0
  if (p.vendor)         score += 20
  if (p.invoice_number) score += 25
  if (p.issue_date)     score += 20
  if (p.amount_gross)   score += 25
  if (p.vendor_nip)     score += 10
  return score
}

function fileToBase64ForAI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

async function extractRawPdfText(file: File): Promise<string> {
  const ab = await file.arrayBuffer()
  const latin = new TextDecoder('latin1').decode(new Uint8Array(ab))
  const chunks: string[] = []

  const streamRe = /stream\r?\n([\s\S]{0,30000}?)endstream/g
  let m: RegExpExecArray | null
  while ((m = streamRe.exec(latin)) !== null) {
    const dict = latin.substring(Math.max(0, m.index - 400), m.index)
    // Skip every kind of encoded stream — no DecompressionStream calls at all
    if (/FlateDecode|LZWDecode|RunLengthDecode|CCITTFaxDecode|JBIG2Decode|DCTDecode|JPXDecode|ASCIIHexDecode|ASCII85Decode/i.test(dict)) {
      continue
    }
    const text = extractTjOperators(m[1])
    if (text) chunks.push(text)
  }

  return chunks.join(' ').slice(0, 30_000)
}

/**
 * Extract readable text from a PDF content stream by parsing Tj/TJ operators.
 * These are the standard PDF "show text" commands.
 */
function extractTjOperators(stream: string): string {
  const parts: string[] = []

  // Tj: (text) Tj  — single string
  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g
  let m: RegExpExecArray | null
  while ((m = tjRe.exec(stream)) !== null) {
    const t = decodePdfString(m[1])
    if (t.trim()) parts.push(t.trim())
  }

  // TJ: [(text) num ...] TJ  — text array (kern pairs)
  const tjArrRe = /\[([^\]]+)\]\s*TJ/g
  while ((m = tjArrRe.exec(stream)) !== null) {
    const inner = m[1]
    const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g
    let sm: RegExpExecArray | null
    while ((sm = strRe.exec(inner)) !== null) {
      const t = decodePdfString(sm[1])
      if (t.trim()) parts.push(t.trim())
    }
  }

  return parts.join(' ')
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
}
