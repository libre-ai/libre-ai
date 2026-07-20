# agent-runs-v2 — candidate contract review package (K1 enforcement, part a)

- **Status:** candidate, pending independent agent review.
- **Protocol:** `docs/reviews/AGENT-REVIEW-PROTOCOL.md` — role-scoped review passes
  by agents launched **separately** from the implementer (K4).
- **Required independent reviews:** architecture, security.
- **Subject:** `contracts/authz/agent-runs-v2.datalog` + its vector harness
  (`contracts/fixtures/agent-orchestration-v1/authz-vectors.v2.json`,
  `tools/quality/check-agent-orchestration-vectors.ts` `authorizeV2`).

## What this is — closing the K1 enforcement gap (first half)

`authority-v2` (merged #143) added the K1 agent identity facts but honestly
recorded that **nothing enforced them**: `agent-runs-v1` checks
`token_mission` / `resource_mission` and roles, never `agent_fleet` or
`mission_agent`. The security K4 REJECT of the first authority-v2 named the
concrete attack: an agent of fleet `forge` acting on a `product-ops` resource
was allowed because no rule examined the fleet.

`agent-runs-v2` is the successor authorizer (v1 is locked → new major) that
closes the **authorizer half** of that gap. For every **agent-role** allow rule
(`author-agent`, `reviewer-agent`, `mission-service`, `orchestrator`,
`harness`) it additionally requires:

- `agent_fleet($user, $fleet), resource_fleet($fleet)` — the agent's fleet must
  match the resource fleet;
- `mission_agent($user, $mission)` bound to `token_mission` / `resource_mission`
  — the agent must be a member of the operating mission.

Human roles (`operator`, `protected-controller`) use `authority-v1` and are
**unchanged** — they carry no agent facts and no fleet guard.

## Design property: v2 is strictly stronger than v1

`authorizeV2 = authorize (v1) ∧ (for agent roles: fleet match ∧ mission
membership)`. v2 can only ever **deny** what v1 allowed, never allow more. The
11 v1 rules and their 15 vectors are untouched and still pass.

## TDD evidence (RED → GREEN)

The 8 v2 vectors were first run against the v1 authorizer: the 5 deny cases that
depend on the K1 guard (`author-cross-fleet-denied`,
`author-not-mission-member-denied`, `author-missing-fleet-denied`,
`harness-cross-fleet-denied`, `mission-service-cross-fleet-denied`) all returned
`allow` (RED — v1 does not enforce the boundary). Adding `authorizeV2` and the
datalog guard turned them `deny` (GREEN). `author-cross-fleet-denied` is exactly
the attack from the security REJECT.

## Review lenses

- **Architecture:** is v2 a faithful strict refinement of v1 (no v1 rule
  weakened, human roles untouched)? Is the fleet/mission binding correct
  (`token_mission ∈ mission_agent` via shared `$mission`)? Does the TS mirror
  (`authorizeV2`) match the datalog exactly? Is the gate's per-rule guard check
  (every agent-role rule guarded, no human rule guarded) sound?
- **Security:** does every agent-role path now deny cross-fleet and
  non-member-mission operation? Can an agent omit `agent_fleet` / `mission_agent`
  and still authorize (fail-open)? Does the datalog `deny if true` still close
  the policy? Any agent role left unguarded? Does the mirror faithfully encode
  the datalog (a mirror that is laxer than the datalog would hide a real hole)?

## Scope — what is still deferred (part b)

This is the **authorizer** half. The `authz-biscuit` crate wiring — issuing
agent tokens carrying the three K1 facts, injecting `resource_fleet` at the
handler, per-agent_id revocation, consuming `agent-runs-v2` — is the next
increment (part b), independently reviewed. Promotion of `authority-v2` **and**
`agent-runs-v2` `candidate → locked` follows part b and its review.
