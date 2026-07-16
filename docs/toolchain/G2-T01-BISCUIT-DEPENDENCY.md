# G2-T01 Biscuit dependency intake

Date: 2026-07-16

Scope: dependency authority for `WP-G2-Z01`

Status: **automated checks pass; supply-chain human review pending**

Production authorization: **unchanged and blocked**

## Exact request

| Package | Exact source/version | Licence | Use |
| --- | --- | --- | --- |
| `biscuit-auth` | local reviewed copy of crates.io `6.0.0` | Apache-2.0 | Ed25519 Biscuit runtime |
| `zeroize` | crates.io `1.9.0` | MIT OR Apache-2.0 | transport credential erasure |
| `biscuit-parser` | existing crates.io `0.2.0` | Apache-2.0 | verified authority-shape parsing |
| `sha2` | existing crates.io `0.11.0` | MIT OR Apache-2.0 | root block ID derivation |

`Cargo.lock` fixes every transitive version and registry checksum. `cargo deny`
accepts only the existing permissive licence set and canonical crates.io source.
The new cryptographic tree includes older parallel SHA/prost/PKCS8 generations
required by Biscuit 6.0.0; duplicate-version warnings are visible and accepted
as build-size debt, not hidden. No network service, telemetry SDK or
hyperscaler dependency is introduced.

## Biscuit source provenance

- crates.io checksum:
  `d5884fc86b3e21f5649ef4326e17ef729b3096e6502deaf13db7b7fb05bb992b`
- release source commit:
  `0f0b4e0e6fe07220c1ba6b51bff21d450d94a975`
- reviewed upstream no-default-feature fix:
  `1d079d405676d9b33cd1f9f620b6920b5d381b87`
- vendored manifest SHA-256:
  `7fe574f44ac341d22c1470d02ee759ae9e4bd54148dc057f0aae2f4c7d564ecd`
- local path: `toolchains/vendor/biscuit-auth`

The 6.0.0 release cannot compile with default features disabled because five
`ToAnyParam` imports were not feature-gated. Enabling the default procedural
macro pulls unmaintained `proc-macro-error2` 2.0.1, rejected by
`RUSTSEC-2026-0173`. The local copy applies the exact upstream fix, removes the
unused macro feature/dependency, gates two resulting unused items and preserves
Apache-2.0 notices. Full details and per-file hashes are in
`toolchains/vendor/biscuit-auth/LIBRE-AI-PROVENANCE.md` and
`VENDOR-MANIFEST.sha256`.

This choice avoids both an advisory exception and a mutable Git dependency.
Any source refresh requires a new manifest and independent review.

## Verification

```text
cargo test -p libre-ai-authz-biscuit --test vendor_integrity
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-targets
cargo deny check
```

Observed locally before PR publication:

- vendored file-set/hash test: pass (94 files);
- Clippy with warnings denied: pass;
- Z01 tests: pass (9 authorization tests + 1 vendor test);
- `cargo deny`: advisories, bans, licences and sources pass; duplicate versions
  remain warnings.

## Non-authorization statement

This intake does not qualify a stable Rust-line Bun release, does not provision
Clever Cloud or secret storage, and does not create a production signing key.
The canary remains development/CI-only and production remains prohibited.
