# Handoff protocol

Standard for how subagents return results to orchestrator.

## Subagent return format

Every subagent called by orchestrator MUST return:

```
AGENT: [agent name]
VERDICT: SAFE / RISKY / BLOCKED / NEEDS-INFO

FINDINGS:
- [finding 1]
- [finding 2]

AFFECTED FILES:
- [file path 1]
- [file path 2]

RECOMMENDED ACTION:
[what orchestrator should do with this analysis]

RISKS:
- [risk 1]
- [risk 2]
```

## Orchestrator responsibilities after handoff

1. Collect all subagent returns
2. Check for conflicts between subagent recommendations
3. If conflict: resolve by prioritizing safety (code-guardian wins ties)
4. Merge into single implementation plan
5. Execute plan
6. Run quality gates
7. Report using standard template

## Subagent scope boundaries

Each subagent operates ONLY within its domain:
- supabase-rls-agent: schema, policies, queries — NOT UI
- ui-mobile-ux-agent: layout, spacing, mobile — NOT data
- code-guardian: risk assessment — NOT implementation
- qa-scenario-agent: test scenarios — NOT implementation
- domain agents: their module — NOT other modules

If a subagent discovers an issue outside its scope:
→ flag it in FINDINGS with "OUTSIDE MY SCOPE: [description]"
→ orchestrator routes to correct agent

## Parallelization

Independent subagent analyses CAN run in parallel:
- code-guardian + domain agent (different concerns)
- ux-modern-apps + visual-design-director (complementary)

Sequential (MUST wait):
- code-guardian BEFORE implementation
- implementation BEFORE qa-scenario-agent
- quality-gates AFTER implementation
