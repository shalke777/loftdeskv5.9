import type { ParseInvoiceResult } from '@/features/expenses/api/expenses.api'

interface Props {
  confidence: ParseInvoiceResult['extraction_confidence']
  warnings?:  ParseInvoiceResult['extraction_warnings']
}

const CONFIG = {
  high:    { icon: '✅', cls: 'exp-ocr-badge exp-ocr-badge--high',    label: 'Dane odczytane — sprawdź i zapisz' },
  partial: { icon: '🔍', cls: 'exp-ocr-badge exp-ocr-badge--partial', label: 'Częściowe rozpoznanie — uzupełnij brakujące pola' },
  weak:    { icon: '⚠️', cls: 'exp-ocr-badge exp-ocr-badge--partial', label: 'Słaby odczyt — sprawdź każde pole przed zapisem' },
  empty:   { icon: '✏️', cls: 'exp-ocr-badge exp-ocr-badge--empty',   label: 'Wpisz dane ręcznie — brak wystarczającego odczytu' },
}

export function ExpenseConfidenceBadge({ confidence, warnings }: Props) {
  const level: keyof typeof CONFIG =
    confidence >= 70 ? 'high'
    : confidence >= 45 ? 'partial'
    : confidence >= 15 ? 'weak'
    : 'empty'

  const { icon, cls, label } = CONFIG[level]

  // Show ALL actionable warnings — including "Nie rozpoznano X" which tell the user
  // exactly what fields are missing. Only suppress the generic manual-entry fallback.
  const notable = (warnings ?? []).filter(w =>
    !w.includes('uzupełnij dane ręcznie') &&
    !w.startsWith('Brak pliku')
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
