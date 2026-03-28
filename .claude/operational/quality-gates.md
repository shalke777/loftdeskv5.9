# Quality gates

Automated checks that orchestrator MUST run before reporting task complete.

## Gate 1: TypeScript (mandatory)
```
npx tsc --noEmit
```
Expected: 0 errors.
If fails: fix before proceeding. Do not report done with TS errors.

## Gate 2: Build (mandatory)
```
npm run build
```
Expected: clean build, no errors.
Acceptable: chunk size warnings (info only).
If fails: fix before proceeding.

## Gate 3: Git state (mandatory)
```
git status --short
```
Expected: clean working tree OR only intentional untracked files.
If unclean: commit or clean before reporting done.

## Gate 4: Lint (when available)
```
npm run lint
```
Run if script exists. Warnings acceptable, errors must be fixed.

## Gate 5: Migration safety (when schema tasks)
- Migration file has proper sequential number
- No BEGIN/COMMIT (Supabase Management API incompatible)
- DROP POLICY IF EXISTS before CREATE POLICY
- No destructive operations without explicit human approval

## Gate 6: Diff review (when risk >= HIGH)
```
git diff --stat
```
Verify only expected files changed. Flag unexpected changes.

## Execution order
1. tsc → 2. build → 3. git state → 4. lint (if exists) → 5. migration safety (if applicable) → 6. diff review (if high risk)

## On failure
- Gate 1-2 failure: MUST fix. Do not skip.
- Gate 3 failure: commit or clean. Do not skip.
- Gate 4 failure: fix errors, warnings acceptable.
- Gate 5-6 failure: flag in report, may need human decision.
