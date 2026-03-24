# Task classification

Orchestrator MUST classify every incoming task before routing.

## Classification dimensions

### 1. Type
| Type | Signal | Example |
|------|--------|---------|
| bugfix | error, crash, broken, nie działa, 500, blank screen | "klient nie widzi dokumentów" |
| feature | nowy, dodaj, zbuduj, implement, utwórz | "dodaj export do CSV" |
| refactor | przenieś, usprawnij, wydziel, popraw strukturę | "wydziel hook z komponentu" |
| polish | wygląd, spacing, UX, czytelność, alignment | "popraw dashboard mobile" |
| release | deploy, push, hardening, smoke, production | "przygotuj release v5.10" |
| audit | sprawdź, przeanalizuj, zbadaj, review | "sprawdź RLS portalu" |
| schema | migration, tabela, kolumna, policy, RLS | "dodaj kolumnę status do projects" |
| docs | dokumentacja, instrukcja, opis | "opisz flow kontraktów" |

### 2. Risk level
| Level | Criteria |
|-------|----------|
| LOW | UI-only, no data change, no auth impact, reversible |
| MEDIUM | data query change, new component, minor schema change |
| HIGH | RLS/auth change, migration, multi-table change, KSeF logic |
| CRITICAL | production data, billing, payment, delete operations |

### 3. Scope
| Scope | Criteria |
|-------|----------|
| single-file | one component/query/style touched |
| single-module | one feature area (e.g. invoices) |
| cross-module | spans 2+ feature areas |
| full-stack | frontend + backend + migration |

### 4. Area (map to domain agent)
| Area | Primary agent |
|------|---------------|
| clients / invitations | clients-invitations-agent |
| estimates | estimates-agent |
| contracts | contracts-agent |
| invoices / KSeF | invoices-ksef-agent |
| projects / timeline | projects-agent |
| portal / chat / approvals | client-portal-communication-agent |
| AI extraction / OCR | ai-extraction-agent |
| schema / RLS / auth | supabase-rls-agent |
| UI / mobile / layout | ui-mobile-ux-agent |
| modals | modal-system-agent |
| navigation / menu | navigation-information-architecture-agent |
| notifications / email | notifications-delivery-agent |
| release / deploy | release-environment-agent |
| tiers / access | tier-access-architect |

## Classification output
After classification, orchestrator states:
```
TYPE: bugfix | RISK: MEDIUM | SCOPE: single-module | AREA: portal
```
Then proceeds to routing.
