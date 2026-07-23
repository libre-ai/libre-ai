# Sessions restriction (Art. 18): design for the deferred right

**Date:** 2026-07-23
**Status:** design (ready for owner decision)
**Scope:** the one data-subject right rgpd-kit's first adopter still refuses (`sessions.rgpd.not_implemented`)
**Depends on:** rgpd-kit first increment (#226) + follow-ups (#229)

---

## 1. What Art. 18 actually requires

Restriction is NOT erasure and NOT a read block on the subject:

- **Art. 18(1)** — the subject may obtain restriction on four grounds:
  (a) accuracy contested (for the verification window), (b) unlawful
  processing where the subject opposes erasure, (c) the controller no longer
  needs the data but the subject needs it for legal claims, (d) an Art. 21(1)
  objection is pending.
- **Art. 18(2)** — restricted data may still be **stored**; any other
  processing requires the subject's consent, or legal claims / protection of
  another person / important public interest.
- **Art. 18(3)** — restriction is **reversible**: lifting it requires
  informing the subject beforehand.
- **Art. 15 stays intact** — the subject can still access and export their
  own data while it is restricted (access/portability serve the subject, not
  the controller's processing).

Consequence for Sessions: restriction must pause the CONTROLLER-side
processing of the subject's contributions (exports, synthesis, provider
calls) while keeping storage, the append-only log, and the subject's own
access/portability untouched — and it must be liftable with an audit trail.

## 2. What "processing" means in Sessions today

| Surface                                   | Exists today                      | Under restriction                                                       |
| ----------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Append-only event log (storage)           | yes                               | allowed (Art. 18(2) storage)                                            |
| Subject access/portability (RGPD port)    | yes                               | allowed (Art. 15/20 serve the subject)                                  |
| Erasure (RGPD port)                       | yes                               | allowed (a restricted subject may still be erased)                      |
| Session exports (`session-exported`)      | event type only, no pipeline      | MUST exclude restricted subjects' contributions                         |
| Synthesis / provider processing           | not yet (locked runtime boundary) | MUST exclude restricted subjects' contributions                         |
| New contributions authored by the subject | yes (append)                      | allowed — restriction limits the controller, not the subject's activity |

The two "MUST exclude" surfaces do not exist yet (the Sessions runtime
boundary is locked until WP-G3-S01's `sessions-authz-review`). The increment
therefore delivers the **state, the checks and the contract**; enforcement
wires into those surfaces when they land — same pattern as the unmounted
request handler.

## 3. Storage options

### Option A — append-only state rows (RECOMMENDED)

`session_restricted_subjects` (tenant_id, subject_digest, state IN
('restricted','lifted'), ground, recorded_at; PK (tenant_id, subject_digest,
recorded_at); FORCE RLS; GRANT SELECT, INSERT only). Current state = latest
row. `ground` is one of the four Art. 18(1) codes — never free text.

| Axis        | Trade-off                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sécurité    | ✅ Same append-only evidence floor as tombstones/audit; reversal is a new row, never a rewrite.                           |
| Qualité     | ✅ Mirrors the proven `session_subject_audit` pattern; state function is one indexed `ORDER BY recorded_at DESC LIMIT 1`. |
| Performance | ✅ One indexed lookup per check.                                                                                          |
| Complétude  | ✅ Grounds, lift and notice obligation are all representable.                                                             |

### Option B — mutable flag table (UPDATE grant)

Rejected: breaks the append-only evidence posture every other RGPD table
holds; a lift would overwrite the history a regulator asks for.

### Option C — reuse `session_deleted_subjects` with a type column

Rejected: erasure is irreversible, restriction is reversible — conflating
them in one table makes the single most dangerous property (irreversibility)
data-dependent instead of structural.

## 4. Increment surface

- **rgpd-kit**: `RESTRICTION_GROUNDS` const union
  (`accuracy-contested | unlawful-opposed-erasure | needed-for-legal-claims |
objection-pending`) + it on `RestrictionFulfilled` (already typed:
  `{ restrictedAt, affectedRecords }`). No storage, as always.
- **Sessions migration `0004_restriction.sql`**: the Option A table.
- **Port**: `handleRestrictionRequest` fulfills — checks tombstone first
  (`subject_erased`), then latest state (`already_restricted`), then inserts
  the `restricted` row; `affectedRecords` = the subject's event count (what
  is now paused).
- **Lift**: NOT a data-subject request (it is a controller act under
  Art. 18(3)) — a product-internal `liftRestriction(tx, tenant, digest,
ground)` that appends the `lifted` row and returns the notice obligation
  (the caller must inform the subject BEFORE processing resumes; with no
  notification channel in v1, the returned obligation is recorded in
  `session_subject_audit.detail` as `sessions.rgpd.notice_required`).
- **Read-path contract**: exported helper `isRestricted(tx, tenantId,
subjectDigest)` + a documented invariant in the Sessions README: any future
  export/synthesis surface MUST filter through it (and the K4 review of
  WP-G3-S01 checks it).
- **Access under restriction**: unchanged — an integration test proves a
  restricted subject still gets access and portability fulfilled.

## 5. Acceptance (TDD, PGlite)

1. Restrict → fulfilled with ground; audit rows received+fulfilled; state row present.
2. Restrict again → `sessions.rgpd.already_restricted`.
3. Restrict an erased subject → `sessions.rgpd.subject_erased`.
4. Access + portability still fulfilled while restricted; erasure still fulfilled.
5. Lift → `lifted` row appended, audit row with `sessions.rgpd.notice_required`; restrict-again after lift → fulfilled (round trip).
6. Cross-tenant isolation + append-only grants (UPDATE/DELETE rejected) on the new table.
7. `isRestricted` truth table: no rows → false; restricted → true; restricted then lifted → false; latest row wins.

## 6. Owner decision points

1. **Adopt Option A** (append-only state rows) — recommended.
2. **Lift authority**: owner-role only via the operation matrix (`delete`
   holder), or a dedicated `restrict`/`lift` operation added to the locked
   sessions datalog? (The datalog is LOCKED — adding an operation touches
   `contracts/authz/sessions-v1.datalog`, which requires its own review.)
   Walking-skeleton recommendation: reuse `delete` (owner-only), defer the
   datalog amendment.
3. **Notice channel**: v1 = audit-recorded obligation only (no email/UI).
   Confirm this is acceptable until a notification surface exists.
