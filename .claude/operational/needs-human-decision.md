# Needs-human-decision rules

Agent MUST stop and escalate to human when any of these conditions apply.

## Always escalate

### Data destruction
- DROP TABLE, DROP COLUMN, TRUNCATE
- DELETE without WHERE clause
- Any migration that removes data irreversibly

### Production operations
- Direct production DB modifications (outside migration flow)
- git push --force
- git reset --hard
- Deleting branches that may have unmerged work

### Business logic ambiguity
- Task requires choosing between two valid business approaches
- Feature placement unclear (Free vs Pro vs Business)
- KSeF logic change with legal implications
- Billing / payment flow change

### Scope uncertainty
- Task description is vague and two interpretations lead to different implementations
- Estimated scope exceeds 10 files or 3 modules
- Task conflicts with existing architecture and requires structural decision

### Security
- Auth flow changes
- RLS policy changes that widen access (not restrict)
- New public API endpoints
- Service-role key usage changes

### External systems
- KSeF API contract changes
- Stripe integration changes
- Email template changes that affect customer-facing content

## Proceed autonomously

### Safe to proceed without asking
- UI-only changes within existing patterns
- Bug fix with clear root cause and single-file fix
- Adding missing TypeScript types
- Fixing lint/tsc errors
- Build fixes
- Adding RLS policies that RESTRICT access (never widen)
- Refactoring within single module (no API change)
- Improving existing component layout/spacing
- Running quality gates
- Git commit and push to main (when gates pass)
- Creating migration that adds columns/tables (non-destructive)

## Escalation format
When escalating, agent reports:
```
⚠️ NEEDS HUMAN DECISION

Task: [task description]
Blocker: [what requires decision]
Option A: [first approach + tradeoffs]
Option B: [second approach + tradeoffs]
Recommendation: [agent's preference if any]
Risk if wrong choice: [impact]
```
