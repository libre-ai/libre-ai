# Missions

- **Path:** `apps/missions`
- **Purpose:** supervise agent missions, risks, blockers, evidence and human verdicts.
- **Runtime:** Bun/React.
- **Owns:** MissionRecord projection, human approvals and append-only event view.
- **Does not own:** agent execution; the orchestrator and harness do.
- **Critical gates:** fail-closed transitions, optimistic revisions, attributable decisions, immutable event history and strict separation between reported activity and accepted result.
