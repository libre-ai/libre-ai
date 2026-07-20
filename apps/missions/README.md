# @libre-ai/missions

Layer-2 human cockpit for proposing, risk-assessing, reviewing, observing and
validating bounded agent missions, keeping reported activity distinct from a
validated result. Spec: `docs/apps/missions.md`. Work package: `WP-G3-A01`.

## Status

Increment 1 — the **v1 domain** (`src/domain/mission.ts`): the mission
aggregate and its fail-closed, revisioned state machine (15 commands → 13
events, refusal matrix), the human-approver baseline. The v2 two-agent-reviewer
protocol is a locked, **unimplemented** contract and is deliberately absent.

Pure domain only: no persistence, UI, authorization or orchestrator yet. Per
the spec's runtime boundaries, Missions may use contract fixtures for
domain/UI tests but cannot start a real mission or claim orchestrator
integration until a bounded implementation work package and conformance review
are approved.

### Next increments (tracked)

1. persistence / RLS via `packages/data`;
2. human cockpit UI + accessibility (`Bun.serve`, React 19);
3. authorization integration (`contracts/authz/missions-v1.datalog`) + revocation;
4. adversarial qualification (cross-tenant, self-review, role-confusion, replay).

## Test

```
bun test
```
