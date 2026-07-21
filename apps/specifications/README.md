# @libre-ai/specifications

The specifications app produces accepted, content-addressed **spec packages** —
the immutable record of a problem, its requirements, decisions, contracts, risks,
acceptance criteria and independent approvals that gates downstream execution.

Work package: `WP-G3-F01`.

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
