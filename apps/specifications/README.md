# @libre-ai/specifications

The specifications app produces accepted, content-addressed **spec packages** —
the immutable record of a problem, its requirements, decisions, contracts, risks,
acceptance criteria and independent approvals that gates downstream execution.

Work package: `WP-G3-F01`.

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
