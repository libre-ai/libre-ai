# Authority v2 — candidate contract review package (K1 agent identity)

- **Status:** candidate, pending independent agent review.
- **Protocol:** `docs/reviews/AGENT-REVIEW-PROTOCOL.md` — role-scoped review passes
  by agents launched **separately** from the implementer (K4).
- **Required independent reviews:** architecture, security.
- **Subject:** `contracts/authz/authority-v2.datalog`.

## What this is (loop-security kernel K1, realized at the wave-3 lock)

The G1 authority template (`authority-v1.datalog`) binds `user`, `tenant`,
`role` and expiry — humans and browser sessions. It never expressed agent-fleet
identity. The wave-3 orchestrator lock (pronounced) opens real agent execution;
`authority-v2` extends the template with the K1 agent identity taxonomy:

- `agent_fleet(agent, fleet)` — every agent belongs to exactly one fleet;
- `capability_scope(agent, capability)` — the explicit permission vector (which
  tools, which write paths; never CI/gates by default);
- `check if agent_fleet($agent, $fleet)` — an agent token must carry its
  identity, or it has no authority.

Mission binding is already carried by `token_mission` in the agent-runs
authorizer; per-agent_id revocation (fail-closed) and cross-fleet/mission deny
are enforced by the `authz-biscuit` crate and the agent-runs policy, not the
block — the datalog notes point there.

## Review lenses

- **Architecture:** fit with `authority-v1` (v2 is a distinct major version;
  human/session tokens stay on v1), with the agent-runs authorizer and the K1
  spec (`docs/specifications/LOOP-SECURITY-KERNEL.md`); the boundary between what
  the block expresses and what the crate enforces.
- **Security:** does the block, as written, actually bind an agent to its fleet
  and force identity? Can an agent token omit `agent_fleet` and still authorize?
  Is `capability_scope` meaningfully constraining or decorative here? Are the
  enforcement notes (per-agent revocation fail-closed, cross-fleet deny) the
  right division of labour, and are they truly enforced downstream (or is this a
  gap)? No CI/gate write by default.

## Scope of this increment

Contract-first: this candidate is the K1 taxonomy **contract**. The
`authz-biscuit` crate wiring (issuing agent tokens with these facts, per-agent
revocation, the authorizer using `agent_fleet`/`capability_scope`) is the
subsequent increment(s), each independently reviewed. Promotion candidate→locked
follows the crate integration + its review.
