# Definition of done

A task is DONE only when ALL applicable gates pass.

## Universal gates (every task)
- [ ] Root cause identified (not symptom-patched)
- [ ] Implementation matches smallest safe scope
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → clean (no errors, no new warnings)
- [ ] No unrelated files changed
- [ ] Report delivered in standard format

## Non-trivial task gates (MEDIUM+ risk OR 3+ steps)
- [ ] Plan written to `tasks/todo.md` BEFORE implementation
- [ ] Plan confirmed sound before proceeding
- [ ] Subagents used for research/exploration where applicable
- [ ] Behavioral proof provided (log, smoke, or before/after)
- [ ] "Would an engineer approve this?" answered yes

## After user correction
- [ ] `tasks/lessons.md` updated with: mistake, root cause, early signal, rule
- [ ] Lessons re-read at start of next session

## Type-specific gates

### bugfix
- [ ] Root cause confirmed (not guessed)
- [ ] Fix tested against original symptom
- [ ] Adjacent regressions checked
- [ ] Affected flow still works end-to-end

### feature
- [ ] Product-constitution fit confirmed
- [ ] Tier placement decided (Free/Pro/Business)
- [ ] Role visibility decided (contractor/client)
- [ ] Flow impact mapped
- [ ] Modal consistency maintained (if applicable)
- [ ] Mobile-safe

### schema / migration
- [ ] Migration file created with proper numbering
- [ ] RLS policies reviewed
- [ ] Backward compatibility confirmed
- [ ] Frontend queries match new schema
- [ ] Migration applied to production (or flagged for manual apply)

### release
- [ ] All type-check and build gates pass
- [ ] Git working tree clean
- [ ] All commits pushed
- [ ] Deploy triggered and verified
- [ ] Post-deploy smoke passed

### polish / UI
- [ ] Visual change matches guidance
- [ ] Mobile tested (conceptually or via responsive check)
- [ ] No layout regression on adjacent screens

## Git gates
- [ ] Commit messages follow convention: `type(scope): description`
- [ ] No untracked temp files left
- [ ] Working tree clean after task completion
