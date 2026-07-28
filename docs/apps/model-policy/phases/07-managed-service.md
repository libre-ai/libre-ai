# MP-P7 — Managed service

## Outcome

Libre AI operates the model-policy control plane for an organization under its approved doctrine and explicit service commitments: policy translation support, sourced model-route curation, continuous re-evaluation, access-profile enforcement, operational monitoring, and evidence delivery.

## Customer promise

The customer delegates operation, not policy sovereignty. Its designated humans approve doctrine, material exceptions, and access broadening. The service guarantees faithful application of accepted rules and qualified operational controls within a contractually bounded scope; it does not issue a blanket guarantee that every customer processing activity complies with every law.

## Service boundary

The managed service may:

- help translate written doctrine into proposed machine rules;
- curate sourced model/provider/deployment facts;
- operate freshness and re-evaluation pipelines;
- prepare use-case and access-profile proposals;
- enforce approved profiles through the gateway;
- monitor evidence, usage, quality, cost, and incidents;
- deliver decision records and audit exports;
- notify and remediate provider-route changes under agreed runbooks.

The service may not:

- approve its own organization policy proposal;
- invent undisclosed legal requirements;
- waive protected customer rules;
- add newly eligible routes without the agreed approval path;
- expose or share provider/customer secrets;
- reuse customer content for training or unrelated benchmarking;
- claim the decision record alone is a GDPR, AI Act, ISO, HDS, or other certification.

## Onboarding

1. Establish organization, tenant, roles, data locations, and authorization boundaries.
2. Inventory doctrine sources and designate proposal/approval responsibilities.
3. Convert doctrine into a candidate policy with source mapping and unknown handling.
4. Review policy diffs and obtain customer approval of the exact digest.
5. Inventory use cases and prioritize qualification by customer-defined impact.
6. Create passports through the deterministic tunnel; optionally use accepted assistance.
7. Evaluate deployment configurations and prepare access profiles.
8. Activate gateway/monitoring only after security, privacy, key, rollback, and owner gates.

Customer source documents remain in approved private evidence storage and are minimized; they are not copied to public policy citations or logs.

## Service commitments

Commercial commitments can cover:

- registry source scope and maximum freshness;
- time from accepted material change to re-evaluation;
- revocation propagation;
- gateway availability and latency by route/profile class;
- incident notification;
- backup, restore, deletion, and evidence delivery;
- support jurisdiction and authorized personnel;
- audit-log and decision-record availability;
- portability and exit assistance.

A commitment must identify its measurement, exclusions, evidence, and remedy. Legal compliance outcomes, model correctness, and third-party provider continuity cannot be promised as unbounded absolutes.

## Operating model

Operations use least-privilege service identities, short-lived capabilities, separation between curation and customer approval, tenant-isolated queues/data, two-person or customer-controlled gates for critical actions, and rehearsed incident/rollback procedures. Support has no default content access. Break-glass access is exceptional, time-bound, approved, logged, and reviewed.

Provider or model substitution follows the same profile semantics as self-service operation: restriction may be automatic; access broadening requires approval; only preapproved fallbacks may receive traffic automatically.

## Evidence and assurance

The customer receives canonical machine evidence and accessible human projections for policies, needs, model snapshots, evaluations, profile decisions, route transitions, incidents, and service-level measures. Exports include digests, signatures/attestations where qualified, timestamps, source freshness, approval references, and engine versions without secrets or personal content.

A stronger external probative claim requires accepted signature, trusted timestamp, retention, custody, and legal-review procedures. Product copy must state the achieved evidence level rather than using “legally binding” generically.

## Portability and exit

The customer can export policies, bounded needs, sourced snapshots where licences allow, evaluations, profiles without secrets, metric definitions, and decision histories in documented open formats. Provider keys are rotated/revoked; active credentials are terminated; customer data is deleted under the accepted lifecycle with evidence. No proprietary API or hidden score may be required to replay eligibility.

## Metrics

Required metrics include every release gate from earlier phases plus `MP-MET-SVC-001`, `MP-MET-SVC-002`, `MP-MET-WATCH-001`, `MP-MET-ACCESS-002`, and `MP-MET-PII-001`.

## Exit gates

### MP-P7-G01 — Service scope and responsibility matrix are contractual

Customer and operator responsibilities for doctrine, declarations, approvals, curation, gateway, incidents, legal review, and residual risks are explicit. Marketing and contractual language contain no blanket or unsupported compliance guarantee.

### MP-P7-G02 — Customer approval sovereignty is enforced

Managed-service identities can propose but cannot approve customer policy, material exceptions, or scope broadening. Authorization, RLS, approval separation, and break-glass controls pass adversarial tenant tests.

### MP-P7-G03 — Service levels are measurable and evidenced

Freshness, re-evaluation, revocation, availability, latency, incident, deletion, export, and support commitments have stable formulas, monitoring, evidence, exclusions, and response procedures.

### MP-P7-G04 — Operations and incident response are qualified

Key compromise, provider breach/change, stale evidence, route revocation, cross-tenant attempt, queue outage, data loss, deletion, support break-glass, rollback, and customer notification exercises pass with attributable evidence.

### MP-P7-G05 — Evidence custody supports the claimed assurance level

Canonical exports, digests, signatures/attestations, timestamps, retention, access history, and replay procedures are independently reviewed. The service states precisely what the evidence proves and what remains outside scope.

### MP-P7-G06 — Portability and termination are proven

A representative customer can export and independently replay eligibility, revoke credentials, recover owned records, complete deletion, and leave without inaccessible proprietary authority data or retained provider secrets.

### MP-P7-G07 — Paid-service release receives independent approval

Business, Architecture, Security, France/EU Privacy, operations, performance, legal-language, and candidate-integration reviews approve the immutable release. The human owner explicitly authorizes production and commercial exposure after post-deploy smoke and rollback evidence.

## Dependencies and parallel work

MP-P7 depends on accepted operation of MP-P2 through MP-P6; the LLM remains optional for each customer journey even though its managed operation is qualified. Commercial terms, operations/runbooks, and portability can be prepared in parallel, but no paid production claim precedes in-service evidence.

## Release and rollback

The managed service uses staged tenant activation, automated smoke tests, health gates, and rollback that never restores revoked routes, deleted customer data, or expired approvals. A control-plane uncertainty denies new decisions or traffic according to profile policy. Termination and emergency exit procedures remain executable throughout the service lifecycle.
