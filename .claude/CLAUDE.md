# LoftDesk operating instructions

Read first:
- .claude/constitution.md
- .claude/skills/loftdesk-core/references/product-definition.md
- .claude/skills/loftdesk-core/references/traps.md

Read before every task:
- .claude/operational/task-classification.md
- .claude/operational/routing-decision-tree.md
- .claude/operational/quality-gates.md
- .claude/operational/needs-human-decision.md
- .claude/operational/report-template.md
- .claude/operational/handoff-protocol.md
- .claude/operational/definition-of-done.md

## Product truth
LoftDesk is a Poland-only shared contractor-client app.
It manages the full job process in one system.

## Autonomous workflow
1. Classify task (type / risk / scope / area)
2. Route to agent chain per routing-decision-tree.md
3. Analyze → plan → implement (smallest safe scope)
4. Run quality gates (tsc + build + git status) — fix before reporting done
5. Check needs-human-decision.md — escalate or proceed
6. Report in standard format (report-template.md, 10 sections, Polish)

## Required output on non-trivial tasks
Use report-template.md format (10 sections).
Legacy A-J format is superseded.

## Hard rules
- treat client portal as core
- treat KSeF as real local requirement
- preserve Free simplicity
- use domain and modal agents before large edits
- let Code Guardian review risky plans
- never report "done" with tsc errors or build failures
- escalate when needs-human-decision criteria are met
