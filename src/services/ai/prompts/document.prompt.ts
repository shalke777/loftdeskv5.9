// =============================================================================
// Document Prompt — extraction instructions for the Document Understanding Engine
// =============================================================================
// Designed for: invoices (faktury VAT), receipts (paragony), formal documents
//               (umowy, protokoły), cost notes (noty kosztowe, kosztorysy).
//
// Key principles:
//   - parties[] with explicit roles — never hardcoded "sprzedawca/kupujący" labels
//   - amounts always net + vat + gross (no partial fields)
//   - category_hints for automatic expense categorization
//   - vendor_match_hint normalized for fuzzy lookup
//   - null preference over guessing
// =============================================================================

export const DOCUMENT_SYSTEM_PROMPT = `Jesteś ekspertem od analizy dokumentów finansowych i biznesowych dla polskich firm budowlano-remontowych.

Wyodrębniasz dane z dokumentów: faktur VAT, paragonów, protokołów, umów, not kosztowych i innych.

ZASADY OGÓLNE:
- Zawsze wybieraj null zamiast zgadywać
- Kwoty: wyodrębnij WSZYSTKIE trzy: netto, VAT, brutto. Jeśli jeden jest podany a drugich nie widać, oblicz z podanej stawki VAT
- Waluta: domyślna PLN, zmień tylko gdy wyraźnie widoczna inna
- NIP: wyodrębnij TYLKO cyfry (bez kresek, spacji, prefiksu PL)
- Numer dokumentu: przepisz dokładnie, zachowaj format oryginału
- Daty: format ISO 8601 (YYYY-MM-DD)
- IBAN: przepisz dokładnie łącznie z kodem kraju (np. PL61...)

ZASADY STRON (parties):
Każda strona dokumentu ma ROLĘ. Użyj odpowiedniej roli zamiast etykiet "sprzedawca/kupujący":
- seller: firma wystawiająca fakturę / sprzedawca towarów
- buyer: nabywca towaru / usługi (kupujący)
- issuer: wystawca dokumentu nie-handlowego (np. protokołu)
- recipient: odbiorca dokumentu nie-handlowego
- supplier: dostawca usług lub materiałów (bez fakturowania)
- customer: zamawiający (w kontekście zamówień/umów)
- payer: płatnik jeśli różni się od nabywcy
- contractor: wykonawca (umowy o roboty budowlane, dzieło, zlecenie)
- principal: zleceniodawca

Na jednym dokumencie może być kilka stron z różnymi rolami.

SUGESTIE KATEGORYZACJI (category_hints):
Zaproponuj 1-4 tagi opisujące co kupiono/zapłacono, np:
- materials: materiały budowlane, płytki, farby, cement, drewno
- tools: narzędzia, wynajem sprzętu
- transport: transport, dostawca, kurier
- subcontractor: podwykonawca, usługi zewnętrzne
- labor: robocizna, usługi montażowe
- fuel: paliwo, gaz
- insurance: ubezpieczenie
- office: biuro, artykuły biurowe, oprogramowanie
- utility: media, prąd, woda, internet
- rental: wynajem lokalu, sprzętu
Analizuj pozycje z dokumentu (line_items) i treść — nie bazuj tylko na nazwie firmy.

VENDOR_MATCH_HINT:
Normalizuj nazwę firmy wystawcy/sprzedawcy do formy przydatnej do fuzzy-matchingu:
- usuń formy prawne: "Sp. z o.o.", "S.A.", "sp.k.", "s.c.", "P.H.U.", "F.H.U."
- usuń znaki specjalne, zbędne słowa
- zamień na lowercase
- przykład: "Elektrobudowa Sp. z o.o." → "elektrobudowa"

PROJECT_MATCH_HINT:
Szukaj w treści dokumentu wzmianki o nazwie projektu, numerze zlecenia, adresie budowy.
Przykłady: "ul. Kowalska 15", "projekt kitchen-2024", "zlecenie nr 123/2024"
Zwróć null jeśli brak.

Zwróć TYLKO poprawny JSON zgodny z podanym schematem.`

/** Nullable string helper */
const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] }
/** Nullable number helper */
const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] }
/** Nullable boolean helper */
const nb = { anyOf: [{ type: 'boolean' }, { type: 'null' }] }

const PARTY_SCHEMA = {
  type: 'object',
  properties: {
    role:    { type: 'string', enum: ['seller', 'buyer', 'issuer', 'recipient', 'supplier', 'customer', 'payer', 'contractor', 'principal'] },
    name:    ns,
    nip:     ns,
    address: ns,
    iban:    ns,
    email:   ns,
    phone:   ns,
  },
  required: ['role', 'name', 'nip', 'address', 'iban', 'email', 'phone'],
  additionalProperties: false,
}

const LINE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name:         ns,
    quantity:     nn,
    unit:         ns,
    unit_net:     nn,
    vat_rate:     nn,
    net_amount:   nn,
    vat_amount:   nn,
    gross_amount: nn,
  },
  required: ['name', 'quantity', 'unit', 'unit_net', 'vat_rate', 'net_amount', 'vat_amount', 'gross_amount'],
  additionalProperties: false,
}

/** JSON schema for DocumentAnalysisResult structured output */
export const DOCUMENT_RESPONSE_SCHEMA = {
  type:   'json_schema',
  name:   'document_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      document_type:    { type: 'string', enum: ['invoice', 'receipt', 'formal_document', 'cost_note', 'other'] },
      document_subtype: { anyOf: [{ type: 'string', enum: ['vat_invoice', 'simplified_invoice', 'proforma', 'receipt', 'fiscal_receipt', 'advance_invoice', 'corrective_invoice', 'bill', 'cost_note', 'agreement', 'protocol', 'delivery_note', 'other'] }, { type: 'null' }] },
      parties:          { type: 'array', items: PARTY_SCHEMA },
      document_number:  ns,
      issue_date:       ns,
      sale_date:        ns,
      line_items:       { type: 'array', items: LINE_ITEM_SCHEMA },
      amounts: {
        type: 'object',
        properties: { net: nn, vat: nn, gross: nn, currency: { type: 'string' }, vat_rate: nn },
        required: ['net', 'vat', 'gross', 'currency', 'vat_rate'],
        additionalProperties: false,
      },
      payment: {
        type: 'object',
        properties: { method: ns, due_date: ns, iban: ns, paid: nb },
        required: ['method', 'due_date', 'iban', 'paid'],
        additionalProperties: false,
      },
      category_hints:     { type: 'array', items: { type: 'string' } },
      vendor_match_hint:  ns,
      project_match_hint: ns,
      notes:              ns,
      warnings:           { type: 'array', items: { type: 'string' } },
      confidence:         { type: 'number' },
    },
    required: [
      'document_type', 'document_subtype', 'parties', 'document_number',
      'issue_date', 'sale_date', 'line_items', 'amounts', 'payment',
      'category_hints', 'vendor_match_hint', 'project_match_hint',
      'notes', 'warnings', 'confidence',
    ],
    additionalProperties: false,
  },
}
