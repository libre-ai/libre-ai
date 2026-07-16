# Biscuit Auth vendoring provenance

This directory is a security-hardened local copy of `biscuit-auth` 6.0.0 under
Apache-2.0. It is not a Libre AI fork with an independent API or release line.

## Immutable origin

- crates.io package: `biscuit-auth` 6.0.0
- crates.io checksum: `d5884fc86b3e21f5649ef4326e17ef729b3096e6502deaf13db7b7fb05bb992b`
- upstream repository: `https://github.com/biscuit-auth/biscuit-rust`
- release source commit from `.cargo_vcs_info.json`:
  `0f0b4e0e6fe07220c1ba6b51bff21d450d94a975`
- licence: Apache-2.0 (`LICENSE` is preserved)

## Reviewed local delta

1. Apply upstream commit `1d079d405676d9b33cd1f9f620b6920b5d381b87`
   (`fix: feature-gate ToAnyParam imports`) to five builder files. This is the
   exact upstream fix published seven commits after the 6.0.0 tag.
2. Remove the optional `datalog-macro` feature and `biscuit-quote` dependency
   from the vendored manifest. Libre AI uses parsed Datalog authorities and
   does not expose procedural policy macros.
3. Recognize the now-disabled `datalog-macro` cfg name for the vendored source,
   so dead macro code remains uncompiled without producing cfg warnings.
4. Gate two imports/helpers that are unused when macro and PEM features are
   disabled.
5. Accept repository formatting hygiene: `cargo fmt --all` normalizes generated
   Prost attribute spacing in `src/format/schema.rs`; trailing whitespace and
   duplicate final blank lines are removed from text files.

No cryptographic, serialization, verification or Datalog runtime behavior is
changed.

## Security reason

The crates.io default macro feature pulls `proc-macro-error2` 2.0.1, which is
unmaintained under `RUSTSEC-2026-0173`. The released crate also fails to compile
with that feature disabled because five imports were not feature-gated.
Vendoring the reviewed upstream fix and removing the unused macro surface keeps
`cargo deny check` fail-closed without an advisory exception or mutable Git
dependency.

`VENDOR-MANIFEST.sha256` covers every file in this directory except itself.
`tests/vendor_integrity.rs` verifies both the exact file set and all hashes.
Any refresh requires a new dependency-authority review; it must not silently
update this copy.
