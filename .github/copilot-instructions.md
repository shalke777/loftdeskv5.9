# LoftDesk repository instructions for GitHub Copilot

You are working in the LoftDesk codebase.

## Product truth
LoftDesk is not a generic invoicing app.
It is a workflow, documentation, and communication platform for Polish construction, renovation, and finishing companies.
Core areas include:
- dashboard
- contractors
- estimates
- contracts
- invoices
- KSeF
- projects
- project timeline and documentation
- chat / client portal
- costs / invoice OCR / AI assistance

## Technical stack
- React
- Vite
- JavaScript / JSX / TypeScript where present
- Supabase
- Netlify
- PostgreSQL
- RLS
- Tailwind and custom UI primitives
- GitHub
- Playwright where available

## Working style
- Prefer root-cause analysis before code edits.
- Prefer minimal safe changes over large rewrites.
- Keep the existing project structure unless a structural change is required.
- Preserve business logic and one-click flows.
- For every non-trivial task, think in this order:
  1. diagnosis
  2. scope
  3. implementation
  4. self-review
  5. verification

## UX rules
- Mobile clarity matters.
- Avoid noisy UI.
- Improve spacing, hierarchy, compactness, readability, and alignment.
- Keep visuals subtle, refined, and production-ready.
- Dashboard actions should be direct and obvious.
- Every important screen should make the next action obvious.
- Reduce cognitive overload before adding more options.
- Prefer modern SaaS ergonomics: clear entry points, visible states, predictable actions, low-friction forms.
- Premium visual quality matters: alignment, density, rhythm, contrast, and calm hierarchy.

## Data / backend rules
- Always consider multi-tenant isolation.
- Never break existing queries silently.
- If schema changes are needed, explain migration impact clearly.
- Consider RLS, auth, service-role usage, and backward compatibility.
- KSeF-related logic is business-critical.

## Implementation format
For major tasks, return:
1. Goal
2. Diagnosis
3. Files touched
4. Plan
5. Implementation
6. Self-review
7. Manual verification checklist

## Code quality
- Output production-ready code.
- Avoid pseudo-code unless explicitly requested.
- Keep diffs readable.
- Prefer explicitness over cleverness.
- Add comments only where they genuinely help.

## Do not
- Do not delete unrelated code.
- Do not invent architecture that is not needed.
- Do not rename broad areas without reason.
- Do not assume data shape without checking nearby code.

## Agent system
This repo has a full agent system. See:
- `.claude/operational/` — task classification, routing, quality gates, report template, escalation rules
- `.claude/agents/` — 28 specialized agents (Claude Code)
- `.github/agents/` — 7 Copilot agents (orchestrator, backend, frontend, qa, product, visual, ux)
- `.github/prompts/` — reusable prompt templates (full-delivery, bugfix, feature, release, sprint-batch, ui-ux)

For non-trivial tasks, the orchestrator classifies, routes, implements, validates, and reports autonomously.
Quality gates (tsc + build + git clean) are mandatory before reporting done.
