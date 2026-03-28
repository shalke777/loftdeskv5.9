# tasks/todo.md — LoftDesk operational task tracker

## Usage
Write this file BEFORE implementing any non-trivial task.
Non-trivial = MEDIUM+ risk, or 3+ steps, or cross-module, or any architectural decision.
Mark items ✅ as you complete them. Add Verification + Review sections when done.

---

## Template

```
## Task: [title]
Date: YYYY-MM-DD
TYPE: bugfix|feature|refactor|polish|release|audit|schema
RISK: LOW|MEDIUM|HIGH|CRITICAL
SCOPE: single-file|single-module|cross-module|full-stack
AREA: [primary domain]

### Goal
[One sentence: what must be true when this task is done]

### Scope
[What is in scope. What is explicitly out of scope.]

### Root cause / hypothesis
[For bugfix: what is actually broken and why.
For feature: what is missing and where.
For other: what is the real problem being solved.]

### Plan
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
- [ ] Quality gates: tsc + build + git status

### Verification
[How to prove this works. Logs, smoke steps, before/after.]

### Review
[Would an engineer approve this? What did we find during implementation that changed the plan?]
```

---

## Active tasks

*(none — add tasks here when starting non-trivial work)*

---

## Completed tasks

*(move tasks here when done)*
