# MP-P4 — Continuous monitoring and re-evaluation

## Outcome

Use-case owners and policy reviewers can follow how eligible, ineligible, and indeterminate deployment configurations change when sourced facts, policies, needs, evidence freshness, or engine versions change. Every change creates new evidence; historical decisions remain immutable.

## User promise

The product identifies why a configuration entered or left the eligible set, when the change became known, which use cases are affected, and what action is required. It never silently rewrites an old decision or silently broadens an approved model set.

## Change sources

Re-evaluation can be triggered by:

- a new model artifact or immutable version;
- a new or removed serving route;
- provider contractual-entity or subprocessor change;
- inference, storage, logs, backup, support, retention, or training change;
- source expiry, correction, revocation, or licence restriction;
- policy approval, revocation, or exception expiry;
- need revision;
- evaluator qualification or revocation;
- quality, price, latency, or availability snapshot refresh.

Eligibility triggers and business-ranking triggers remain distinct. A price change cannot change rule status unless price is an explicit policy fact.

## Snapshot pipeline

Source adapters fetch only authorized destinations, validate licence and payload boundaries, derive allowlisted facts, and stage a candidate snapshot. Validation detects source rollback, future timestamps, conflicting values, incomplete routes, and origin/jurisdiction conflation. Human or policy-defined approval accepts the immutable snapshot before it can affect production decisions.

Raw restricted payloads and credentials never enter evidence exports. Failed refreshes retain the prior snapshot for replay while freshness rules may make new evaluations indeterminate.

## Re-evaluation behavior

The coordinator selects every active passport whose policy or required configuration facts intersect the change, then evaluates against explicit versions and instant. Work is idempotent and bounded; duplicate events do not create divergent results. Failures are isolated and retryable without partial scope changes.

Changes are asymmetric:

- `eligible → ineligible`: mark the route unusable and notify immediately;
- `eligible → indeterminate`: fail closed for new decisions and later gateway use;
- `ineligible/indeterminate → eligible`: show as a candidate requiring review before access broadening;
- eligible ranking change only: update comparison evidence, not authorization;
- revoked engine/snapshot: block new evaluation while preserving historical replay metadata.

## Timeline and notifications

Each timeline entry identifies old/new evaluation IDs, changed rule IDs, old/new sourced facts, event instant, detection instant, source, affected passports, and action state. Notifications contain no prompt, document, user-provided free text, or personal data.

Users can subscribe by role and severity. Delivery failure cannot suppress the in-product state. Acknowledgement does not change eligibility.

## Data, scale, and degraded mode

Re-evaluation uses cursor-bounded queues and idempotent commands. It avoids N+1 source retrieval by importing one immutable source snapshot then evaluating affected needs locally. Backpressure may delay non-security ranking refreshes; revocation and hard-rule changes receive priority. If the freshness or revocation stores are unavailable, new authorization-impacting decisions fail closed.

## Non-goals

- scraping sources without licence or destination authorization;
- treating provider marketing pages as permanent truth;
- silently adding a newly eligible route to an access profile;
- changing historical evaluation bytes;
- sending production content to test model availability;
- alerting through messages that disclose use-case or personal details.

## Metrics

Required metrics are `MP-MET-WATCH-001`, `MP-MET-WATCH-002`, `MP-MET-FRESH-001`, `MP-MET-SAF-001`, and `MP-MET-PII-001`.

## Exit gates

### MP-P4-G01 — Source adapters are allowlisted and provenance-safe

Every adapter has destination, licence, payload-size, parsing, fact allowlist, freshness, and rollback controls. SSRF, DNS rebinding, credentials, restricted redistribution, and origin/jurisdiction conflation have negative tests.

### MP-P4-G02 — Snapshot changes are immutable and reviewable

Candidate and accepted snapshots have content digests and structured diffs. Conflicts, future dates, incomplete routes, revoked sources, and source rollback fail closed. Acceptance never mutates an existing snapshot.

### MP-P4-G03 — Affected-use-case selection is complete and bounded

Tests prove every policy/fact dependency selects the relevant active passports without cross-organization leakage, unbounded scans, or N+1 retrieval. Duplicate events remain idempotent.

### MP-P4-G04 — Re-evaluation preserves deterministic evidence

Each result binds exact need, policy, snapshot, engine, and instant. Historical evaluations remain byte-identical; a change creates a new result and a structured old/new link.

### MP-P4-G05 — Eligibility transitions are asymmetric and fail closed

Revoked, newly ineligible, and newly indeterminate routes cannot remain available for new decisions. Newly eligible routes require explicit approval before access broadening; ranking changes alone never modify scope.

### MP-P4-G06 — Timeline and alerts are actionable and privacy-safe

The cockpit shows exact changed facts/rules, freshness, severity, affected opaque IDs, required action, and acknowledgement. Notification channels expose no personal or business content and failure cannot hide in-product state.

### MP-P4-G07 — Operational recovery is qualified

Queue backpressure, adapter outage, stale source, duplicate event, partial worker failure, database restore, and rollback journeys have automated evidence. Security revocations retain priority and unavailable authority dependencies deny new decisions.

## Dependencies and parallel work

MP-P4 depends on organization policy lifecycle in MP-P3. Source-adapter qualification, re-evaluation selection, and timeline UI can proceed in parallel once event contracts and immutable snapshot semantics are accepted.

## Release and rollback

A monitoring release can be disabled without altering existing evaluations. Rollback stops new refresh/re-evaluation jobs, preserves queued event IDs and accepted snapshots, and resumes idempotently on the prior qualified version. It never restores a revoked route to eligible or broadens access.
