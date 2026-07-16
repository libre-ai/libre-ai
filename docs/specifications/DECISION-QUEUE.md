# G1 decision queue

Only decisions that can alter contracts, data ownership, legal exposure or repository boundaries belong here. G1 cannot close while an item is open.

## Q1 — Tenant model by application

**Recommendation:**

- public/no tenant: Website, Boussole public datasets ;
- personal tenant: Practices progress, Radar subscriptions, Notebook, Boussole local responses ;
- organization tenant: Sessions, Model Policy, Specifications, Missions ;
- represent a personal tenant as an opaque tenant ID, never as a special missing-tenant case ;
- no cross-tenant aggregate query in product APIs.

**Why:** one mandatory tenant fact and one RLS pattern avoids an authorization exception for personal data.

**Decision needed:** accept this split or identify applications requiring both personal and organization workspaces in v1.

## Q2 — External authentication provider boundary

**Recommendation:** lock a provider-neutral OIDC Authorization Code + PKCE adapter and server-side subject mapping. Do not select or provision a vendor in G1. Local development uses a deterministic in-process test issuer; production provider selection is a G4 infrastructure decision that cannot change the session contract.

**Decision needed:** confirm provider-neutral OIDC, or require a specific sovereign identity provider contract now.

## Q3 — Retention defaults

**Recommendation:**

| Data | Default |
| --- | --- |
| browser sessions and revocations | session expiry + 24 h ; maximum session 12 h |
| Practices local progress | until local deletion/export reset |
| Radar fetched bodies | discard after normalization; failure quarantine 7 days |
| Radar normalized items and decisions | 90 days, tenant-configurable 7–365 |
| Notebook | local until deletion; no server copy in v1 |
| Sessions participant presence | 24 h |
| Sessions content/outcomes | 90 days, tenant-configurable 7–365 |
| Model Policy accepted snapshots | immutable while referenced, then 5 years |
| Specifications accepted packages | immutable while referenced, then 5 years |
| Missions events/evidence refs | 1 year, tenant-configurable up to 6 years |
| operational logs | 30 days, no content/PII |
| proof/artifact manifests | immutable while release or decision is retained |

Deletion requests execute immediately in active stores; encrypted backups expire within 35 days and are not selectively restored.

**Decision needed:** approve defaults and maxima, especially five/six-year organizational records.

## Q4 — Notebook synchronization scope

**Recommendation:** v1 is local-only with encrypted export/import and deterministic conflict-free restore into a new local workspace. No background cloud sync, server note storage or multi-device merge enters G2. A future sync contract requires a new decision and threat model.

**Decision needed:** confirm local-only v1 or require multi-device sync in the first release.

## Q5 — Boussole legal/methodological release authority

**Recommendation:** code and public datasets MAY be built in G2/G3, but public scoring remains disabled until two named independent approvals exist: methodological review and French/EU legal/privacy review. The release gate stores approval references and dataset/method hashes, never reviewer personal details beyond a public professional attribution explicitly consented to.

**Decision needed:** confirm two independent approvals and disabled-by-default public scoring, or define another authority model.
