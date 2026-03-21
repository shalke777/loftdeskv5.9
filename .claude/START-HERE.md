# START HERE

## First prompt
Use chief-orchestrator.
Read:
- .claude/constitution.md
- .claude/CLAUDE.md
- .claude/skills/loftdesk-core/references/product-definition.md
- .claude/skills/loftdesk-core/references/traps.md
- .claude/prompts/repo-audit.md

Then inspect the repository and produce:
1. architecture map
2. core flow map
3. contractor vs client access map
4. Free vs Pro map
5. modal inventory
6. regression hotspots
7. recommended first action plan

## Agent routing
- strategy / multi-module => chief-orchestrator
- risky change => code-guardian
- role/tier/access => tier-access-architect
- modal consistency => modal-system-agent
- invited client login / client base => clients-invitations-agent
- KSeF/invoice => invoices-ksef-agent
- DB/RLS/auth => supabase-rls-agent
- obvious mobile UX => ui-mobile-ux-agent
