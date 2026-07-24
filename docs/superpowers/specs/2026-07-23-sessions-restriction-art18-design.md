# Sessions restriction (Art. 18): design for the deferred right

**Date:** 2026-07-23 (v2 — adversarial review findings integrated)
**Status:** ACCEPTED — owner arbitrage 2026-07-24: all five decision points
approved as recommended (§7: Option A `entry_seq`; `ground` through the
port as a named breaking change; lift via the `delete` operation, no
datalog amendment in v1; notice v1 = owner attestation in audit; Art. 19
recipients registry binds the future export increment). Execution order:
this increment FIRST, then retention (its §5 exclusion reads this table).
**Scope:** the one data-subject right rgpd-kit's first adopter still refuses (`sessions.rgpd.not_implemented`)
**Depends on:** rgpd-kit first increment (#226) + follow-ups (#229)
**Cross-invariant:** binds the retention/compaction design (same date, v2 §5) — a restricted subject is NEVER swept.

---

## 1. What Art. 18 and its neighbors actually require

Restriction is NOT erasure and NOT a read block on the subject:

- **Art. 18(1)** — the subject may obtain restriction on four grounds:
  (a) accuracy contested (for the verification window), (b) unlawful
  processing where the subject opposes erasure, (c) the controller no longer
  needs the data but the subject needs it for legal claims, (d) an Art. 21(1)
  objection is pending.
- **Art. 18(2)** — restricted data may still be **stored**; any other
  processing (INCLUDING physical deletion by a retention sweep — deletion is
  processing, Art. 4(2)) requires the subject's consent, or legal claims /
  protection of another person / important public interest.
- **Art. 18(3)** — restriction is **reversible**: lifting it requires
  informing the subject BEFORE processing resumes.
- **Art. 19** — every rectification, erasure or restriction must be notified
  to each recipient the data was disclosed to, unless impossible or
  disproportionate; the subject may ask who those recipients are.
- **Art. 15 stays intact** — the subject can still access and export their
  own data while it is restricted.

Consequence for Sessions: restriction must pause CONTROLLER-side processing
of the subject's contributions — display to other participants, exports,
synthesis, provider calls, AND retention sweeps — while keeping storage, the
append-only log, and the subject's own access/portability untouched; and it
must be liftable with prior notice and an audit trail.

## 2. What "processing" means in Sessions today

| Surface                                                                                         | Exists today                      | Under restriction                                                                                |
| ----------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Append-only event log (storage)                                                                 | yes                               | allowed (Art. 18(2) storage)                                                                     |
| State fold (`loadSessionState`, reducer)                                                        | yes                               | allowed — storage-integrity mechanics, discloses nothing by itself (explicit stance, reviewable) |
| Subject access/portability (RGPD port)                                                          | yes                               | allowed (Art. 15/20 serve the subject)                                                           |
| Erasure (RGPD port)                                                                             | yes                               | allowed — a restricted subject may still be erased at their own request                          |
| Serving the subject's contributions to OTHER participants (`loadEvents` behind `authorizeRead`) | yes (no real transport yet)       | MUST exclude (recital 67: making data unavailable to users is a restriction modality)            |
| Session exports (`session-exported`)                                                            | event type only, no pipeline      | MUST exclude + Art. 19 recipient duty (below)                                                    |
| Synthesis / provider processing                                                                 | not yet (locked runtime boundary) | MUST exclude                                                                                     |
| Retention sweep / physical compaction                                                           | designed (companion doc)          | MUST exclude (cross-invariant §5)                                                                |
| New contributions authored by the subject                                                       | yes (append)                      | allowed — restriction limits the controller, not the subject's activity                          |

The **invariant** the Sessions README records and WP-G3-S01's review checks:
_any surface that discloses, transmits, derives from or destroys the
subject's contributions MUST consult `isRestricted` first_ — not just
export/synthesis. The state fold is the one named exception (storage
integrity), decided here, in writing.

**Art. 19 duty**: v1 has zero recipients (no export pipeline ever ran), so
the duty is vacuously satisfiable — but the invariant already binds the
future export surface: it MUST record recipients per disclosure, because a
later restriction/erasure/rectification triggers per-recipient notification
and the subject may ask for the list. Without this, the export increment
would be born non-compliant.

## 3. Storage options

### Option A — append-only state rows (RECOMMENDED)

`session_restricted_subjects` (tenant_id, subject_digest, entry_seq
`bigint GENERATED ALWAYS AS IDENTITY`, state IN
('restricted','lift-pending','lifted'), ground, request_id, recorded_at;
PK (tenant_id, subject_digest, entry_seq); FORCE RLS; GRANT SELECT, INSERT
only). Current state = row with the highest `entry_seq` — **deterministic
even under an injected fixed clock or same-timestamp writes** (review
finding: a `recorded_at`-keyed PK collides on the restrict→lift→restrict
round trip with a fixed test clock, and latest-by-timestamp is
non-deterministic on ties). `ground` is one of the four Art. 18(1) codes on
`restricted` rows and NULL on lift rows (a lift has no Art. 18(1) ground;
its justification lives in the audit trail).

| Axis        | Trade-off                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| Sécurité    | ✅ Same append-only evidence floor as tombstones/audit; reversal is a new row, never a rewrite.                   |
| Qualité     | ✅ Append-only like `session_subject_audit`; state function is one indexed max-`entry_seq` lookup, deterministic. |
| Performance | ✅ One indexed lookup per check.                                                                                  |
| Complétude  | ✅ Grounds, lift sequencing (Art. 18(3)) and the Art. 19 hook are all representable.                              |

### Option B — mutable flag table (UPDATE grant)

Rejected: breaks the append-only evidence posture every other RGPD table
holds; a lift would overwrite the history a regulator asks for.

### Option C — reuse `session_deleted_subjects` with a type column

Rejected: erasure is irreversible, restriction is reversible — conflating
them makes the most dangerous property (irreversibility) data-dependent
instead of structural.

## 4. Increment surface

- **rgpd-kit**:
  - `RESTRICTION_GROUNDS` const union (`accuracy-contested |
unlawful-opposed-erasure | needed-for-legal-claims | objection-pending`).
  - **Port signature change (BREAKING, named as such)**:
    `handleRestrictionRequest(tenantId, subjectDigest, ground:
RestrictionGround)` — the ground belongs to the subject and must enter
    through the request, not be invented by the implementation (review
    finding: the current port and the intake body have no path for it).
    Every implementer (Sessions + the in-memory reference adopter) updates
    in the same increment; `RestrictionFulfilled` gains `ground`.
  - Intake: `parseBody` accepts a `ground` field, validated against the
    union, REQUIRED when `rightType === "restriction"`, refused otherwise.
- **Sessions migration** (number assigned at implementation time, sequenced
  with the retention design's migrations): the Option A table.
- **Port implementation**: `handleRestrictionRequest` fulfills — tombstone
  first (`sessions.rgpd.subject_erased`), unknown subject
  (`sessions.rgpd.subject_unknown` — parity with access/erasure, review
  finding), current state restricted/lift-pending →
  `sessions.rgpd.already_restricted`, else insert the `restricted` row;
  `affectedRecords` = the subject's event count (what is now paused).
- **Lift — two-step, Art. 18(3)-conform** (review finding: informing the
  subject must PRECEDE the resumption of processing, so a one-shot lift that
  flips `isRestricted` immediately inverts the legal sequence):
  1. `requestLift(tx, tenant, digest)` appends `lift-pending`: processing
     stays paused; audit row records `sessions.rgpd.notice_required`.
  2. `confirmLift(tx, tenant, digest)` appends `lifted` — callable only
     once the notice obligation is discharged (v1: owner attestation, its
     reference recorded in the audit row).
     Audit encoding (documented in the migration comment, extending 0002's
     `detail` doc which today says "refusal codes only"): lift entries use a
     synthetic `request_id` (`lift_<entry_seq>`), status `in-progress`
     (pending) then `fulfilled` (confirmed), `detail` =
     `sessions.rgpd.notice_required` / `sessions.rgpd.notice_attested`.
- **Read-path contract**: exported `isRestricted(tx, tenantId,
subjectDigest)` (highest-`entry_seq` row in {restricted, lift-pending} →
  true) + the §2 invariant in the Sessions README.
- **Access under restriction**: unchanged — integration-tested.

## 5. Cross-invariant with retention/compaction (review finding, Critique)

The retention sweep is processing beyond storage: **the window sweep MUST
exclude every session/event whose subject is currently restricted or
lift-pending** — Art. 18(1)(c) is precisely the subject who needs expired
data kept for legal claims. Erasure compaction of a subject who was
restricted and LATER erased at their own request remains lawful (the
erasure request supersedes; consent ground of Art. 18(2)). Both directions
are acceptance-tested in whichever increment lands second, and the
companion retention design carries the same invariant in its sweep
specification (§5 there).

## 6. Acceptance (TDD, PGlite)

1. Restrict with a ground → fulfilled carrying the ground; audit
   received+fulfilled; state row present.
2. Restrict again → `already_restricted`; unknown subject →
   `subject_unknown`; erased subject → `subject_erased`; missing/invalid
   ground at intake → 400 `request_invalid`.
3. Access + portability still fulfilled while restricted; erasure still
   fulfilled.
4. Lift: `requestLift` → still paused (`isRestricted` true), audit
   `notice_required`; `confirmLift` → `isRestricted` false, audit
   `notice_attested`; restrict again after lift → fulfilled (round trip
   under a FIXED injected clock — the `entry_seq` PK makes it pass).
5. `isRestricted` truth table: no rows → false; restricted → true;
   lift-pending → true; lifted → false; highest `entry_seq` wins.
6. Cross-tenant isolation + append-only grants on the new table.
7. Cross-invariant (with the retention increment): a restricted subject's
   expired events survive the window sweep; a restricted-then-erased
   subject's events are compacted.

## 7. Owner decision points

1. **Adopt Option A** (append-only state rows, `entry_seq` identity) —
   recommended.
2. **Port breaking change**: accept `ground` on `handleRestrictionRequest`
   (recommended — a ground-less restriction cannot honor Art. 18(1)'s
   ground-specific verification windows).
3. **Lift authority**: reuse the `delete` operation (owner-only, no datalog
   amendment — recommended for v1) vs adding `restrict`/`lift` operations
   to the LOCKED `contracts/authz/sessions-v1.datalog` (own review).
4. **Notice channel v1**: owner attestation recorded in audit (no
   email/UI). Confirm acceptable until a notification surface exists.
5. **Art. 19 recipients registry**: confirm it binds the future export
   increment (recorded here as invariant, implemented there).
