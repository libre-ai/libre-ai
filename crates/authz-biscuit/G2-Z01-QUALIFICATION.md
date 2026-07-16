# WP-G2-Z01 qualification

Status: **implementation complete; human gates pending**
Human gates: `authorization-policy-review`, `key-rotation-review`
Production/Clever authorization: **none**

## Delivered boundary

- Ed25519 authority issuance with opaque user/private-tenant/role facts;
- exact resource, operation, tenant and expiry attenuation;
- verified-root SHA-256 revocation identifier;
- bounded external revocation cache with fail-closed store errors;
- embedded Sessions/Missions deny-by-default authorizers;
- exact signed-authority shape, issuer TTL enforcement and verifier remaining-lifetime bound;
- two-key current/retiring rotation state machine;
- zeroized/redacted token transport and generic refusal errors;
- adversarial and supply-chain integrity tests.

## Dependency authority delta

Root dependency files remain under `WP-G2-T01` authority. The requested exact
delta is:

- `biscuit-auth` 6.0.0, Apache-2.0, vendored from crates.io checksum
  `d5884fc86b3e21f5649ef4326e17ef729b3096e6502deaf13db7b7fb05bb992b`;
- `zeroize` 1.9.0, MIT OR Apache-2.0;
- existing `biscuit-parser` 0.2.0 and `sha2` 0.11.0 reused.

The released Biscuit default macro surface was removed because it introduces
unmaintained `proc-macro-error2` 2.0.1 (`RUSTSEC-2026-0173`), while release 6.0.0
fails to compile without it. The vendored copy applies exact upstream fix commit
`1d079d405676d9b33cd1f9f620b6920b5d381b87` and is covered by
`../../toolchains/vendor/biscuit-auth/VENDOR-MANIFEST.sha256` (manifest SHA-256
`7fe574f44ac341d22c1470d02ee759ae9e4bd54148dc057f0aae2f4c7d564ecd`).
No advisory exception or mutable Git dependency is used.

## Verification commands

```text
cargo test -p libre-ai-authz-biscuit
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-targets
cargo deny check
bun run check:contracts
bun run check:work-packages
bun run check
bun test
```

The final command outcomes and CI URL must be attached to the PR after a clean
run. Automated success is evidence, not approval of either human gate.

## Deferred and blocked

- no private key, secret backend, production issuer or infrastructure exists;
- no browser or application integration starts before the dependent packages;
- no Redis/Clever provisioning is performed;
- production remains blocked by the Bun stable qualification and all later G2,
  G3 and G4 gates.
