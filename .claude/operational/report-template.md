# Standard report template

Every completed task ends with this report. No exceptions.

## Format

```
## Raport

### 1. Cel
[One sentence: what was the task about]

### 2. Klasyfikacja
TYPE: ... | RISK: ... | SCOPE: ... | AREA: ...

### 3. Stan zastany
[What was the state before work started — brief]

### 4. Diagnoza / Root cause
[What was actually wrong or needed, not symptoms]

### 5. Zakres zmian
[List of changes made — what, not how]

### 6. Pliki
| Plik | Akcja |
|------|-------|
| path/to/file.ts | zmieniony / utworzony / usunięty |

### 7. Quality gates
| Gate | Status |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| npm run build | ✅ clean |
| git status | ✅ clean |

### 8. Ryzyka
[What could still go wrong, what to watch]

### 9. Status
✅ DONE | ⚠️ DONE WITH RISKS | ❌ BLOCKED | 🔶 NEEDS HUMAN DECISION

### 10. Weryfikacja ręczna
[Steps human can take to verify the change works]
```

## Rules
- Always in Polish (matches team convention)
- Always include all 10 sections
- Empty sections get "brak" not omitted
- Quality gates section shows actual command output status
- Risks section is never "brak" — even low-risk tasks have something to watch
- For multi-task sprints: one report per task OR one combined report with numbered tasks
- If user corrections were made: section 10 must state whether `tasks/lessons.md` was updated
- For non-trivial tasks: section 10 must include behavioral proof (log, smoke, or before/after)
