# `libre-ai-authz-biscuit`

Specialized Ed25519 Biscuit issuance, attenuation, verification, revocation and two-key rotation.

Security order is fixed: verify signature and key validity, derive the root authority block ID,
check revocation, inject authoritative request facts, then execute a bounded deny-by-default policy.
Tokens and private keys have redacted `Debug` implementations and are never returned in errors.

The browser boundary must never receive this crate's serialized tokens.

Security invariants and reviewer evidence are in [`SECURITY.md`](SECURITY.md),
[`G2-Z01-QUALIFICATION.md`](G2-Z01-QUALIFICATION.md) and [`evidence/`](evidence/).
The vendored Biscuit source is provenance-bound and deliberately excludes its
unmaintained procedural macro dependency.
