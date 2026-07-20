# @libre-ai/data

Tenant-isolated data platform (WP-G2-D01). Enforces the DATA-LIFECYCLE lock: a
transaction-local tenant context, deny-by-default row ownership, validated
retention bounds, backup ceiling and restore replay.

**Status: business-logic foundation complete, integration pending.** This is a
**defense-in-depth application layer, not the mandatory enforcement.** An
independent adversarial review confirmed the load-bearing point: these guards
are optional to a caller, so the PostgreSQL RLS policies and CHECK constraints
(not yet written) are the mandatory barrier — a caller that bypasses these
helpers must still be denied by the database. Both layers are required; this
one alone is not sufficient.

Hardened after that review: subject digests must be opaque SHA-256 (a cleartext
value is refused, closing a content-leak vector); an unknown deletion-receipt
status fails the restore closed; the tenant-id provenance requirement (K2) is
documented. The security logic of all three acceptance criteria is implemented
and tested (37 tests, strict TDD):

- `tenant-context` — transaction-local tenant scope; missing context denies;
  clears on return and on throw.
- `tenant-row-guard` — a row is reachable only under its owning tenant; the
  `public` service tenant is rejected on private rows.
- `retention-bounds` — tenant-configured retention validated against the
  accepted minimum/maximum.
- `expired-selection` — the retention job's core: opaque IDs whose age reached
  the window; a shorter retention schedules already-expired records immediately.
- `backup-ceiling` — a deletion receipt's backup expiry never exceeds 35 days.
- `restore-replay` — a completed deletion does not resurrect on restore.

## Remaining before acceptance, and its architectural prerequisite

The real PostgreSQL adapters (`SET LOCAL` tenant context + pool clearing),
isolated owner migrations and true RLS policies must be tested against a
PostgreSQL instance "without provisioning infrastructure". Per
`docs/architecture/DETAILED-TARGET.md` §9.8, the test PostgreSQL/Redis launch
belongs to **`packages/testing`** — a separate, not-yet-built package. Its test
mechanism (an embedded ephemeral PostgreSQL versus a WASM build such as PGlite)
is a sovereignty and supply-chain decision on a deliberately minimal dependency
catalog, and belongs to an owner arbitration, not to this package.

So the acceptance path is: **decide the `packages/testing` PostgreSQL test
mechanism → build `packages/testing` → add the real RLS adapters, migrations,
Redis/Cellar ports, full deletion-receipt emission and the `@libre-ai/retention`
package here → run `rls-adversarial-review` and `migration-and-deletion-review`
as an independent pass** (loop-security kernel K4: the implementer does not
approve its own guardrails).
