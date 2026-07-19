# @libre-ai/data

Tenant-isolated data platform (WP-G2-D01). Enforces the DATA-LIFECYCLE lock: a
transaction-local tenant context, deny-by-default row ownership, validated
retention bounds and the encrypted-backup expiry ceiling.

**Status: foundation in progress.** The security invariants of the three
acceptance criteria are implemented and tested (deny-by-default RLS context,
cross-tenant guard, retention minima/maxima, 35-day backup ceiling). Remaining
before WP-G2-D01 acceptance: real PostgreSQL adapters with `SET LOCAL` tenant
context and pool clearing, isolated owner migrations, Redis/Cellar ports, the
executable retention job, the full deletion-receipt emission with restore
replay, the sibling `@libre-ai/retention` package, and the independent
`rls-adversarial-review` and `migration-and-deletion-review` gates.

Modules:

- `tenant-context` — transaction-local tenant scope; missing context denies.
- `tenant-row-guard` — a row is reachable only under its owning tenant; the
  `public` service tenant is rejected on private rows.
- `retention-bounds` — tenant-configured retention validated against the
  accepted minimum/maximum.
- `backup-ceiling` — a deletion receipt's backup expiry never exceeds 35 days.
