# Retention execution and physical compaction: design for the missing half of deletion

**Date:** 2026-07-23 (v2 — reworked after adversarial review: the compaction-granularity decision comes FIRST, and the role-model security property is restated as what is actually verifiable)
**Status:** ACCEPTED — owner arbitrage 2026-07-24: all five decision points
approved as recommended (§7: granularity G-A session-lifecycle; erasure-
compaction latency accepted **with a named vigilance** — decision 2 is
re-evaluated when Sessions carries real load, and a per-event ceiling
would reopen G-C; age column `recorded_at`; role model Option A with its
honest property; v1 owner-run CLI without Biscuit until G4). Execution
order: AFTER the restriction increment (this sweep's §5 exclusion reads
`session_restricted_subjects`).
**Scope:** the owner-scoped retention job of DATA-LIFECYCLE §Retention execution, and the physical compaction that `deletion.deferred-compaction` receipts (#229) promise
**Depends on:** rgpd-kit first increment (#226) + follow-ups (#229); WP-G2-D01 assets
**Cross-invariant:** binds the Sessions restriction design (same date, v2 §5) — a restricted subject is NEVER swept.

---

## 1. The gap

Erasure today removes **logical** access in the accepted transaction
(tombstone + receipt qualified `deletion.deferred-compaction`) and the
doctrine says "physical compaction may follow" — but nothing implements the
follow. Likewise every retention rule in `contracts/data/retention.v1.json`
is an executable maximum with no executor. The doctrine specifies the job
(DATA-LIFECYCLE §Retention execution): daily, owner-scoped, expired
selection under the machine policy, bounded transactions, aggregate counts
plus an Evidence Report, attenuated token, never logging content.

Existing assets are THINNER than they look (review finding):
`selectExpiredRowIds` hard-codes `id`/`created_at` columns that
`session_events` does not have (composite causal PK, `recorded_at` /
`occurred_at`) — each product writes its own selection query; the reusable
assets are the retention-rules store (min/max validation), the barrier
pattern, `backupExpiryCeiling` and `replayDeletionsOnRestore`.

## 2. DECISION 1 — compaction granularity (this constrains everything else)

**The causal log rejects row-level holes.** `reduce()` requires the first
event to be `session-created` at `sequence === 1` and strictly contiguous
sequences; `loadSessionState` throws `SessionStreamCorruptError` on any
stream that no longer folds. Deleting individual expired rows, or one
subject's interleaved rows, permanently bricks EVERY session it touches
(review finding, Critique). Whatever role model executes deletion, the unit
of physical deletion cannot be the row.

### Option G-A — session-lifecycle compaction (RECOMMENDED)

The unit is the WHOLE session stream: a session is swept only when its
ENTIRE stream is past the retention window (age measured from its newest
event). Erasure compaction follows the same unit: a tombstoned subject's
rows disappear when each session they touched expires as a whole.

| Axis        | Trade-off                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sécurité    | ✅ No partial stream can exist, so no corruption path; per-session DELETE is scoped by the causal PK prefix.                                                                                                                                                                                                                                          |
| Qualité     | ✅ Zero change to the locked domain reducer; invariants stay strict.                                                                                                                                                                                                                                                                                  |
| Performance | ✅ One bounded transaction per session — the doctrine's "bounded transactions" for free.                                                                                                                                                                                                                                                              |
| Complétude  | ⚠ Deferred-compaction latency for an erased subject = until each containing session fully expires (bounded by the rule maximum, P365D for `sessions-content`). The tombstone keeps logical access removed the whole time; the receipt already says `deferred-compaction`. This latency is THE price of G-A and is put to the owner explicitly (§7.2). |

### Option G-B — hole-tolerant reducer (attested gaps)

Teach `reduce`/`loadSessionState` to accept gaps proven by a tombstone.
Rejected: mutates the LOCKED domain validator semantics — the strict
contiguity invariant is Sessions' anti-fork floor; relaxing it for
compaction couples data-lifecycle concerns into the domain kernel.

### Option G-C — payload scrubbing (UPDATE the erased subject's rows)

Column-scoped `GRANT UPDATE (data, actor_id)` and overwrite content in
place, keeping the causal skeleton. Technically VIABLE without touching the
reducer: refold does not re-validate payloads (`loadSessionState` documents
that field-level payload integrity is the write-time `validateEvent`
guarantee, not re-checked on load) — corrected from v1 of this doc, which
wrongly claimed G-C needed G-B's relaxation. Its real cost is the UPDATE
grant (a second, different relaxation of the append-only floor: rows become
rewritable by the retention role) plus a scrubbing protocol (what replaces
`data`/`actor_id`, how the scrub is evidenced). Rejected for v1 on that
cost alone; it is the honest, workable fallback if the owner refuses G-A's
erasure-compaction latency (§7.2).

### Option G-D — partition-drop

Partition by month, drop expired partitions. Same latency class as G-A,
coarser unit, invasive migration, still no per-subject compaction. Not
rejected on a false premise anymore (review finding: per-subject row
deletion is impossible under EVERY option that preserves the causal log) —
G-D is simply G-A at datacenter scale; documented as the evolution when
volumes justify it.

## 3. DECISION 2 — who executes deletion (role model)

### Option A — dedicated retention role (RECOMMENDED, restated honestly)

New NOLOGIN role `libre_ai_retention` (packages/data migration) with
grants ONLY `SELECT, DELETE ON session_events` (first adopter), assumed by
a dedicated barrier `withTenantRetentionTransaction` (SET LOCAL ROLE +
tenant GUC, mirror of the app barrier).

**What is SQL-verifiable — and what is NOT** (review finding, Critique):
`SET ROLE` privilege is evaluated against the SESSION user, not the current
role. In PGlite tests the session is superuser (documented in
`@libre-ai/testing`), and in production the connecting owner must be a
member of the retention role — so from the same connection, application
code could technically `SET LOCAL ROLE libre_ai_retention`. The separation
is therefore:

- **structural, SQL-tested**: the APP role's grants are untouched
  (UPDATE/DELETE on `session_events` still rejected under the app barrier —
  regression-tested); `pg_roles` probe on the retention role (NOLOGIN,
  NOSUPERUSER, NOBYPASSRLS); FORCE RLS binds the retention role (policies
  have no `TO` clause → apply to all roles — integration-tested with a
  cross-tenant sweep attempt);
- **discipline, code-reviewed**: `withTenantRetentionTransaction` is the
  ONLY in-repo assumption point (greppable invariant, checked in review);
- **authorization, deferred**: the Biscuit attenuated token
  (tenant + owner + `delete-expired`) gates the caller when the job gets a
  runtime surface (G4); v1 is an owner-run CLI, and that gap is accepted
  explicitly (§7.4), not silently.

### Option B — job runs as the table-owner role

Rejected: over-privileged (can ALTER policies/grants); a job compromise
becomes a schema compromise; the opposite of the attenuated-token doctrine.

## 4. Increment surface (walking skeleton: G-A + Option A)

- **packages/data**:
  - migration `0003_retention_role.sql` — `libre_ai_retention` (NOLOGIN) +
    the invariant comment (grants only via owner-declared compaction
    migrations).
  - `withTenantRetentionTransaction(executor, tenantId, fn)`.
  - `runRetentionSweep(executor, spec, now)` — orchestrator for one owner +
    one tenant, two phases:
    1. **Selection under the APP barrier** (read-only; the app role already
       reads `session_events`, `session_deleted_subjects`,
       `session_restricted_subjects`, `retention_rules` — review finding:
       the retention role does NOT get read grants on the evidence tables):
       compute fully-expired sessions, minus exclusions (§5).
    2. **Deletion under the RETENTION barrier**, one bounded transaction
       per session, which **RE-CHECKS the predicate inside the deleting
       transaction** — expiry (no event newer than the window) and the §5
       restriction exclusion — before the prefix DELETE (delta-review
       finding: between the two phases a fresh event can be appended or a
       subject restricted; the selection is advisory, the deleting
       transaction's own check is the guard).
       Returns the evidence report `{ owner, tenantId, ruleId,
sessionsSelected, sessionsDeleted, eventsDeleted,
compactedReceiptIds, sweptAt }` — aggregate counts plus opaque
       receipt ids (needed for the restore-drill cross-check; receipt ids
       are opaque, never identifiers or content).
- **apps/sessions** — first compaction spec:
  - migration `000N_retention_grants.sql` — `GRANT SELECT, DELETE ON
session_events TO libre_ai_retention` (numbering sequenced with the
    restriction increment's migrations at implementation time).
  - `sessionsCompactionSpec`: **age column = `recorded_at`** (server-set at
    append; `occurred_at` is client-supplied and forgeable — decision
    §7.3). **Sweep eligibility = full expiry, nothing else** (delta-review
    finding: an earlier formula made "all contributors tombstoned" an
    alternative trigger, which would delete a NON-expired session's
    system/provider events early — contradiction removed): a session is
    swept when `max(recorded_at)` of its stream is past the
    `sessions-content` window and §5 does not exclude it. Erasure changes
    the REPORT, not the eligibility: when a swept session contains events
    of tombstoned subjects, their receipt ids land in
    `compactedReceiptIds` (this is how deferred compaction is evidenced).
    Tombstones, audit rows and restriction rows are NEVER swept (they are
    the evidence). Sequencing dependency: the §5 exclusion reads
    `session_restricted_subjects`, so the restriction increment's
    migration lands BEFORE (or with) this one — the spec does not guess
    around a missing table.
- **Legal hold** (review finding): the sweep spec carries a pre-check hook
  `holds(tenant, scope)` that MUST answer empty before deletion. v1: no
  hold registry exists, the hook is a documented constant-empty — the
  deferral is named (same pattern as `executeActiveDeletion`'s K4 M-09
  precedent), never silent. A future hold registry plugs in without
  reshaping the sweep.
- **Entry point**: `tools/ops/run-retention.ts` — owner-run CLI printing
  the evidence report as JSON. NO scheduler, NO CI wiring (G4).

## 5. Cross-invariant with restriction (review finding, Critique)

Deletion is processing (Art. 4(2)); under restriction only storage is
permitted (Art. 18(2)). Therefore: **any session containing at least one
event of a currently-restricted (or lift-pending) subject is excluded from
the window sweep entirely** — conservative by design: Art. 18(1)(c) is
precisely the subject who needs expired data preserved for legal claims,
and partial deletion around them would brick the stream (§2). A subject who
was restricted and LATER erased at their own request is compactable (the
erasure supersedes). Acceptance-tested in whichever increment lands second.

## 6. Acceptance (TDD, PGlite)

1. App-floor regression: UPDATE/DELETE on `session_events` still rejected
   under the app barrier; retention role probe (NOLOGIN, NOSUPERUSER,
   NOBYPASSRLS) via `pg_roles`.
2. FORCE RLS binds the retention role: a cross-tenant sweep deletes zero
   rows.
3. Window sweep (G-A): a fully-expired session disappears atomically; a
   session with ONE fresh event is untouched entirely; every remaining
   session still loads through `loadSessionState` without
   `SessionStreamCorruptError` (the review's missing criterion, now
   explicit).
4. Erasure compaction: after Art. 17 (tombstone present), once the
   containing sessions expire, the subject's rows are physically gone;
   tombstone, audit rows and receipt remain; access still refuses
   `subject_erased`; the report's `compactedReceiptIds` names the receipt.
5. Restriction exclusion (§5): an expired session containing a restricted
   subject's event survives the sweep; after `confirmLift`, it is swept.
6. Tenant-configurable window: shorter value schedules already-expired
   sessions immediately; out-of-bounds values refused (existing
   `retention_rules` validation).
7. The report carries aggregate counts and opaque receipt ids only —
   no identifier, no digest list, no content (asserted).

## 7. Owner decision points

1. **Granularity G-A** (session-lifecycle compaction) — recommended; G-C
   (scrubbing) is the fallback if the erasure-compaction latency below is
   refused; G-D is the scale evolution.
2. **Erasure-compaction latency under G-A**: physical removal waits for
   each containing session to expire (≤ the rule maximum, P365D for
   `sessions-content`), while logical access stays removed from the
   accepted transaction. **Visible corollary** (delta-review finding): with
   expiry measured on `max(recorded_at)`, a continuously-active session
   retains its OLD events beyond the declared window — the stream ages as
   a whole (Art. 5(1)(e) tension if a session lives for years). Accept
   both as the meaning of `deletion.deferred-compaction`, or require a
   per-event ceiling (which reopens the granularity question G-C)?
3. **Age column**: `recorded_at` (server-set, recommended) vs `occurred_at`
   (client-supplied).
4. **Role model Option A with its honest property** (§3): floor relativized
   by a dedicated role whose isolation is grants + probe + single-barrier
   discipline + future Biscuit gate — NOT a SQL impossibility. Accept?
5. **v1 owner-run CLI without Biscuit** (no runtime surface yet) — accept
   the named gap until G4 scheduling lands?
