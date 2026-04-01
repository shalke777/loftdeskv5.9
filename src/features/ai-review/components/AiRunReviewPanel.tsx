// =============================================================================
// AiRunReviewPanel — scope items, questions, and risks for a completed AI run
// =============================================================================
// Operator can:
//   - Accept / Modify (with final qty + price) / Reject scope items
//   - Answer questions (text / yesno / choice / number)
//   - Acknowledge / Resolve risks
// All actions write to ai_review_actions (immutable audit log).
// ai_scope_items.review_status is denormalized and updated by insertReviewAction.
// =============================================================================

import { useState } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { computeConfidenceBand } from '@/shared/lib/confidence-model'
import {
  useAiScopeItems,
  useAiQuestions,
  useAiRisks,
  useInsertReviewAction,
  useCreateEstimateFromRun,
  useExistingAiEstimate,
} from '../hooks/useAiReview'
import type {
  AiAnalysisRun,
  AiScopeItem,
  AiQuestion,
  AiRisk,
  AiReviewActionInsert,
} from '../api/ai-review.api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCOPE_STATUS_COLOR: Record<AiScopeItem['review_status'], string> = {
  pending:  'var(--color-text-secondary)',
  accepted: 'var(--color-success, #10B981)',
  modified: 'var(--color-warning, #F59E0B)',
  rejected: 'var(--color-danger, #EF4444)',
}

const SCOPE_STATUS_LABEL: Record<AiScopeItem['review_status'], string> = {
  pending:  'Oczekuje',
  accepted: 'Zaakceptowany',
  modified: 'Zmodyfikowany',
  rejected: 'Odrzucony',
}

const SEVERITY_COLOR: Record<AiRisk['severity'], string> = {
  high:   'var(--color-danger, #EF4444)',
  medium: 'var(--color-warning, #F59E0B)',
  low:    'var(--color-success, #10B981)',
}

// Separate map — AiQuestion severity keys are NOT the same as AiRisk severity keys.
const Q_SEVERITY_COLOR: Record<AiQuestion['severity'], string> = {
  critical_for_scope:     'var(--color-danger, #EF4444)',
  important_for_accuracy: 'var(--color-warning, #F59E0B)',
  optional_detail:        'var(--color-text-secondary)',
}

const Q_SEVERITY_LABEL: Record<AiQuestion['severity'], string> = {
  critical_for_scope:       'Krytyczne',
  important_for_accuracy:   'Ważne',
  optional_detail:          'Opcjonalne',
}

// ── ScopeItemRow ──────────────────────────────────────────────────────────────

function ScopeItemRow({
  item,
  runId, projectId, companyId, userId,
}: {
  item:      AiScopeItem
  runId:     string
  projectId: string
  companyId: string
  userId:    string
}) {
  const [editing,     setEditing]     = useState(false)
  const [qtyFinal,    setQtyFinal]    = useState(String(item.quantity_suggested ?? ''))
  const [priceFinal,  setPriceFinal]  = useState(String(item.price_suggested_by_ai ?? ''))
  const [reason,      setReason]      = useState('')

  const reviewAction = useInsertReviewAction(runId, projectId)

  const isPending = item.review_status === 'pending'

  function buildBase(): Omit<AiReviewActionInsert, 'action_type' | 'review_payload' | 'review_reason'> {
    return {
      company_id:       companyId,
      project_id:       projectId,
      run_id:           runId,
      scope_item_id:    item.id,
      original_payload: {
        description:          item.description,
        quantity_suggested:   item.quantity_suggested,
        price_suggested_by_ai: item.price_suggested_by_ai,
        review_status:        item.review_status,
      },
      reviewed_by: userId,
    }
  }

  function accept() {
    reviewAction.mutate({ ...buildBase(), action_type: 'accepted' })
  }

  function reject() {
    reviewAction.mutate({ ...buildBase(), action_type: 'rejected', review_reason: reason || undefined })
  }

  function submitModify() {
    reviewAction.mutate({
      ...buildBase(),
      action_type: 'modified',
      review_payload: {
        quantity_final:              qtyFinal   ? Number(qtyFinal)    : null,
        price_confirmed_by_operator: priceFinal ? Number(priceFinal)  : null,
      },
      review_reason: reason || undefined,
    })
    setEditing(false)
  }

  const busy = reviewAction.isPending

  return (
    <div
      style={{
        padding:      '10px 12px',
        borderRadius:  8,
        border:       '1px solid var(--color-border)',
        background:   'var(--color-surface)',
        display:      'grid',
        gap:           6,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
            {item.description}
          </span>
          {item.scope_layer === 'HIDDEN_PROBABLE_SCOPE' && (
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-warning, #F59E0B)' }}>
            ukryty zakres
          </span>
        )}
        </div>
        <span style={{ fontSize: 11, color: SCOPE_STATUS_COLOR[item.review_status], whiteSpace: 'nowrap' }}>
          {SCOPE_STATUS_LABEL[item.review_status]}
        </span>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>Kat.: {item.category}</span>
        {item.quantity_suggested != null && (
          <span>Ilość: {item.quantity_suggested} {item.unit ?? ''}</span>
        )}
        {item.price_suggested_by_ai != null && (
          <span>Cena AI: {item.price_suggested_by_ai} zł</span>
        )}
        {item.missing_price && (
          <span style={{ color: 'var(--color-warning, #F59E0B)' }}>brak ceny</span>
        )}
      </div>

      {/* Inline modify form */}
      {editing && (
        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <label>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 2 }}>Ilość końcowa</span>
              <input
                type="number"
                value={qtyFinal}
                onChange={e => setQtyFinal(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
            </label>
            <label>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 2 }}>Cena (zł)</span>
              <input
                type="number"
                value={priceFinal}
                onChange={e => setPriceFinal(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
            </label>
          </div>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Powód modyfikacji (opcjonalnie)"
            style={{ fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <ActionButton onClick={submitModify} disabled={busy} color="warning">
              {busy ? <Spinner /> : 'Zatwierdź'}
            </ActionButton>
            <ActionButton onClick={() => setEditing(false)} disabled={busy} color="secondary">
              Anuluj
            </ActionButton>
          </div>
        </div>
      )}

      {/* Action buttons — only for pending items */}
      {isPending && !editing && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <ActionButton onClick={accept} disabled={busy} color="success">
            {busy ? <Spinner /> : 'Akceptuj'}
          </ActionButton>
          <ActionButton onClick={() => setEditing(true)} disabled={busy} color="warning">
            Modyfikuj
          </ActionButton>
          <ActionButton onClick={reject} disabled={busy} color="danger">
            Odrzuć
          </ActionButton>
        </div>
      )}
    </div>
  )
}

// ── QuestionRow ───────────────────────────────────────────────────────────────

function QuestionRow({
  question,
  runId, projectId, companyId, userId,
}: {
  question:  AiQuestion
  runId:     string
  projectId: string
  companyId: string
  userId:    string
}) {
  const [answer, setAnswer] = useState(question.operator_answer ?? '')
  const reviewAction = useInsertReviewAction(runId, projectId)
  const busy = reviewAction.isPending
  const answered = question.status === 'answered'

  function submit() {
    if (!answer.trim()) return
    reviewAction.mutate({
      company_id:       companyId,
      project_id:       projectId,
      run_id:           runId,
      question_id:      question.id,
      action_type:      'answered',
      original_payload: { text: question.text, status: question.status },
      review_payload:   { answer: answer.trim() },
      reviewed_by:      userId,
    })
  }

  return (
    <div
      style={{
        padding:      '10px 12px',
        borderRadius:  8,
        border:       '1px solid var(--color-border)',
        background:   'var(--color-surface)',
        display:      'grid',
        gap:           8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{question.text}</span>
          {question.category && (
            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>({question.category})</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: Q_SEVERITY_COLOR[question.severity], whiteSpace: 'nowrap' }}>
          {Q_SEVERITY_LABEL[question.severity]}
        </span>
      </div>

      {/* Choice options */}
      {question.answer_type === 'choice' && question.options && !answered && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {question.options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAnswer(opt.value)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 4,
                border: `1px solid ${answer === opt.value ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: answer === opt.value ? 'var(--color-brand)' : 'transparent',
                color:      answer === opt.value ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Yesno */}
      {question.answer_type === 'yesno' && !answered && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ v: 'yes', l: 'Tak' }, { v: 'no', l: 'Nie' }].map(({ v, l }) => (
            <button
              key={v}
              type="button"
              onClick={() => setAnswer(v)}
              style={{
                fontSize: 12, padding: '4px 14px', borderRadius: 4,
                border: `1px solid ${answer === v ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: answer === v ? 'var(--color-brand)' : 'transparent',
                color:      answer === v ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Text / number input */}
      {(question.answer_type === 'text' || question.answer_type === 'number') && !answered && (
        <input
          type={question.answer_type === 'number' ? 'number' : 'text'}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder={question.answer_type === 'number' ? 'Podaj wartość liczbową' : 'Twoja odpowiedź'}
          style={{
            fontSize: 13, padding: '5px 8px', borderRadius: 4,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text)',
          }}
        />
      )}

      {answered
        ? (
          <p style={{ fontSize: 12, color: 'var(--color-success, #10B981)', margin: 0 }}>
            Odpowiedź: {question.operator_answer}
          </p>
        )
        : (
          <ActionButton onClick={submit} disabled={busy || !answer.trim()} color="primary">
            {busy ? <Spinner /> : 'Zapisz odpowiedź'}
          </ActionButton>
        )
      }
    </div>
  )
}

// ── RiskRow ───────────────────────────────────────────────────────────────────

function RiskRow({
  risk,
  runId, projectId, companyId, userId,
}: {
  risk:      AiRisk
  runId:     string
  projectId: string
  companyId: string
  userId:    string
}) {
  const reviewAction = useInsertReviewAction(runId, projectId)
  const busy = reviewAction.isPending

  function act(actionType: 'acknowledged' | 'resolved') {
    reviewAction.mutate({
      company_id:       companyId,
      project_id:       projectId,
      run_id:           runId,
      risk_id:          risk.id,
      action_type:      actionType,
      original_payload: { title: risk.title, severity: risk.severity, status: risk.status },
      reviewed_by:      userId,
    })
  }

  return (
    <div
      style={{
        padding:      '10px 12px',
        borderRadius:  8,
        border:       `1px solid ${SEVERITY_COLOR[risk.severity]}`,
        background:   'var(--color-surface)',
        display:      'grid',
        gap:           6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{risk.title}</span>
        <span style={{ fontSize: 11, color: SEVERITY_COLOR[risk.severity], whiteSpace: 'nowrap' }}>
          {risk.severity === 'high' ? 'Wysokie' : risk.severity === 'medium' ? 'Średnie' : 'Niskie'}
        </span>
      </div>
      {risk.description && (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{risk.description}</p>
      )}
      {risk.status === 'open' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <ActionButton onClick={() => act('acknowledged')} disabled={busy} color="warning">
            {busy ? <Spinner /> : 'Potwierdzam'}
          </ActionButton>
          <ActionButton onClick={() => act('resolved')} disabled={busy} color="success">
            Rozwiązane
          </ActionButton>
        </div>
      )}
      {risk.status !== 'open' && (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>
          {risk.status === 'acknowledged' ? 'Potwierdzone' : 'Rozwiązane'}
        </p>
      )}
    </div>
  )
}

// ── ActionButton (small inline button) ───────────────────────────────────────

const COLOR_MAP: Record<string, { border: string; text: string; bg?: string }> = {
  success:   { border: 'var(--color-success, #10B981)',         text: 'var(--color-success, #10B981)' },
  warning:   { border: 'var(--color-warning, #F59E0B)',         text: 'var(--color-warning, #F59E0B)' },
  danger:    { border: 'var(--color-danger, #EF4444)',          text: 'var(--color-danger, #EF4444)' },
  primary:   { border: 'var(--color-brand)',                    text: 'var(--color-brand)' },
  secondary: { border: 'var(--color-border)',                   text: 'var(--color-text-secondary)' },
}

function ActionButton({
  children, onClick, disabled, color,
}: {
  children:  React.ReactNode
  onClick:   () => void
  disabled?: boolean
  color:     'success' | 'warning' | 'danger' | 'primary' | 'secondary'
}) {
  const c = COLOR_MAP[color]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize:     12,
        padding:      '4px 10px',
        borderRadius:  4,
        border:       `1px solid ${c.border}`,
        background:   'transparent',
        color:         c.text,
        cursor:        disabled ? 'not-allowed' : 'pointer',
        opacity:       disabled ? 0.6 : 1,
        display:      'flex',
        alignItems:   'center',
        gap:           4,
      }}
    >
      {children}
    </button>
  )
}

// ── Section container ─────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  if (!count) return null
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>({count})</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && children}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  run:       AiAnalysisRun
  projectId: string
}

export function AiRunReviewPanel({ run, projectId }: Props) {
  const { user }    = useAuth()
  const companyId   = useCompanyId()
  const userId      = user?.id ?? 'unknown'

  const { data: scope     = [], isLoading: lScope }  = useAiScopeItems(run.id)
  const { data: questions = [], isLoading: lQ }      = useAiQuestions(run.id)
  const { data: risks     = [], isLoading: lR }      = useAiRisks(run.id)

  const createEstimate  = useCreateEstimateFromRun()
  const { data: existingEstimate } = useExistingAiEstimate(
    run.status === 'completed' ? run.id : null,
  )
  const [createdEstimate, setCreatedEstimate] = useState<{ number: string; itemCount: number } | null>(null)

  if (run.status === 'processing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        <Spinner /> Analiza w toku — odśwież stronę za chwilę, aby zobaczyć wyniki.
      </div>
    )
  }

  if (run.status === 'failed') {
    return (
      <p style={{ color: 'var(--color-danger, #EF4444)', fontSize: 13, padding: '16px 0' }}>
        Analiza zakończyła się błędem: {run.error_message ?? 'nieznany błąd'}
      </p>
    )
  }

  if (lScope || lQ || lR) {
    return <div style={{ padding: '16px 0' }}><Spinner /></div>
  }

  const pendingScope     = scope.filter(s => s.review_status === 'pending').length
  const pendingQuestions = questions.filter(q => q.status === 'unanswered').length
  const openRisks        = risks.filter(r => r.status === 'open').length

  const runConfidenceBand = run.confidence_summary != null
    ? computeConfidenceBand({
        rawScore:           run.confidence_summary,
        hasMissingData:     run.missing_data,
        openQuestionsCount: pendingQuestions,
        openRisksCount:     openRisks,
        photoOnly:          true, // P0 runs: photos only, no drawings
      })
    : null

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Run metadata header */}
      <div
        style={{
          padding:      '12px 16px',
          borderRadius:  8,
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          display:      'flex',
          flexWrap:     'wrap',
          gap:           16,
        }}
      >
        <div>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Pokój</p>
          <p style={{ fontSize: 13, margin: 0 }}>{run.room_type === 'bathroom' ? 'Łazienka' : 'WC'}</p>
        </div>
        {runConfidenceBand != null && (
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Jakość analizy</p>
            <p style={{ fontSize: 13, margin: 0, color: runConfidenceBand.color, fontWeight: 500 }}>
              {runConfidenceBand.label}
            </p>
            <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '2px 0 0', fontStyle: 'italic' }}>
              na podstawie dostępnych źródeł
            </p>
          </div>
        )}
        {run.missing_data && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 4,
            background: 'var(--color-warning-subtle, #FEF3C7)',
            border: '1px solid var(--color-warning, #F59E0B)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--color-warning, #F59E0B)' }}>
              Brakujące dane — odpowiedz na pytania, aby zwiększyć dokładność
            </span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Do przeglądu</p>
          <p style={{ fontSize: 13, margin: 0 }}>
            {pendingScope} zakresy · {pendingQuestions} pytania · {openRisks} ryzyka
          </p>
        </div>
      </div>

      {/* Scope items */}
      <Section title="Zakres prac" count={scope.length}>
        {scope.map(item => (
          <ScopeItemRow
            key={item.id}
            item={item}
            runId={run.id}
            projectId={projectId}
            companyId={companyId}
            userId={userId}
          />
        ))}
      </Section>

      {/* UX-1: empty state when AI found no scope items */}
      {scope.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '4px 0' }}>
          AI nie wykryło pozycji zakresu dla tego pomieszczenia. Sprawdź jakość zdjęć lub dodaj opis pomieszczenia.
        </p>
      )}

      {/* Questions */}
      <Section title="Pytania do klienta / weryfikacji" count={questions.length}>
        {questions.map(q => (
          <QuestionRow
            key={q.id}
            question={q}
            runId={run.id}
            projectId={projectId}
            companyId={companyId}
            userId={userId}
          />
        ))}
      </Section>

      {/* Risks */}
      <Section title="Ryzyka" count={risks.length}>
        {risks.map(r => (
          <RiskRow
            key={r.id}
            risk={r}
            runId={run.id}
            projectId={projectId}
            companyId={companyId}
            userId={userId}
          />
        ))}
      </Section>

      {/* Sprint 5: review summary bar — visible once run is completed and scope loaded */}
      {run.status === 'completed' && !lScope && (() => {
        const totalItems = scope.length
        if (totalItems === 0) return null

        const acceptedN = scope.filter(s => s.review_status === 'accepted').length
        const modifiedN = scope.filter(s => s.review_status === 'modified').length
        const rejectedN = scope.filter(s => s.review_status === 'rejected').length
        const missingN  = scope.filter(
          s => ['accepted', 'modified'].includes(s.review_status)
            && s.missing_price
            && !s.price_confirmed_by_operator,
        ).length

        return (
          <div
            style={{
              display:      'flex',
              flexWrap:     'wrap',
              gap:           12,
              padding:      '10px 14px',
              borderRadius:  8,
              background:   'var(--color-surface)',
              border:       '1px solid var(--color-border)',
              fontSize:      12,
            }}
          >
            <span style={{ color: 'var(--color-success, #10B981)' }}>
              ✓ {acceptedN + modifiedN} zaakceptowanych
              {modifiedN > 0 && (
                <span style={{ color: 'var(--color-warning, #F59E0B)', marginLeft: 4 }}>
                  ({modifiedN} zmodyfikowanych)
                </span>
              )}
            </span>
            <span style={{ color: 'var(--color-danger, #EF4444)' }}>
              ✗ {rejectedN} odrzuconych
            </span>
            {missingN > 0 && (
              <span style={{ color: 'var(--color-warning, #F59E0B)' }}>
                ⚠ {missingN} {missingN === 1 ? 'pozycja bez ceny' : 'pozycji bez ceny'}
              </span>
            )}
          </div>
        )
      })()}

      {/* Sprint 4: Create Estimate Draft CTA */}
      {run.status === 'completed' && (() => {
        const reviewedItems = scope.filter(
          s => s.review_status === 'accepted' || s.review_status === 'modified',
        )
        if (reviewedItems.length === 0) {
          const allReviewed = scope.length > 0 && scope.every(s => s.review_status !== 'pending')
          if (!allReviewed) return null
          return (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 0' }}>
              Wszystkie pozycje zakresu zostały odrzucone — wycena nie zostanie utworzona.
              Uruchom nową analizę lub zmień decyzje w liście powyżej.
            </p>
          )
        }

        const missingPrices = reviewedItems.filter(s => s.missing_price && !s.price_confirmed_by_operator).length

        return (
          <div
            style={{
              padding:       '16px',
              borderRadius:   8,
              border:        '1px solid var(--color-brand)',
              background:    'var(--color-brand-subtle, rgba(99,102,241,0.06))',
              display:       'grid',
              gap:            10,
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px' }}>
                Utwórz wycenę roboczą z przeglądu AI
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                {reviewedItems.length} {reviewedItems.length === 1 ? 'pozycja' : reviewedItems.length < 5 ? 'pozycje' : 'pozycji'} zaakceptowanych lub zmodyfikowanych
                {missingPrices > 0 && (
                  <span style={{ color: 'var(--color-warning, #F59E0B)', marginLeft: 6 }}>
                    · {missingPrices} {missingPrices === 1 ? 'pozycja bez ceny' : 'pozycji bez ceny'} — uzupełnij w edytorze wyceny
                  </span>
                )}
              </p>
            </div>

            {/* UX-7: pre-click warning about unpriced items */}
            {missingPrices > 0 && !existingEstimate && !createdEstimate && (
              <div style={{
                padding:      '8px 12px',
                borderRadius:  6,
                background:   'var(--color-warning-subtle, #FEF3C7)',
                border:       '1px solid var(--color-warning, #F59E0B)',
                fontSize:      12,
                color:        'var(--color-warning, #F59E0B)',
              }}>
                ⚠ {missingPrices} {missingPrices === 1 ? 'pozycja wymaga ceny' : 'pozycji wymaga ceny'} — wycena zostanie utworzona z ceną 0 zł. Uzupełnij ceny w edytorze wyceny przed wysłaniem do klienta.
              </div>
            )}

            {/* Estimate already exists (DB guard — survives refresh / multi-tab) */}
            {existingEstimate
              ? (
                <p style={{ fontSize: 13, color: 'var(--color-success, #10B981)', margin: 0 }}>
                  Wycena robocza <strong>{existingEstimate.number}</strong> już istnieje dla tego runu AI.
                  {' '}Otwórz zakładkę Wyceny, aby ją edytować.
                </p>
              )
              : createdEstimate
              ? (
                <p style={{ fontSize: 13, color: 'var(--color-success, #10B981)', margin: 0 }}>
                  Wycena robocza <strong>{createdEstimate.number}</strong> utworzona ({createdEstimate.itemCount} pozycji). Otwórz zakładkę Wyceny, aby uzupełnić ceny i wysłać do klienta.
                </p>
              )
              : (
                <button
                  type="button"
                  disabled={createEstimate.isPending}
                  onClick={() => {
                    createEstimate.mutate(
                      { run, scopeItems: scope, companyId, projectId },
                      {
                        onSuccess: result => {
                          setCreatedEstimate({
                            number:    result.estimateNumber,
                            itemCount: result.itemCount,
                          })
                        },
                        onError: (e: unknown) => {
                          console.error('[AiRunReviewPanel] createEstimate failed:', e)
                        },
                      },
                    )
                  }}
                  style={{
                    padding:      '8px 20px',
                    borderRadius:  6,
                    border:       '1px solid var(--color-brand)',
                    background:   'var(--color-brand)',
                    color:        '#fff',
                    fontSize:      13,
                    fontWeight:    600,
                    cursor:        createEstimate.isPending ? 'not-allowed' : 'pointer',
                    opacity:       createEstimate.isPending ? 0.7 : 1,
                    display:      'flex',
                    alignItems:   'center',
                    gap:           6,
                    width:        'fit-content',
                  }}
                >
                  {createEstimate.isPending ? <><Spinner /> Tworzę wycenę…</> : 'Utwórz wycenę roboczą'}
                </button>
              )
            }

            {createEstimate.isError && (
              <p style={{ fontSize: 12, color: 'var(--color-danger, #EF4444)', margin: 0 }}>
                {(() => {
                  const err = createEstimate.error
                  const msg = err instanceof Error ? err.message : String((err as { message?: string } | null)?.message ?? '')
                  const isDup = msg.includes('duplicate key') || msg.includes('23505')
                  return isDup
                    ? 'Wycena dla tego runu już istnieje. Odśwież stronę, aby zobaczyć istniejącą wycenę.'
                    : (msg || 'Nie udało się utworzyć wyceny.')
                })()}
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}
