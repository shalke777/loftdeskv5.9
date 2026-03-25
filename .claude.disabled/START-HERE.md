# START HERE

## First prompt
Use chief-orchestrator.
Read:
- .claude/constitution.md
- .claude/CLAUDE.md
- .claude/operational/task-classification.md
- .claude/operational/routing-decision-tree.md
- .claude/operational/quality-gates.md
- .claude/operational/needs-human-decision.md
- .claude/operational/report-template.md
- .claude/skills/loftdesk-core/references/product-definition.md
- .claude/skills/loftdesk-core/references/traps.md

Then inspect the repository and produce:
1. architecture map
2. core flow map
3. contractor vs client access map
4. Free vs Pro map
5. modal inventory
6. regression hotspots
7. recommended first action plan

## Agent routing (quick reference)
| Signal | Agent |
|--------|-------|
| strategy / multi-module | chief-orchestrator |
| risky change | code-guardian |
| role/tier/access | tier-access-architect |
| modal consistency | modal-system-agent |
| client login / client base | clients-invitations-agent |
| KSeF / invoice | invoices-ksef-agent |
| DB / RLS / auth | supabase-rls-agent |
| mobile UX | ui-mobile-ux-agent |
| portal / chat / approvals | client-portal-communication-agent |
| estimates | estimates-agent |
| contracts | contracts-agent |
| projects / timeline | projects-agent |
| AI extraction | ai-extraction-agent |
| navigation / menu | navigation-information-architecture-agent |
| notifications | notifications-delivery-agent |
| release / deploy | release-environment-agent |
| bug triage | service-maintenance-agent |

## Autonomous loop
1. Classify → 2. Route → 3. Analyze → 4. Implement → 5. Quality gates → 6. Check escalation → 7. Report
See .claude/operational/ for full details.
