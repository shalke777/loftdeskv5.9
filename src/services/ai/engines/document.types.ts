// =============================================================================
// Document Understanding Engine — result types
// =============================================================================
// Represents the output of the document analysis engine.
// Used for: invoices (faktura VAT), receipts (paragon), formal documents
//           (umowy, protokoły), cost notes (noty kosztowe, kosztorysy).
//
// Key design decisions:
//   - parties[] with explicit roles — never hardcoded "sprzedawca/kupujący"
//   - amounts as structured sub-object (not flat top-level fields)
//   - category_hints for automatic expense categorization
//   - vendor_match_hint & project_match_hint for automatic linking
// =============================================================================

/** Role a party plays in the document — bidirectional, avoids PL/EN label coupling */
export type PartyRole =
  | 'seller'       // sprzedawca
  | 'buyer'        // nabywca
  | 'issuer'       // wystawca (of formal doc, not same as seller)
  | 'recipient'    // odbiorca
  | 'supplier'     // dostawca (usług lub towarów)
  | 'customer'     // zamawiający
  | 'payer'        // płatnik (może różnić się od nabywcy)
  | 'contractor'   // wykonawca (umowy, zlecenia budowlanego)
  | 'principal'    // zleceniodawca

export interface Party {
  role:     PartyRole
  name:     string | null
  nip:      string | null
  address:  string | null
  iban?:    string | null
  email?:   string | null
  phone?:   string | null
}

/** Sub-type of the document — more precise than the top-level category */
export type DocumentSubtype =
  | 'vat_invoice'          // faktura VAT
  | 'simplified_invoice'   // faktura uproszczona (≤450 PLN, bez NIP nabywcy)
  | 'proforma'             // proforma
  | 'receipt'              // paragon (fiskalny lub zwykły)
  | 'fiscal_receipt'       // paragon z drukarki fiskalnej
  | 'advance_invoice'      // faktura zaliczkowa
  | 'corrective_invoice'   // faktura korygująca
  | 'bill'                 // rachunek (non-VAT)
  | 'cost_note'            // nota kosztowa / zestawienie
  | 'agreement'            // umowa o dzieło, zlecenie, o roboty budowlane
  | 'protocol'             // protokół odbioru, zdawczo-odbiorczy
  | 'delivery_note'        // WZ / dokument dostawy / packing list
  | 'other'

export interface DocumentAmount {
  net:       number | null
  vat:       number | null
  gross:     number | null
  currency:  string           // 'PLN' default
  vat_rate?: number | null    // dominant VAT rate if uniform (e.g. 23)
}

export interface PaymentInfo {
  method?:   string | null      // 'przelew' | 'gotówka' | 'karta' | 'blik' | etc.
  due_date?: string | null      // ISO date
  iban?:     string | null
  paid?:     boolean | null
}

export interface DocumentLineItem {
  name:         string | null
  quantity:     number | null
  unit:         string | null
  unit_net:     number | null
  vat_rate:     number | null
  net_amount:   number | null
  vat_amount:   number | null
  gross_amount: number | null
}

/**
 * Result produced by the Document Understanding Engine.
 *
 * Intentionally separated from RoomAnalysisResult — no shared envelope,
 * no optional sections that may or may not exist depending on input type.
 */
export interface DocumentAnalysisResult {
  // Top-level classification
  document_type:    'invoice' | 'receipt' | 'formal_document' | 'cost_note' | 'other' | null
  document_subtype: DocumentSubtype | null

  // Parties — use roles, not hardcoded seller/buyer labels
  parties: Party[]

  // Core document metadata
  document_number: string | null
  issue_date:      string | null
  sale_date?:      string | null

  // Line items (may be empty for summary-only docs)
  line_items: DocumentLineItem[]

  // Overall amounts
  amounts: DocumentAmount

  // Payment
  payment: PaymentInfo

  // Context hints — used by automatic expense categorization
  category_hints:      string[]          // e.g. ['materials', 'transport', 'subcontractor', 'tool_rental']
  vendor_match_hint:   string | null     // normalized company name for fuzzy vendor lookup
  project_match_hint:  string | null     // project number / name detected in document body

  // Metadata
  notes?:      string | null
  warnings:    string[]
  confidence:  number           // 0–100 overall extraction confidence

  // Raw content — for debugging / reprocessing
  raw_text?:   string | null
}
