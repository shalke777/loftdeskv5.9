import { useRef, useState } from 'react'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '../hooks/useExpenses'
import { expensesApi, ExpenseInvoice, ParsedExpenseData, parseInvoiceFromText } from '../api/expenses.api'
import type { ParseInvoiceResult, ExpenseSourceType } from '../api/expenses.api'
import { callParseInvoice, callParseInvoiceAI } from '../hooks/useParseInvoice'
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
    parsed: 'Odczytana',
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

  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState<string>('Przesyłanie...')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [parseStatus, setParseStatus] = useState<{ level: 'success'|'partial'|'empty'|'error'|'ocr-unavailable', message: string } | null>(null)
  // Raw OCR confidence (0–100) captured during extraction — used for status derivation on save
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)

  // modal: 'add' or 'edit'
  const [modal, setModal] = useState<{ type: 'add'; fileUrl: string; fileName: string; parsed: ParsedExpenseData; previewBlobUrl?: string } | { type: 'edit'; expense: ExpenseInvoice } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ExpenseInvoice | null>(null)

  // ── file handling ────────────────────────────────────────────────────────

  async function handleFileSelected(file: File) {
    if (!file) return
    setUploading(true)
    setUploadStep('Przesyłanie pliku...')
    setUploadError(null)
    setParseStatus(null)
    setOcrConfidence(null)
    try {
      // ── Step 1: upload to storage ─────────────────────────────
      const { url, name } = await expensesApi.uploadFile(file, companyId)

      // ── Step 2: choose extraction path ────────────────────────
      const isPDF   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      let parsed: ParsedExpenseData = {}
      let usedLocalParser = false

      setUploadStep('Odczytuję tekst...')

      // For digitally-generated PDFs: try fast local text extraction first
      if (isPDF) {
        try {
          const rawText = await extractRawPdfText(file)
          const PDF_KEYWORDS = ['faktura', 'fvat', 'nip', 'netto', 'brutto', 'zaplat', 'termin']
          const hasGoodText  = rawText.trim().length >= 80 &&
            PDF_KEYWORDS.some(kw => rawText.toLowerCase().includes(kw))
          if (hasGoodText) {
            parsed = await parseInvoiceFromText(rawText)
            usedLocalParser = true
          }
        } catch (extractErr) {
          console.warn('[expenses] local PDF text extraction failed:', extractErr)
          // fall through to Netlify OCR
        }
      }

      // For images OR scanned PDFs without usable text layer: use Netlify OCR + AI fallback
      if (!usedLocalParser) {
        setUploadStep('Analizuję dane faktury...')

        let ocrResult: ParseInvoiceResult | null = null
        let ocrFailed = false
        let ocrUnavailable = false

        // Step A: OCR (Tesseract / PDF text extraction on server)
        try {
          const sourceType: ExpenseSourceType = isPDF ? 'pdf' : 'gallery'
          ocrResult = await callParseInvoice(file, sourceType)
        } catch (ocrErr: unknown) {
          const msg = ocrErr instanceof Error ? ocrErr.message : ''
          ocrFailed = true
          ocrUnavailable = msg.includes('Serwer OCR') || msg.includes('niedostępny')
          // Auth/rate errors — show in upload error banner (modal not yet open)
          if (msg.includes('Sesja wygasła') || msg.includes('Za dużo żądań')) {
            setUploadError(msg)
            return
          }
        }

        // Step B: AI fallback — try when OCR failed or confidence is low (PDFs included)
        const ocrConf = ocrResult?.extraction_confidence ?? 0
        const needsAI = ocrFailed || ocrConf < 65  // raised from 50 — trigger AI for partial results

        if (needsAI) {
          setUploadStep('Analizuję przez AI...')
          try {
            // For PDFs, pass any locally-extracted raw text as a hint to the AI
            let pdfHintText: string | undefined
            if (isPDF) {
              try { pdfHintText = await extractRawPdfText(file) } catch (hintErr) { console.warn('[expenses] PDF hint extraction failed:', hintErr) }
            }
            const aiResult = await callParseInvoiceAI(file, pdfHintText)
            const aiConf   = aiResult.extraction_confidence ?? 0
            // Only take AI result if it actually extracted something useful
            if (aiConf > 0 && aiConf >= ocrConf) {
              ocrResult = aiResult   // AI gave equal or better result
            }
          } catch (aiErr: unknown) {
            // Auth/rate errors from AI — show in upload error banner (modal not yet open)
            const aiMsg = aiErr instanceof Error ? aiErr.message : ''
            if (aiMsg.includes('Sesja wygasła') || aiMsg.includes('Za dużo żądań')) {
              setUploadError(aiMsg)
              return
            }
            // AI not configured or failed — keep OCR result (or null if OCR also failed)
          }
        }

        // Step C: map final result → form fields
        if (ocrResult) {
          setOcrConfidence(ocrResult.extraction_confidence ?? null)

          parsed = {
            invoice_number: ocrResult.invoice_number ?? undefined,
            vendor:         ocrResult.vendor_name    ?? undefined,
            vendor_nip:     ocrResult.vendor_nip     ?? undefined,
            issue_date:     ocrResult.issue_date     ?? undefined,
            amount_net:     ocrResult.net_amount     ?? undefined,
            amount_vat:     ocrResult.vat_amount     ?? undefined,
            amount_gross:   ocrResult.gross_amount   ?? undefined,
            // Use the product description returned by OCR — avoid dumping
            // pipe-separated metadata (sale_date, vat_rate, etc.) into this field.
            description:    ocrResult.notes          ?? undefined,
          }

          const confidence   = ocrResult.extraction_confidence
          const filledFields = Object.entries(parsed).filter(([, v]) => v != null).map(([k]) => k)
          const aiHint       = ocrResult.parser_source === 'ai' ? ' (AI)' : ''
          const confHint     = confidence > 0 ? ` · ${confidence}%` : ''

          // Build hint about which critical fields are missing
          function missingHint(warnings: string[]): string {
            const missing: string[] = []
            if (warnings.some(w => w.includes('nazwy sprzedawcy'))) missing.push('sprzedawca')
            if (warnings.some(w => w.includes('numeru faktury')))   missing.push('numer FK')
            if (warnings.some(w => w.includes('kwoty do zapłaty'))) missing.push('kwota')
            if (warnings.some(w => w.includes('daty wystawienia'))) missing.push('data')
            return missing.length > 0 ? ` (brakuje: ${missing.join(', ')})` : ''
          }

          if (filledFields.length > 0 && confidence >= 70) {
            setParseStatus({ level: 'success', message: `Dane odczytane${aiHint}${confHint} — sprawdź i zapisz` })
          } else if (filledFields.length > 0) {
            const detail = missingHint(ocrResult.extraction_warnings)
            setParseStatus({ level: 'partial', message: `Odczytano część danych${aiHint}${confHint}${detail} — uzupełnij brakujące pola` })
          } else {
            setParseStatus({ level: 'empty', message: 'Nie udało się odczytać danych — wpisz pola ręcznie' })
          }
        } else {
          // Both OCR and AI failed
          if (ocrUnavailable) {
            setParseStatus({ level: 'ocr-unavailable', message: 'Automatyczne odczytywanie chwilowo niedostępne — uzupełnij pola ręcznie' })
          } else {
            setParseStatus({ level: 'error', message: 'Błąd odczytu — uzupełnij pola ręcznie' })
          }
        }
      } else {
        // Local PDF parser succeeded
        const fields = Object.entries(parsed).filter(([, v]) => v != null).map(([k]) => k)
        setParseStatus(
          fields.length > 0
            ? { level: 'success', message: `Dane odczytane (${fields.length} pola) — sprawdź i zapisz` }
            : { level: 'empty', message: 'Nie udało się odczytać danych z pliku — uzupełnij pola ręcznie' }
        )
      }

      // ── Step 3: open modal with pre-filled form ───────────────
      setUploadStep('Uzupełniam formularz...')
      setForm({ ...emptyForm(), ...parsedToForm(parsed) })
      // Use local blob URL for image preview — reliably available immediately,
      // works in demo mode and in production regardless of Supabase bucket visibility.
      const isImgFile = file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
      const previewBlobUrl = isImgFile ? URL.createObjectURL(file) : undefined
      setModal({ type: 'add', fileUrl: url, fileName: name, parsed, previewBlobUrl })
    } catch (err: any) {
      setUploadError(err?.message ?? 'Błąd przesyłania pliku')
      setOcrConfidence(null)
    } finally {
      setUploading(false)
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
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
          extractionConfidence: ocrConfidence,
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
      setOcrConfidence(null)
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
      <PageHeader title="Koszty" subtitle="Skanuj faktury od dostawców — dane uzupełniają się automatycznie." />

      {/* ── Mobile quick-action bar (hidden on desktop) ──────────────── */}
      <div className="exp-mobile-actions">
        <button type="button" onClick={() => cameraInputRef.current?.click()}>
          <Camera size={22} />
          Zdjęcie
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={22} />
          Galeria / PDF
        </button>
        <button type="button" onClick={() => {
          setForm(emptyForm())
          setModal({ type: 'add', fileUrl: '', fileName: '', parsed: {} })
        }}>
          <FileText size={22} />
          Ręcznie
        </button>
      </div>

      {/* Upload zone */}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
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

        {uploading ? (
          <div className="exp-upload-zone__inner">
            <Spinner />
            <span>{uploadStep}</span>
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
              <Button variant="secondary" size="sm" icon={<Camera size={14} />} onClick={() => cameraInputRef.current?.click()}>
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
          <span>Przeciągnij plik na stronę lub kliknij, aby dodać pierwszą fakturę kosztową.</span>
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
            setModal(null); setDuplicateWarning(null); setParseStatus(null); setOcrConfidence(null)
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
                setModal(null); setDuplicateWarning(null); setParseStatus(null); setOcrConfidence(null)
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
