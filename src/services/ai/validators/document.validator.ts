// =============================================================================
// document.validator.ts — Deterministic validators for DocumentAnalysisResult
// =============================================================================
// These checks are pure math / structural checks — NOT AI heuristics.
// They run client-side after the engine returns a result.
//
// Critical issues (block handoff):
//   ARITHMETIC_MISMATCH   — net + vat ≠ gross (tolerance ±0.02)
//   IMPOSSIBLE_AMOUNT     — net > gross (financially impossible)
//   NEGATIVE_AMOUNT       — any key amount is < 0
//
// Warnings (require review):
//   GROSS_MISSING         — gross is null (amout can't be confirmed)
//   MISSING_NIP_SELLER    — seller NIP null on vat_invoice
//   MISSING_NIP_BUYER     — buyer NIP null on vat_invoice
//   FUTURE_ISSUE_DATE     — issue_date more than 7 days in the future
//
// Info (surfaced for transparency):
//   MISSING_LINE_ITEMS    — document has no line items (summary-only)
//   MISSING_DOCUMENT_NUMBER — document number not extracted
// =============================================================================

import type { DocumentAnalysisResult } from '../engines/document.types'
import type { ReliabilityIssue }       from '../engines/reliability'

/**
 * Run all deterministic validators on a DocumentAnalysisResult.
 * Returns array of issues, empty when everything checks out.
 */
export function validateDocumentResult(
  result: DocumentAnalysisResult,
): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  issues.push(...validateAmounts(result))
  issues.push(...validateDates(result))
  issues.push(...validateParties(result))
  issues.push(...validateStructure(result))

  return issues
}

// ── Amount validators ─────────────────────────────────────────────────────────

function validateAmounts(result: DocumentAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []
  const { net, vat, gross } = result.amounts

  // NEGATIVE_AMOUNT
  if ((net !== null && net < 0) || (vat !== null && vat < 0) || (gross !== null && gross < 0)) {
    issues.push({
      code: 'NEGATIVE_AMOUNT',
      severity: 'critical',
      message: 'Jedna z kwot (netto, VAT, brutto) jest ujemna — to może być faktura korygująca lub błąd ekstrakcji.',
      field: 'amounts',
    })
  }

  // IMPOSSIBLE_AMOUNT — net > gross is financially impossible for standard docs
  if (net !== null && gross !== null && net > gross + 0.02) {
    issues.push({
      code: 'IMPOSSIBLE_AMOUNT',
      severity: 'critical',
      message: `Kwota netto (${net}) jest wyższa niż brutto (${gross}) — błąd ekstrakcji lub document korygujący.`,
      field: 'amounts',
    })
  }

  // ARITHMETIC_MISMATCH — only when all three values are present
  if (net !== null && vat !== null && gross !== null && gross >= 0) {
    const computedGross = Math.round((net + vat) * 100) / 100
    const diff = Math.abs(computedGross - gross)
    if (diff > 0.02) {
      issues.push({
        code: 'ARITHMETIC_MISMATCH',
        severity: 'critical',
        message: `Netto (${net}) + VAT (${vat}) = ${computedGross}, ale brutto wynosi ${gross} — niezgodność arytmetyczna (różnica: ${diff.toFixed(2)}).`,
        field: 'amounts',
      })
    }
  }

  // GROSS_MISSING
  if (gross === null) {
    issues.push({
      code: 'GROSS_MISSING',
      severity: 'warning',
      message: 'Kwota brutto nie została odczytana — nie można potwierdzić łącznej wartości dokumentu.',
      field: 'amounts.gross',
    })
  }

  return issues
}

// ── Date validators ───────────────────────────────────────────────────────────

function validateDates(result: DocumentAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  if (result.issue_date) {
    const issueTs = Date.parse(result.issue_date)
    if (!isNaN(issueTs)) {
      const futureLimitMs = Date.now() + 7 * 24 * 60 * 60 * 1000
      if (issueTs > futureLimitMs) {
        issues.push({
          code: 'FUTURE_ISSUE_DATE',
          severity: 'warning',
          message: `Data wystawienia (${result.issue_date}) jest silnie w przyszłości — sprawdź, czy AI nie odczytała daty błędnie.`,
          field: 'issue_date',
        })
      }
    }
  }

  return issues
}

// ── Party validators ──────────────────────────────────────────────────────────

function validateParties(result: DocumentAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  const isVatInvoice =
    result.document_subtype === 'vat_invoice' ||
    result.document_subtype === 'advance_invoice' ||
    result.document_subtype === 'corrective_invoice'

  if (!isVatInvoice) return issues

  const seller = result.parties.find(p =>
    p.role === 'seller' || p.role === 'issuer' || p.role === 'supplier',
  )
  const buyer = result.parties.find(p =>
    p.role === 'buyer' || p.role === 'recipient' || p.role === 'customer' || p.role === 'payer',
  )

  if (seller && !seller.nip) {
    issues.push({
      code: 'MISSING_NIP_SELLER',
      severity: 'warning',
      message: 'Brak NIP sprzedawcy na fakturze VAT — może wpłynąć na prawidłowość odliczenia VAT.',
      field: 'parties.seller.nip',
    })
  }

  if (buyer && !buyer.nip) {
    issues.push({
      code: 'MISSING_NIP_BUYER',
      severity: 'warning',
      message: 'Brak NIP nabywcy na fakturze VAT — wymagane dla prawidłowego rozliczenia.',
      field: 'parties.buyer.nip',
    })
  }

  return issues
}

// ── Structural validators ─────────────────────────────────────────────────────

function validateStructure(result: DocumentAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  if (result.line_items.length === 0) {
    issues.push({
      code: 'MISSING_LINE_ITEMS',
      severity: 'info',
      message: 'Brak pozycji szczegółowych — dokument przetworzy jako podsumowanie bez rozbicia na linie.',
      field: 'line_items',
    })
  }

  if (!result.document_number) {
    issues.push({
      code: 'MISSING_DOCUMENT_NUMBER',
      severity: 'info',
      message: 'Numer dokumentu nie został odczytany.',
      field: 'document_number',
    })
  }

  return issues
}
