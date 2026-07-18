# WP-G2-Z01 qualification

Status: **adversarial remediation in progress; fresh agent gates pending**
Required review passes: `authorization-policy-review`, `key-rotation-review`
Production/Clever authorization: **none**

## Delivered boundary

- Ed25519 authority issuance with opaque user/private-tenant/role facts;
- exact resource, operation, tenant and expiry attenuation, independently
  required and shape-validated by the verifier;
- verified-root SHA-256 revocation identifier and opaque verified revocation
  targets retained to root-authority expiry despite shorter child attenuation;
- bounded external revocation cache with fail-closed store errors;
- embedded Sessions/Missions deny-by-default authorizers;
- exact signed-authority shape, issuer activation/TTL enforcement and verifier
  remaining-lifetime bound;
- two-key current/retiring rotation state machine with caller-supplied current
  time, active-state and non-stale timeline checks;
- zeroized/redacted token transport and the five canonical refusal codes;
- adversarial tests and mandatory workspace supply-chain checks.

## Runtime dependency requalification

`WP-G2-T01` remains the sole authority for the root manifest and lockfile. This
package requests no root version change: `origin/main` already pins
`biscuit-auth = 5.0.0` with default features disabled. Z01 requalifies that
previously test-only selection for this bounded runtime capability:

- `biscuit-auth` 5.0.0, Apache-2.0, crates.io checksum
  `95490f2c91dc452247d00a2fb4779bcedb7693e669354fa1fe2a96679f4950cc`;
- `biscuit-parser` 0.1.2, Apache-2.0, exposed under the exact
  `biscuit-parser-legacy` workspace alias solely to keep verified block
  print/parse inspection aligned with `biscuit-auth` 5.0.0's internal parser;
- `sha2` 0.11.0 and `zeroize` 1.9.0, already pinned by the workspace.

The Biscuit default feature set is disabled, so the optional Datalog macro,
PEM, WASM, serde-error and full-regex surfaces are absent. The unavoidable
minimal closure includes the same parser 0.1.2 now used by Z01 block inspection
and its bounded standard-regex engine. There is no vendored source, mutable Git dependency,
advisory exception, network call or service SDK. `cargo deny check advisories
licenses sources` remains mandatory. The generated `Cargo.lock` workspace
package entry and parser alias must be integrated under a distinct
`WP-G2-T01`-owned change; they are not part of the Z01 write path.

## Verification commands

```text
cargo test -p libre-ai-authz-biscuit --offline
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-features
cargo deny check advisories licenses sources
bun run check:contracts
bun run check:work-packages
bun run check
bun test
```

The final command outcomes and CI URL must be attached to the PR after a clean
run. Automated success is evidence, not a role-separated agent verdict.

## Deferred and blocked

- no private key, secret backend, production issuer or infrastructure exists;
- no browser or application integration starts before the dependent packages;
- no Redis/Clever provisioning is performed;
- production remains blocked by the Bun stable qualification and all later G2,
  G3 and G4 gates.
