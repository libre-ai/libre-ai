# Retention execution and physical compaction: design for the missing half of deletion

**Date:** 2026-07-23
**Status:** design (ready for owner decision — contains a security decision on the append-only floor)
**Scope:** the owner-scoped retention job of DATA-LIFECYCLE §Retention execution, and the physical compaction that `deletion.deferred-compaction` receipts (#229) promise
**Depends on:** rgpd-kit first increment (#226) + follow-ups (#229); WP-G2-D01 assets

---

## 1. The gap

Erasure today removes **logical** access in the accepted transaction
(tombstone + receipt qualified `deletion.deferred-compaction`) and the
doctrine says "physical compaction may follow" — but nothing implements the
follow. Likewise `sessions-content` (P90D) and every other retention rule in
`contracts/data/retention.v1.json` is an executable maximum with no executor.
The doctrine already specifies the job precisely (DATA-LIFECYCLE §Retention
execution): daily, owner-scoped, expired-ID selection under the machine
policy, bounded per-tenant transactions, aggregate counts + Evidence Report,
attenuated token (one tenant, one owner, `delete-expired`), never logging
content.

Existing assets (`packages/data`): `selectExpiredRowIds` /
`selectExpiredIds`, `retention_rules` store with min/max validation,
`backupExpiryCeiling`, `replayDeletionsOnRestore`, receipts. Missing: (a) a
DELETE capability compatible with the append-only floor, (b) the job
library, (c) per-product compaction definitions.

## 2. THE security decision: who may DELETE on an append-only table

`session_events` (and the other evidence tables) grant `SELECT, INSERT` only
to `libre_ai_app` — a deliberate structural floor. Physical compaction needs
row deletion somewhere. Three models:

### Option A — dedicated retention role (RECOMMENDED)

New NOLOGIN role `libre_ai_retention` (packages/data migration), with
**explicit per-table DELETE grants** (only the tables whose owner declares a
compaction spec: `session_events` first). A new barrier
`withTenantRetentionTransaction` mirrors `withTenantDbTransaction` but drops
to `libre_ai_retention`; existing RLS policies have no `TO` clause, so FORCE
RLS applies to this role identically (verified property, to be
integration-tested).

| Axis        | Trade-off                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sécurité    | ✅ Least privilege: the app role's floor is UNTOUCHED; deletion capability exists only for a role no request path assumes; grants are per-table and auditable in migrations. ⚠ The floor is no longer absolute — any code path reaching the owner connection can `SET ROLE libre_ai_retention`; mitigations: NOLOGIN, the barrier is the only in-repo assumption point, Biscuit attenuation (tenant+owner+`delete-expired`) gates the job at the app layer. |
| Qualité     | ✅ Same pattern as the existing barrier; testable on PGlite (roles + FORCE RLS work there, proven).                                                                                                                                                                                                                                                                                                                                                         |
| Performance | ✅ Row-level, per-tenant bounded transactions; uses the existing indexes (`actor_digest` for erasure compaction).                                                                                                                                                                                                                                                                                                                                           |
| Complétude  | ✅ Closes both loops (retention expiry AND deferred erasure compaction) with evidence.                                                                                                                                                                                                                                                                                                                                                                      |

### Option B — job runs as the table-owner role

Rejected: the owner role can ALTER policies and grants — an over-privileged
job is exactly what the attenuated-token doctrine forbids; a compromise of
the job becomes a compromise of the schema.

### Option C — partition-drop compaction (no DELETE grant at all)

Partition `session_events` by month; compaction = `DROP PARTITION` on
expiry. Strongest structural posture (no row deletion exists), BUT: a
tombstoned subject's rows persist until their whole partition ages out (up
to the P365D maximum), stretching "deferred compaction" far beyond the 35-day
backup-expiry symmetry; partition migration is invasive; per-subject
compaction is impossible. Rejected for now; noted as the scale evolution
when volumes justify it (the job library must not preclude it).

## 3. Increment surface (walking skeleton, Option A)

- **packages/data**:
  - migration `0003_retention_role.sql` — `libre_ai_retention` (NOLOGIN) +
    comment stating the invariant: grants to this role appear ONLY in
    owner-declared compaction migrations.
  - `withTenantRetentionTransaction(executor, tenantId, fn)` — SET LOCAL
    ROLE `libre_ai_retention` + transaction-local tenant GUC.
  - `runRetentionSweep(executor, spec, now)` — library orchestrator: for one
    owner + one tenant, select expired ids (rule from
    `contracts/data/retention.v1.json` via the retention-rules store),
    delete in one bounded transaction via the product's `deleteRows(tx,
ids)`, return an **evidence report** `{ owner, tenantId, ruleId,
selected, deleted, sweptAt }` — aggregate counts only, never content,
    never subject identifiers.
- **apps/sessions** — the first compaction spec:
  - migration `0005_retention_grants.sql` — `GRANT SELECT, DELETE ON
session_events TO libre_ai_retention` (SELECT needed for the selection
    query under RLS).
  - `sessionsCompactionSpec`: expired = events past the `sessions-content`
    window **plus** every event whose `actor_digest` is tombstoned in
    `session_deleted_subjects` (this is the deferred erasure compaction the
    receipts promise). Tombstone and audit rows are NOT swept (they are the
    evidence).
- **Entry point**: `tools/ops/run-retention.ts` — manual CLI (owner-run),
  prints the evidence report as JSON. NO scheduler, NO CI wiring, NO
  deployment: scheduling infrastructure is G4 (doctrine: daily job) and the
  walking skeleton must not fake it.
- **Restore replay** already exists (`replayDeletionsOnRestore`); the sweep
  report references receipt ids it compacted for, so a restore drill can
  cross-check.

## 4. Acceptance (TDD, PGlite)

1. The retention role cannot be assumed by the app path (SET LOCAL ROLE
   `libre_ai_retention` from `libre_ai_app` fails; app grants unchanged —
   UPDATE/DELETE on `session_events` still rejected under the app barrier).
2. FORCE RLS binds the retention role: cross-tenant sweep deletes nothing.
3. Expiry sweep: events older than the rule window are physically gone;
   newer events intact; evidence report counts match.
4. Erasure compaction: after an Art. 17 erasure (tombstone present), the
   sweep physically removes the subject's rows while the tombstone, audit
   rows and receipt remain; a subsequent access request still refuses
   `subject_erased`.
5. Tenant-configurable window: a shorter tenant value schedules
   already-expired rows immediately; values outside min/max refused
   (existing `retention_rules` validation).
6. The report never contains an identifier, digest list or content — only
   aggregate counts (asserted).

## 5. Owner decision points

1. **Adopt Option A** (dedicated `libre_ai_retention` role) — this is the
   decision that consciously relativizes the append-only floor; Option C
   remains the documented scale evolution.
2. **Erasure-compaction latency**: swept at the next owner-run sweep (v1,
   manual) — acceptable until G4 scheduling lands? The 35-day backup ceiling
   is the outer bound the doctrine already accepts.
3. **Evidence report destination**: v1 = CLI JSON output only (owner
   captures it); a persisted evidence store is a later increment.
4. **Sweep authorization**: v1 = owner-run CLI without Biscuit (no runtime
   surface exists); the attenuated-token gate becomes real when the job gets
   a scheduled runtime in G4.
