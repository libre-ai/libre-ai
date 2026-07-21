# @libre-ai/specifications

The specifications app produces accepted, content-addressed **spec packages** —
the immutable record of a problem, its requirements, decisions, contracts, risks,
acceptance criteria and independent approvals that gates downstream execution.

Work package: `WP-G3-F01`.

## Increment 3 — spec-workspace persistence (PostgreSQL / RLS)

`migrations/0001_specifications.sql` and `src/persistence/spec-workspace-store.ts`
persist the spec-workspace behind the tenant barrier (`packages/data`). The domain
is command-sourced — `decide` exposes no event reducer — so the aggregate is
stored as a **revisioned snapshot**, not an event-sourced fold; the event table is
an append-only audit trail beside it.

- **`spec_workspaces`** holds one snapshot per workspace: a `tenant_id`-format
  `CHECK`, `FORCE` row-level security keyed on the `app.tenant_id` GUC, and a grant
  of `SELECT, INSERT, UPDATE` only — **no `DELETE`**, because a workspace is
  advanced and superseded in place, never physically removed. `status` is lifted to
  its own enum-checked column as a queryable DB floor; the full `WorkspaceState`
  lives in the `state` jsonb.
- **`spec_workspace_events`** is **append-only** (grant of `SELECT, INSERT` only):
  the authoring history is never rewritten even by the application role. It is an
  audit trail, not a replay source — the snapshot is the source of truth. Its
  composite key `(tenant_id, workspace_id, sequence)` with the invariant
  `sequence === revision` (one event per accepted `decide`) makes a duplicate
  append at an already-recorded revision conflict on the primary key rather than
  silently double-record.
- **`saveWorkspace`** persists the next snapshot and appends its events atomically
  in the caller's tenant transaction. `revision === 1` inserts; otherwise the
  update is guarded by the previous revision (`revision - 1`) and raises
  `SpecWorkspaceRevisionConflictError` if it matched no row — a lost optimistic-
  concurrency race writes **nothing** (the guarded update runs before any event
  insert). **`loadWorkspace`** / **`loadWorkspaceEvents`** read within the active
  tenant context; RLS alone scopes them, so a foreign-tenant id returns no row.

Verified against the real PostgreSQL barrier (PGlite): round-trip, revisioned
advance, stale-revision rejection, cross-tenant RLS isolation (a foreign UPDATE
matches 0 rows), append-only grant (events UPDATE/DELETE denied), the workspace
DELETE grant withheld, and the no-tenant-context barrier denying reads and writes.

## Increment 2 — spec-workspace lifecycle

`src/domain/workspace.ts` is the authoring counterpart to the package validator:
the workspace is HOW a package is built and accepted; the validator (increment 1)
checks the FINAL bytes. `decide(state, command)` is a pure, revisioned fold with
three outcomes — `accepted` (events + advanced state), `refused` (a `spec.*`
matrix code), or `invalid` (the command does not apply to this state, a boundary
concern with no matrix code).

Lifecycle: `draft` (revisioned, mutable) → `submitted` (review-frozen) →
`accepted` (immutable) → `superseded` (terminal). Invariants enforced:

- **optimistic concurrency** — every mutation carries `expectedRevision`; a stale
  one is `spec.revision_stale`.
- **immutability** — a content mutation of an accepted/superseded version is
  `spec.package_immutable`.
- **submission gating** — submitting requires ≥1 requirement (`problem_missing`),
  ≥1 contract (`contract_missing`), ≥1 acceptance criterion
  (`acceptance_unverifiable`) and no open decision (`decision_open`).
- **separation of powers** — acceptance requires ≥2 distinct approving reviewers
  (`approval_self_only`).
- **handoff** — a planning handoff that requests an executable capability is
  `spec.handoff_execution_right`.

`evidence_hash_mismatch` remains the package validator's concern. State is
deep-frozen; the module imports nothing and does not persist.

## Increment 1 — accepted spec-package validator

`src/domain/spec-package.ts` is the pure, offline validator for an accepted
`spec-package.v1`. It imports nothing and reuses the locked `common.v1`
definitions verbatim. `validateSpecPackage(input)` returns a three-state result:

| Status      | Meaning                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `valid`     | a typed, contract-conformant accepted package (deep-frozen)                                                |
| `malformed` | not a well-formed spec package (identity or item structure fails the schema) — a boundary concern, no code |
| `refused`   | well-formed but violates a semantic invariant, with the exact `spec.*` matrix code                         |

Semantic refusals: missing problem/actors → `spec.problem_missing`; no canonical
contract → `spec.contract_missing`; a criterion without observable evidence →
`spec.acceptance_unverifiable`; an unresolved decision → `spec.decision_open`;
fewer than two distinct approvers → `spec.approval_self_only` (separation of
powers). The `approvals` array uses the **correct** `common.v1` `approvalReference`
shape (`role`, `approvedAt`, `reference`, `subjectDigest`).

### Deliberately deferred

- **`spec.evidence_hash_mismatch`** (content-digest verification): the spec-package
  digest preimage is not defined in a reusable tool, so verifying it here would be
  a guess. Deferred until the canonicalization is confirmed. **A `valid` result is
  therefore structurally conformant but NOT digest-verified** — a caller must not
  treat it as integrity-checked.
- The **command-level** codes (`revision_stale`, `package_immutable`,
  `handoff_execution_right`) and the draft workspace, review flow, persistence,
  API and UI.

## License

EUPL-1.2.
