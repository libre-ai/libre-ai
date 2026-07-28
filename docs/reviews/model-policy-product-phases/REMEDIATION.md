# Model Policy product phases — review remediation

- **Rejected candidate:** `95e49839e0ec2791333998a479dca72ed201042e`
- **Source reviews:** [business](BUSINESS-REVIEW.md), [technical](TECHNICAL-REVIEW.md), [architecture](ARCHITECTURE-REVIEW.md)
- **Scope:** coordinator remediation after three independent read-only reviews

## Integrated findings

| Finding | Remediation |
| --- | --- |
| Competing product-status authority and false MP-P0 progress | Removed current phase, phase status, gate status, blockers, and the retroactive passed gate. The JSON is a `draft` planning record; `GOALS.md` and `STATUS.md` are schema-pinned as the only status authorities. Every phase has external owner/wave/work-package prerequisites. |
| Unowned shared-root and locked-specification edits | Restored root `package.json` and `docs/apps/model-policy.md`; moved checker and tests under `apps/model-policy/**` and integrated them through the app package. |
| Bare-path evidence and unrelated-file acceptance | Added `evidence-record.v1.schema.json`; gate references now require allowlisted JSON record paths plus SHA-256. The checker verifies tracked regular non-symlink records, record schema/digest, phase/gate/level binding, source commit, source-commit artifact modes/digests, and supporting-review digests. |
| Unsafe checker narrowing and write order | Parsed input stays `unknown` until schema validation; schema/compile failures return stable diagnostics; projection writes occur only after all validation passes. |
| One-way gate and README drift checks | Gate headings must match registry entries bidirectionally and in order; both app and documentation projections are generated/checked. |
| Dependency-start loophole | Removed local execution status entirely. Dependency order remains acyclic planning data; activation/completion is accepted only through global authorities. |
| MP-P6 violated ranking/quality non-goals | Removed ranker, model-quality comparison, recommendations, quality corpus gates, and procurement ordering. MP-P6 is an observational evidence/operations/cost/remediation cockpit. |
| MP-P4 enforced authorization too early | MP-P4 now emits immutable asymmetric transition/revocation events only; MP-P5 exclusively consumes them and enforces profiles/traffic. |
| Phase 1 actor and approval gaps | Added per-field accountable actor, source, delegate, unknown/escalation/conflict states; added data, application, and procurement/contract owners; bound use-case-owner attestation, renewal, correction, and revocation to the passport digest. |
| Optional assistant became mandatory | Removed MP-P2 from the deterministic chain and MP-P7 dependency; managed service defines base and optional-assistance variants. |
| Monitoring action/accountability gaps | Added assignee, accountable role, due instant, escalation, approved disposition, closure evidence, ageing metrics, and versioned material-change reconciliation. |
| Managed-service commercial/privacy ambiguity | Replaced the broad guarantee with bounded commitments; added provider/key/cost modes, contractual RACI, DPA/controller/processor/subprocessor allocation, locations/transfers, audit rights, support severities, exclusions, escalation, and remedies. |
| Opaque approvals not auditable | Added customer-controlled IdP or signed role-at-time pseudonym mapping with access, retention, deletion, custody, and break-glass rules. |
| Unsafe language and missing glossary | Replaced “what can be used” and “compliance metrics”; added concise definitions for tunnel, passport, doctrine, deployment configuration, access profile, and qualified. |

## Intentionally not fabricated

- No work package, ADR/specification amendment, owner selection, wave activation, production approval, or commercial approval is marked accepted. Those are external human-controlled prerequisites.
- Existing candidate/lock wording in normative Policy Core authorities is not edited by this documentation change; any inconsistency there requires its own authorized authority change.
- No rejected review is reused as passed gate evidence. These reports document why the first candidate was rejected.

## Verification required for the remediated candidate

- app phase-plan checker and adversarial tests;
- app test suite;
- repository typecheck, Biome, source policy, contract checks, Bun suite, Markdown links, and diff hygiene;
- independent follow-up review against the immutable remediated commit before merge.
