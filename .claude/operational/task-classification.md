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

## Trivial vs non-trivial (plan threshold)

| Condition | Classification |
|-----------|----------------|
| LOW risk + single-file + obvious fix | **trivial** — proceed directly |
| MEDIUM+ risk OR 3+ steps OR cross-module | **non-trivial** — plan required |
| Any architectural decision | **non-trivial** — plan required |
| Migration + frontend + RLS combined | **non-trivial** — plan required |

For **non-trivial** tasks, orchestrator MUST:
1. Write plan to `tasks/todo.md` before any code
2. Use subagents for research and exploration
3. Re-plan on failure (never push through failures)

## When subagent is required
- Research / exploration of unknown code area → subagent
- Complex parallel analysis (e.g. RLS + frontend + migration simultaneously) → subagents
- Final QA validation → qa-scenario-agent
- Risk assessment for HIGH/CRITICAL → code-guardian

## When Code Guardian is mandatory
- RISK = HIGH or CRITICAL
- Migration that changes or drops data
- RLS policy change that widens access
- Any change to auth flow

## When Flow Architect is mandatory
- Feature that changes how modules connect
- New one-click or multi-step flow
- Changes to sacred flow: estimate → contract → invoice → KSeF → project → portal

## When QA Scenario Agent is mandatory
- Before marking any non-trivial task done
- After any change to client portal access or role visibility
- After any RLS or migration change

## Classification output
After classification, orchestrator states:
```
TYPE: bugfix | RISK: MEDIUM | SCOPE: single-module | AREA: portal
PLAN REQUIRED: yes (non-trivial)
```
Then proceeds to routing.
