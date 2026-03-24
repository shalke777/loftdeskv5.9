# Routing decision tree

After classification, orchestrator selects execution path.

## Decision logic

```
IF risk == CRITICAL:
  → code-guardian FIRST (risk review)
  → THEN route to domain agent
  → THEN qa-scenario-agent (validation)
  → needs-human-decision before apply

IF risk == HIGH:
  → code-guardian (risk review)
  → domain agent (analysis + plan)
  → orchestrator merges + executes
  → qa-scenario-agent (post-check)

IF risk == MEDIUM:
  → domain agent (analysis + implementation)
  → quality-gates (tsc + build)
  → orchestrator reports

IF risk == LOW:
  → direct implementation
  → quality-gates (tsc + build)
  → orchestrator reports
```

## Type-specific chains

### bugfix
1. service-maintenance-agent → severity + routing
2. domain agent → root cause + fix
3. code-guardian → if risk >= HIGH
4. quality-gates
5. report

### feature
1. product-constitution-keeper → fit check
2. tier-access-architect → Free/Pro placement
3. flow-architect → flow impact
4. domain agent → implementation
5. modal-system-agent → if modal involved
6. quality-gates
7. qa-scenario-agent → scenarios
8. report

### refactor
1. code-guardian → scope safety
2. domain agent → implementation
3. quality-gates
4. report

### polish (UI/UX)
1. ux-modern-apps → friction analysis
2. visual-design-director → visual guidance
3. frontend-specialist → implementation (via orchestrator)
4. ui-mobile-ux-agent → mobile check
5. quality-gates
6. report

### release
1. release-environment-agent → readiness
2. code-guardian → risk scan
3. quality-gates (full)
4. report

### schema
1. supabase-rls-agent → analysis + migration
2. code-guardian → risk review
3. domain agent → frontend impact
4. quality-gates
5. report

### audit
1. relevant domain agents → analysis
2. qa-scenario-agent → scenarios
3. report (no implementation unless requested)

## Multi-area routing
When task spans 2+ areas:
1. Classify primary area → lead agent
2. Identify secondary areas → supporting agents
3. Lead agent analyzes first
4. Supporting agents validate their scope
5. Orchestrator merges into single plan
6. Single implementation pass (not per-agent)

## Sprint mode (multiple tasks)
When user sends multiple tasks in one request:
1. Classify each task independently
2. Sort by: CRITICAL → HIGH → MEDIUM → LOW risk
3. Group by area where possible (batch same-module work)
4. Execute sequentially (one task at a time)
5. Quality-gates after each task
6. Single combined report at end
