# tasks/lessons.md — LoftDesk agent self-improvement log

## Purpose
After any user correction, rejection, or re-do: add an entry here.
Re-read this file at the start of every new task session.
Rules must be ruthlessly repeated until error rate drops.

---

## Template

```
### Lesson [N] — [short title]
Date: YYYY-MM-DD
Task type: bugfix|feature|schema|...
Area: portal|invoices|RLS|...

**Mistake**
[What the agent did wrong]

**True root cause**
[Why it happened — not the symptom]

**Early signal**
[What was available that should have triggered a different approach]

**Rule to avoid repetition**
[Specific, actionable rule. One sentence max.]
```

---

## Lessons

### Lesson 1 — Migration 065: DROP POLICY on non-existent table
Date: 2026-03-27
Task type: schema
Area: RLS / portal

**Mistake**
Migration 065 used bare `DROP POLICY IF EXISTS` on `project_documents` without checking if the table exists. This threw `42P01: relation does not exist` on databases where migration 018 had not run.

**True root cause**
PostgreSQL's `DROP POLICY IF EXISTS` suppresses "policy not found" but NOT "table not found". The guard only covers the policy, not the table existence.

**Early signal**
The table was conditionally created in migration 018 — any policy referencing it should have been equally conditional. Migration 025 (same codebase) already uses `IF EXISTS (SELECT 1 FROM information_schema.tables ...)` for exactly this reason.

**Rule to avoid repetition**
Always wrap `DROP POLICY` and `CREATE POLICY` in a `DO $$ IF EXISTS (table check) $$` block when the table was created in a prior migration that may not have run on all databases.

---

### Lesson 2 — project_photo_docs missing created_at column
Date: 2026-03-27
Task type: schema / bugfix
Area: portal / client documents

**Mistake**
`listPhotoDocs` selected `created_at` from `project_photo_docs`. The column was never defined in migration 017 (table creation). This caused a silent `42703` error for every client viewing the Documents tab.

**True root cause**
The table schema in migration 017 was checked after the query was written, not before. The query assumed the column existed by analogy with other tables.

**Early signal**
Migration 017 creates the table — reading it before writing the SELECT would have immediately revealed the column was missing.

**Rule to avoid repetition**
Before writing a SELECT query against any table, read the migration that created it and verify each selected column exists. Do not assume columns by analogy.
