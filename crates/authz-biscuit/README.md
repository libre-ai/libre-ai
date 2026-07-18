# `libre-ai-authz-biscuit`

Specialized Ed25519 Biscuit issuance, attenuation, verification, revocation and two-key rotation.

Security order is fixed: verify signature and key validity, derive the root authority block ID,
check revocation, require the canonical initial attenuation block, inject authoritative request
facts, then execute a bounded deny-by-default policy.
Tokens and private keys have redacted `Debug` implementations and are never returned in errors.

The browser boundary must never receive this crate's serialized tokens.

Security invariants and reviewer evidence are in [`SECURITY.md`](SECURITY.md),
[`G2-Z01-QUALIFICATION.md`](G2-Z01-QUALIFICATION.md) and [`evidence/`](evidence/).
The crate reuses the workspace-qualified exact `biscuit-auth` 5.0.0 registry
release with default features disabled and its matching internal parser grammar;
it carries no vendored or Git source.
