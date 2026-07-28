# Model Policy evidence policy

## Purpose

Define what a phase gate may claim and where its evidence lives. This document does not make review reports normative: product specifications, contracts, policies, snapshots, needs, and evaluation semantics remain their own authorities. Evidence proves an assertion against an immutable candidate.

## Evidence levels

| Level | Meaning | Minimum evidence |
| --- | --- | --- |
| `declared` | Intent is documented, with no implementation claim | Accepted scope and non-goals |
| `implemented` | Code or content exists on an immutable commit | Commit and changed-path inventory |
| `verified` | Required behavior is reproducible | Commands, environment/tool versions, explicit results, negative cases |
| `qualified` | Release-relevant safety and quality have independent verdicts | Verified evidence plus role-separated business/architecture/security/privacy/accessibility/performance reviews as applicable |
| `in_service` | Behavior is observed on an authorized operated instance | Qualified release, deployment identity, smoke/rollback evidence, operational window and incidents |

A gate definition states its `requiredEvidenceLevel`. The planning record never declares a gate or phase complete: owner-controlled execution authorities may do so only after every mandatory gate references evidence at or above that level.

## Evidence record requirements

Each gate reference points to one JSON record under `distribution/evidence/model-policy/` and pins the SHA-256 digest of that complete record. The record conforms to [`evidence-record.v1.schema.json`](evidence-record.v1.schema.json) and includes:

- stable evidence ID plus exact phase and gate IDs;
- assertion under test and achieved evidence level;
- immutable source commit and relevant artifact/contract digests;
- commands and qualified tool versions;
- input fixtures or legally usable corpus identity;
- explicit expected and observed results;
- blocking, major, minor, and residual findings;
- one verdict where a review is required;
- reviewer roles and exposed harness identifiers, never reviewer PII;
- supporting review paths;
- rollback or invalidation conditions;
- creation instant in ISO 8601 UTC.

The checker verifies the record digest, schema, phase/gate binding, achieved level, source commit, supporting-review paths, and digests of tracked regular non-symlink artifacts. A bare path—even to an existing review—cannot pass a gate. A mutable branch output, unqualified screenshot, “tests passed” without commands, or provider marketing claim is insufficient.

## Storage

- Normative product phase records live under `docs/apps/model-policy/`.
- Immutable supporting review dossiers live under `docs/reviews/`; they are not direct gate evidence.
- Content-addressed gate records and reproducible release evidence live under `distribution/evidence/model-policy/`.
- Restricted datasets and customer-instance evidence do not enter the public repository.
- GitHub comments may supplement evidence only when immutable URL/body digest is recorded.

Evidence filenames include phase/gate identity and a date or immutable candidate identity. Existing records are not overwritten; a superseding record links to the prior one.

## Business review

Business review verifies:

- questions are answerable by the assigned actor;
- terminology reflects real work rather than legal/technical jargon;
- outputs distinguish fact, inference, unknown, and recommendation;
- use-case consequences and human oversight are captured;
- the product does not overpromise legal compliance or model quality;
- business metrics and trade-offs are understandable and actionable.

Usability testing proves comprehension only. It cannot prove regulatory correctness, extraction safety, or deterministic semantics.

## Technical review

Technical review verifies:

- strict contracts and stable IDs;
- deterministic and fail-closed behavior;
- malformed, stale, revoked, duplicate, and cross-tenant negatives;
- resource bounds, pagination, indexes, and no N+1 paths;
- no secrets or PII in logs/evidence;
- tests at unit, contract, integration, browser, security, performance, smoke, and rollback layers as applicable;
- supply-chain and licence gates.

## Architecture review

Architecture review verifies:

- one authority per subject;
- pure eligibility, approval/authorization, gateway, and telemetry boundaries remain separate;
- ownership and tenant boundaries are explicit;
- phase dependencies are acyclic and do not smuggle later capabilities into earlier phases;
- events and state transitions are attributable and replayable;
- degradation and rollback preserve deny-by-default semantics;
- new cross-module behavior has an ADR or accepted contract amendment.

## Security and privacy review

A phase that adds natural-language assistance, source fetching, organization persistence, credentials, provider traffic, telemetry, or managed operations requires dedicated security and France/EU privacy review before activation. Review covers prompt injection, SSRF, tenant isolation, authorization, secret lifecycle, data minimization, lawful evidence boundaries, retention/deletion, subprocessors, location/jurisdiction, support access, and incident response.

No report may claim that EU hosting alone proves sovereignty, that company/model origin proves jurisdiction, or that one evidence pack certifies global GDPR/AI Act/ISO compliance.

## Human control

The repository owner retains explicit controls required by doctrine and contracts, including authority lock/amendment, first security-critical pattern, real organization/personal data, source-provider network capability, policy approvals, key ceremony, production, infrastructure, public/commercial exposure, and deployment.

Agent review and green CI are evidence; they do not replace a required owner milestone.

## Invalidation

A review becomes stale when any reviewed normative file, contract/vector digest, gate criterion, metric definition, security boundary, or release candidate changes. Editorial corrections that cannot affect meaning may be documented as non-invalidating only by the review protocol; otherwise re-review is required.

Revocation does not delete historical evidence. It records why an artifact cannot support new decisions and which replacement, if any, is current.

## Evidence export to customers

The product decision record may contain policy/need/snapshot/evaluation/profile IDs and digests, rule statuses, source citations/dates, approvals, configuration graph, metric snapshots, and revocation state. It MUST NOT contain provider/customer secrets, raw prompts/responses/documents, direct person identifiers, or unrestricted source payloads.

Where an auditor must identify a human approver, the customer retains a role-at-time identity binding through its IdP or a signed pseudonym map with explicit access, retention, deletion, and custody rules. Public and routine exports keep only opaque actor IDs; Model Policy does not make those IDs probative by itself.

Canonical machine data is the replay authority; PDF/HTML is a readable projection. Stronger external probative claims require accepted signature/attestation, trustworthy timestamp, custody, retention, access history, identity-resolution procedure, and legal-language review appropriate to the claim.
