# MP-P6 — Activity cockpit

## Outcome

Organization operators pilot their AI use-case portfolio through qualified, sourced, privacy-minimized metrics for evidence health, eligibility, access, task quality, performance, availability, cost, and incidents. Ranking remains downstream of hard eligibility and never becomes a compliance score.

## User promise

A business owner can see whether an approved configuration still meets task and budget expectations. Security and privacy reviewers can see evidence freshness, policy exceptions, blocked routes, and upcoming renewals. Operators can connect activity to one passport/profile/consumer without inspecting prompts or responses.

## Cockpit views

### Portfolio

Show active passports, owners as opaque authorized references, business unit, declared criticality, policy version, current eligibility health, active profile, last re-evaluation, and required actions. Personal or sensitive use-case descriptions are not copied into list telemetry.

### Evidence and policy

Show satisfied, failed, and unknown rule counts; stale/expiring sources; certification scope/validity; policy versions; exceptions; revocations; and exact changed facts. No aggregate “compliance percentage” can hide a failed mandatory rule.

### Access and activity

Show requests and refusals by passport, profile, credential alias, configuration, operation, and environment; route/fallback selection; quota; errors; and incidents. Credentials, prompts, responses, documents, and person identifiers are absent.

### Quality

Use task-specific evaluation sets approved for the use case: accuracy, precision/recall/F1, structured-output validity, groundedness, hallucination proxy, robustness, language/document segment, sample size, and confidence interval. Public leaderboards may be evidence inputs only when licence, task relevance, methodology, and date are recorded.

### Performance and availability

Show latency p50/p95/p99, throughput, error/retry/fallback rates, availability, context-size distribution in bounded non-content units, capacity, and measurement window. Provider claims and observed measurements are visually distinct.

### Cost

Show sourced input/output/OCR/embedding/storage prices, minimum infrastructure cost, retries/fallbacks, actual spend, budget, and projection ranges with assumptions and price snapshot dates. False precision is forbidden.

## Ranking and recommendations

Only currently eligible configurations enter business ranking. The ranker consumes a dated metric snapshot, explicit organization/use-case weights, missing-value policy, and stable tie-break. It emits a metric vector and ordering, not an eligibility verdict.

The UI can offer views such as lowest cost, lowest latency, highest measured quality, self-hosted, or sovereignty-first. It must expose trade-offs and confidence, and preserve excluded/indeterminate explanations separately.

For composite pipelines, quality, latency, reliability, and cost are measured end-to-end as well as per component. A high model benchmark cannot compensate for an unqualified OCR/storage/log path.

## Metric governance

Every metric has a stable ID, definition, formula, unit, owner, source, window, freshness, phase, privacy classification, and gate/diagnostic status in [`../METRICS.md`](../METRICS.md). “All metrics” is not a valid collection rule: only actionable and qualified measures are retained.

A metric definition change creates a new version and does not rewrite old dashboards. Unknown data is displayed as unknown, never zero. Ranking snapshots bind exact metric versions and inputs.

## Data minimization and retention

Operational telemetry contains opaque organization/passport/profile/configuration/credential aliases and bounded numeric measures. It excludes content and secrets. Small groups and rare events require aggregation/suppression controls where they could identify a person indirectly. Quality evaluation content uses a separate approved corpus and retention policy, never implicit production logging.

## Non-goals

- ingesting prompts/responses by default;
- one opaque score combining security, compliance, quality, and cost;
- treating provider marketing benchmarks as observed truth;
- changing access because a rank changed;
- claiming a standard or regulation is satisfied from a dashboard badge;
- unlimited-cardinality labels, unbounded exports, or N+1 model queries.

## Metrics

This phase operationalizes the complete catalogue, especially `MP-MET-RANK-001`, `MP-MET-OPS-001`, `MP-MET-OPS-002`, `MP-MET-COST-001`, `MP-MET-QUALITY-001`, `MP-MET-ACCESS-001`, and `MP-MET-PII-001`.

## Exit gates

### MP-P6-G01 — The metric catalogue is versioned and complete

Every displayed and ranked measure has a stable definition, formula, unit, source, owner, freshness, privacy classification, retention, and missing-value behavior. Metric changes are versioned and historical views remain interpretable.

### MP-P6-G02 — Hard eligibility is structurally separated from ranking

Contracts and tests prove only eligible configurations enter the ranker, failed/unknown rules cannot be offset, ranking output grants no authorization, and stable identical inputs produce identical ordering.

### MP-P6-G03 — Task-quality evidence is representative and transparent

Each promoted quality metric identifies corpus authority, task/population segments, methodology, sample size, uncertainty, model/configuration version, and evaluation date. Restricted datasets are not redistributed.

### MP-P6-G04 — Activity telemetry is attributable without content

Requests, refusals, routes, fallbacks, costs, performance, and incidents bind opaque passport/profile/consumer/configuration IDs. Automated tests and privacy review prove no prompt, response, document, secret, or direct person identifier reaches telemetry.

### MP-P6-G05 — Cost and performance measures are operationally sound

Observed versus provider-claimed data is distinct; latency percentiles, throughput, availability, retries, fallback costs, price dates, and projection assumptions are explicit. Queries are cursor-bounded, indexed, and free of N+1 behavior.

### MP-P6-G06 — Cockpit explanations are accessible and non-deceptive

Every badge has text, source, freshness, and scope. Failed, unknown, expired, and not-applicable states are distinguishable without color. No percentage or certification badge implies global legal compliance.

### MP-P6-G07 — Alerts and budgets cannot mutate authority

Budget, drift, incident, and threshold alerts are idempotent and actionable but cannot modify policy, passport, profile, credential, or verdict. Authorized commands remain required for every state change.

### MP-P6-G08 — Operational qualification and rollback pass

Load, cardinality, retention/deletion, backup/restore, dashboard outage, delayed metrics, corrupt series, provider outage, accessibility, security/privacy, and smoke tests pass on the release candidate. Missing telemetry degrades visibly and never weakens gateway enforcement.

## Dependencies and parallel work

MP-P6 depends on continuous re-evaluation and gateway event contracts. Quality/cost methodology, privacy-safe telemetry, and accessible dashboard design can progress in parallel after the metric catalogue is locked.

## Release and rollback

The cockpit is observational. Rolling it back cannot change policies, evaluations, profiles, credentials, or gateway enforcement. If metric processing is unavailable, the UI marks data stale/unavailable and stops ranking refresh; it never substitutes zeros or an older ranking without its timestamp and version.
