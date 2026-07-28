# Model Policy product delivery phases

## Status

**Authority status: proposed.** These records describe the proposed product trajectory and current evidence mapping. They grant no implementation, policy, provider-network, credential, production, deployment, or compliance authority. Global transformation status remains owned by [`GOALS.md`](../../../GOALS.md) and [`STATUS.md`](../../../STATUS.md).

The machine-readable status authority for this proposed product roadmap is [`phases.v1.json`](phases.v1.json), validated by [`phases.v1.schema.json`](phases.v1.schema.json). Phase status is gate-based rather than a subjective percentage. A passed gate must link to immutable evidence under [`docs/reviews/`](../../reviews/) or [`distribution/evidence/`](../../../distribution/evidence/).

## Product progression

| Phase | Product outcome | Depends on |
| --- | --- | --- |
| [MP-P0](phases/00-foundation.md) | Sourced facts, approved rules, deployment-configuration identity, and deterministic evaluator | — |
| [MP-P1](phases/01-deterministic-qualification.md) | Explained business tunnel and configuration verdicts without an LLM | MP-P0 |
| [MP-P2](phases/02-llm-assistance.md) | Optional, non-authoritative pre-fill and challenge assistance | MP-P1 |
| [MP-P3](phases/03-organization-governance.md) | Versioned organization doctrine, approvals, and bounded exceptions | MP-P1 |
| [MP-P4](phases/04-continuous-monitoring.md) | Source refresh, immutable re-evaluation, and transition alerts | MP-P3 |
| [MP-P5](phases/05-access-gateway.md) | Approved access profiles, individual credentials, and gateway enforcement | MP-P3, MP-P4 |
| [MP-P6](phases/06-activity-cockpit.md) | Evidence, quality, performance, cost, usage, and incident cockpit | MP-P4, MP-P5 |
| [MP-P7](phases/07-managed-service.md) | Managed operation under customer-approved doctrine and service commitments | MP-P2–MP-P6 |

MP-P2 and MP-P3 can progress independently after MP-P1: LLM assistance is a usability capability, not a prerequisite for organization governance. The deterministic tunnel remains available through every later phase.

## Stable boundaries

One integrated user experience composes distinct authorities:

```text
Deterministic tunnel ── optional assistant suggestions
         │
         ▼
Confirmed bounded need + approved organization policy
         │
         ▼
Pure eligibility evaluator ◄── sourced deployment-configuration snapshot
         │
         ├── eligible / ineligible / indeterminate + rule evidence
         ▼
Eligible-only business ranker
         │
         ▼ authorized approval command
Versioned access profile ── per-consumer credentials ── gateway
         │
         ▼
Privacy-minimized activity cockpit and evidence exports
```

- Eligibility is not ranking, procurement, approval, or authorization.
- Ranking never receives failed or indeterminate configurations.
- An access profile is shareable; a secret credential is individual.
- Provider credentials never leave the gateway boundary.
- Model origin, provider entity, hosting jurisdiction, processing location, and certification evidence are separate facts.
- Historical evidence is immutable; new facts produce new evaluations.
- Restriction may be automatic, but access broadening requires approval.

## Supporting authorities

- [Product specification](../model-policy.md) — current purpose, actors, protocol, contracts, and non-goals.
- [Metric catalogue](METRICS.md) — stable definitions, formulas, sources, privacy, and gate status.
- [Evidence policy](EVIDENCE.md) — evidence levels, review roles, storage, invalidation, and customer export.
- [Policy Core v2 semantics](../../../contracts/wit/policy-core-v2/SEMANTICS.md) — deterministic eligibility boundary.
- [Role-separated review protocol](../../reviews/AGENT-REVIEW-PROTOCOL.md) — immutable review requirements.

Architecture decisions remain in [`docs/adr/`](../../adr/), contracts remain in [`contracts/`](../../../contracts/), and non-normative evidence never silently becomes doctrine.

## Status workflow

1. Define or amend a phase gate in its phase record.
2. Implement only under an accepted bounded work package.
3. Produce immutable evidence for the exact candidate.
4. Run the required business, technical, architecture, security/privacy, and owner reviews.
5. Change a gate to `passed` and link its evidence in `phases.v1.json`.
6. Mark a phase `complete` only when every mandatory gate is passed.
7. Regenerate the app README projection with:

```console
bun tools/quality/check-model-policy-phases.ts --write
```

CI runs the same checker without `--write` and refuses schema, dependency, evidence, gate-definition, or README drift.
