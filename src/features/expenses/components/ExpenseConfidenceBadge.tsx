import type { ParseInvoiceResult } from '@/features/expenses/api/expenses.api'

interface Props {
  confidence: ParseInvoiceResult['extraction_confidence']
  warnings?:  ParseInvoiceResult['extraction_warnings']
}

const CONFIG = {
  high:    { icon: '✅', cls: 'exp-ocr-badge exp-ocr-badge--high',    label: 'Dane odczytane — sprawdź i zapisz' },
  partial: { icon: '🔍', cls: 'exp-ocr-badge exp-ocr-badge--partial', label: 'Częściowe rozpoznanie — uzupełnij brakujące pola' },
  empty:   { icon: '✏️', cls: 'exp-ocr-badge exp-ocr-badge--empty',   label: 'Wpisz dane ręcznie — OCR nie odczytał wystarczająco' },
}

export function ExpenseConfidenceBadge({ confidence, warnings }: Props) {
  const level: keyof typeof CONFIG =
    confidence >= 70 ? 'high'
    : confidence >= 30 ? 'partial'
    : 'empty'

  const { icon, cls, label } = CONFIG[level]

  // Filter out only non-obvious warnings (skip the generic field-missing ones that
  // duplicate what the empty field already communicates visually in the form).
  const notable = (warnings ?? []).filter(w =>
    !w.startsWith('Nie rozpoznano') &&
    !w.includes('uzupełnij dane ręcznie')
  )

  return (
    <div className={cls}>
      <span className="exp-ocr-badge__icon">{icon}</span>
      <div className="exp-ocr-badge__body">
        <span className="exp-ocr-badge__label">{label}</span>
        {notable.length > 0 && (
          <ul className="exp-ocr-badge__warnings">
            {notable.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
